import "dotenv/config";
import path from "node:path";
import { createNodeDb, schema } from "@myplv/db";
import { eq } from "drizzle-orm";
import { readCsvRows } from "./csv-stream";
import { resolveGeoFromPostalCode } from "../geo/province-from-postal-code";
import type { AddressRow, ActivityRow, DenominationRow, EnterpriseRow } from "./types";

/**
 * Import KBO/BCE Open Data — brief section 17-20-21-25.
 *
 * Usage :
 *   npm run import:kbo -- --dir ./data/kbo-raw [--limit 500]
 *
 * `--dir` doit contenir les fichiers officiels tels que téléchargés depuis
 * https://kbopub.economie.fgov.be/kbo-open-data/ : enterprise.csv,
 * address.csv, activity.csv, denomination.csv (compte gratuit requis).
 *
 * Optimisation volontaire : on ne garde en mémoire que les entités dont
 * l'adresse tombe dans le périmètre géographique de lancement (brief
 * section 22 : Bruxelles-Capitale, Brabant wallon, Hainaut, Namur) — c'est
 * suffisant pour rester dans un budget mémoire raisonnable même sur un
 * export national complet, et cohérent avec le ciblage du projet.
 */

const DATA_SOURCE_SLUG = "kbo_open_data";
const MAIN_DENOMINATION_TYPE = "001"; // nom social — à confirmer contre code.csv sur un export réel

type CliArgs = { dir: string; limit?: number };

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const dirIndex = args.indexOf("--dir");
  const limitIndex = args.indexOf("--limit");
  const dir = dirIndex >= 0 ? args[dirIndex + 1] : undefined;
  if (!dir) {
    console.error("Usage: npm run import:kbo -- --dir <chemin vers les CSV KBO Open Data> [--limit N]");
    process.exit(1);
  }
  const limit = limitIndex >= 0 ? Number(args[limitIndex + 1]) : undefined;
  return { dir, limit };
}

type ResolvedAddress = {
  street: string | null;
  houseNumber: string | null;
  postalCode: string;
  municipality: string | null;
  province: string;
  region: string;
};

async function main() {
  const { dir, limit } = parseArgs();
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL manquant (voir .env.example).");
    process.exit(1);
  }
  const db = createNodeDb(databaseUrl);

  console.log(`Import KBO Open Data depuis ${dir}`);
  const startedAt = new Date();

  // --- Passe 1 : address.csv -> périmètre géographique + adresse résolue ---
  const addressByEntity = new Map<string, ResolvedAddress>();
  const addressSeen = await readCsvRows<AddressRow>(path.join(dir, "address.csv"), (row) => {
    if (addressByEntity.has(row.EntityNumber)) return; // on garde la première adresse rencontrée
    if (row.DateStrikingOff) return; // adresse radiée
    const geo = resolveGeoFromPostalCode(row.Zipcode);
    if (!geo) return; // hors périmètre de lancement — l'entité est simplement ignorée
    addressByEntity.set(row.EntityNumber, {
      street: row.StreetFR || row.StreetNL || null,
      houseNumber: row.HouseNumber || null,
      postalCode: (row.Zipcode || "").trim(),
      municipality: row.MunicipalityFR || row.MunicipalityNL || null,
      province: geo.province,
      region: geo.region,
    });
    if (limit && addressByEntity.size >= limit) return false;
  });
  console.log(`address.csv : ${addressSeen} lignes lues, ${addressByEntity.size} entités dans le périmètre.`);

  const allowed = addressByEntity;

  // --- Passe 2 : denomination.csv -> nom (préférence "nom social") ---
  const nameByEntity = new Map<string, { value: string; isMain: boolean }>();
  await readCsvRows<DenominationRow>(path.join(dir, "denomination.csv"), (row) => {
    if (!allowed.has(row.EntityNumber)) return;
    const isMain = row.TypeOfDenomination === MAIN_DENOMINATION_TYPE;
    const current = nameByEntity.get(row.EntityNumber);
    if (!current || (isMain && !current.isMain)) {
      nameByEntity.set(row.EntityNumber, { value: row.Denomination, isMain });
    }
  });

  // --- Passe 3 : activity.csv -> code NACE principal (heuristique : premier trouvé) ---
  const naceByEntity = new Map<string, string>();
  await readCsvRows<ActivityRow>(path.join(dir, "activity.csv"), (row) => {
    if (!allowed.has(row.EntityNumber)) return;
    if (!naceByEntity.has(row.EntityNumber)) {
      naceByEntity.set(row.EntityNumber, row.NaceCode);
    }
  });

  // --- Passe 4 : enterprise.csv -> forme juridique, date de début ---
  const enterpriseByEntity = new Map<string, { legalForm: string | null; startDate: string | null }>();
  await readCsvRows<EnterpriseRow>(path.join(dir, "enterprise.csv"), (row) => {
    if (!allowed.has(row.EnterpriseNumber)) return;
    enterpriseByEntity.set(row.EnterpriseNumber, {
      legalForm: row.JuridicalForm || null,
      startDate: row.StartDate || null,
    });
  });

  // --- Source de données (créée si absente) ---
  let [dataSource] = await db.select().from(schema.dataSources).where(eq(schema.dataSources.slug, DATA_SOURCE_SLUG));
  if (!dataSource) {
    [dataSource] = await db
      .insert(schema.dataSources)
      .values({ slug: DATA_SOURCE_SLUG, name: "KBO/BCE Open Data", adapterType: "kbo_open_data" })
      .returning();
  }

  const [importRow] = await db
    .insert(schema.dataImports)
    .values({ dataSourceId: dataSource.id, status: "running", fileName: dir, startedAt })
    .returning();

  // --- Listes noires actives (brief section 24 : exclusion automatique) ---
  const activeBlacklists = await db.select().from(schema.blacklists);

  let created = 0;
  let updated = 0;
  let skippedBlacklisted = 0;
  let skippedNoName = 0;

  for (const [entityNumber, address] of allowed) {
    const name = nameByEntity.get(entityNumber)?.value;
    if (!name) {
      skippedNoName++;
      continue;
    }
    const naceCode = naceByEntity.get(entityNumber) ?? null;
    const enterprise = enterpriseByEntity.get(entityNumber);

    const isBlacklisted = activeBlacklists.some((b) => {
      if (b.scope === "nace_code" && naceCode) return naceCode.startsWith(b.value);
      if (b.scope === "municipality" && address.municipality) return address.municipality === b.value;
      if (b.scope === "keyword") return name.toLowerCase().includes(b.value.toLowerCase());
      if (b.scope === "company") return name.toLowerCase() === b.value.toLowerCase();
      return false;
    });

    const [existing] = await db
      .select({ id: schema.companies.id })
      .from(schema.companies)
      .where(eq(schema.companies.enterpriseNumber, entityNumber));

    const values = {
      enterpriseNumber: entityNumber,
      name,
      legalForm: enterprise?.legalForm ?? null,
      startDate: enterprise?.startDate ? enterprise.startDate.split("-").reverse().join("-") : null,
      street: address.street,
      houseNumber: address.houseNumber,
      postalCode: address.postalCode,
      municipality: address.municipality,
      province: address.province,
      region: address.region,
      primaryNaceCode: naceCode,
      dataSourceId: dataSource.id,
      sourceRecordId: entityNumber,
      confidence: "high" as const,
      updatedAt: new Date(),
    };

    let companyId: string;
    if (existing) {
      await db.update(schema.companies).set(values).where(eq(schema.companies.id, existing.id));
      companyId = existing.id;
      updated++;
    } else {
      const [inserted] = await db.insert(schema.companies).values(values).returning({ id: schema.companies.id });
      companyId = inserted.id;
      created++;
    }

    if (isBlacklisted) {
      skippedBlacklisted++;
      continue;
    }

    const [existingProspect] = await db
      .select({ id: schema.prospects.id })
      .from(schema.prospects)
      .where(eq(schema.prospects.companyId, companyId));

    if (!existingProspect) {
      await db.insert(schema.prospects).values({ companyId, status: "nouveau", score: 0, scoreTier: "ignorer" });
    }
  }

  const finishedAt = new Date();
  await db
    .update(schema.dataImports)
    .set({
      status: "succeeded",
      finishedAt,
      recordsSeen: allowed.size,
      recordsCreated: created,
      recordsUpdated: updated,
      recordsSkipped: skippedNoName + skippedBlacklisted,
      duplicatesFound: updated,
      summary: {
        skippedNoName,
        skippedBlacklisted,
        note:
          "Heuristiques : nom = TypeOfDenomination 001 sinon première dénomination trouvée ; code NACE = première " +
          "activité trouvée dans activity.csv. À valider contre code.csv sur un export réel avant un import à grande échelle.",
      },
    })
    .where(eq(schema.dataImports.id, importRow.id));

  console.log("");
  console.log(`Import terminé en ${((finishedAt.getTime() - startedAt.getTime()) / 1000).toFixed(1)}s`);
  console.log(`  ${created} entreprises créées`);
  console.log(`  ${updated} entreprises mises à jour`);
  console.log(`  ${skippedBlacklisted} exclues (liste noire)`);
  console.log(`  ${skippedNoName} ignorées (nom introuvable)`);
}

main().catch(async (err) => {
  console.error("Échec de l'import :", err);
  process.exit(1);
});
