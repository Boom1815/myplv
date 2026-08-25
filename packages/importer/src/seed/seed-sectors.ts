import "dotenv/config";
import { createNodeDb, schema } from "@myplv/db";
import { eq } from "drizzle-orm";

/**
 * Secteurs métier compréhensibles (brief section 23), reliés à des
 * préfixes de code NACE (nomenclature NACE-BEL en vigueur depuis le
 * 01/01/2025 — divisions à 2 chiffres, standard public EU NACE Rev. 2.1).
 *
 * ⚠️ Point de départ volontairement simple, pas une classification
 * exhaustive : les préfixes qui se chevauchent (ex. automobile vs commerce)
 * sont départagés par `priority`. À affiner depuis l'écran Secteurs une
 * fois en usage réel — c'est justement pour ça que c'est en base et pas en
 * dur dans le code.
 */
const SECTORS: Array<{ slug: string; label: string; nacePrefixes: Array<{ prefix: string; priority?: number }> }> = [
  { slug: "horeca", label: "Horeca", nacePrefixes: [{ prefix: "55" }, { prefix: "56" }] },
  { slug: "construction", label: "Construction", nacePrefixes: [{ prefix: "41" }, { prefix: "42" }, { prefix: "43" }] },
  { slug: "immobilier", label: "Immobilier", nacePrefixes: [{ prefix: "68" }] },
  {
    slug: "automobile",
    label: "Automobile",
    nacePrefixes: [{ prefix: "45", priority: 10 }], // priorité > commerce (46/47) sur le même chevauchement de section G
  },
  { slug: "commerce", label: "Commerce", nacePrefixes: [{ prefix: "46" }, { prefix: "47" }] },
  {
    slug: "professions_liberales",
    label: "Professions libérales",
    nacePrefixes: [{ prefix: "69" }, { prefix: "70" }, { prefix: "71" }, { prefix: "72" }, { prefix: "73" }, { prefix: "74" }],
  },
  { slug: "sante", label: "Santé", nacePrefixes: [{ prefix: "86" }, { prefix: "87" }, { prefix: "88" }] },
  { slug: "beaute", label: "Beauté", nacePrefixes: [{ prefix: "96" }] },
  {
    slug: "artisanat",
    label: "Artisanat",
    nacePrefixes: [{ prefix: "16" }, { prefix: "31" }, { prefix: "13" }, { prefix: "14" }],
  },
  { slug: "services", label: "Services aux entreprises", nacePrefixes: [{ prefix: "77" }, { prefix: "78" }, { prefix: "80" }, { prefix: "81" }, { prefix: "82" }] },
  { slug: "industrie", label: "Industrie", nacePrefixes: [{ prefix: "10" }, { prefix: "20" }, { prefix: "25" }, { prefix: "28" }] },
  { slug: "tourisme", label: "Tourisme", nacePrefixes: [{ prefix: "79" }] },
  { slug: "evenementiel", label: "Événementiel", nacePrefixes: [{ prefix: "90" }] },
  { slug: "sport", label: "Sport", nacePrefixes: [{ prefix: "93" }] },
];

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL manquant (voir .env.example).");
    process.exit(1);
  }
  const db = createNodeDb(databaseUrl);

  for (const sector of SECTORS) {
    let [row] = await db.select().from(schema.sectors).where(eq(schema.sectors.slug, sector.slug));
    if (!row) {
      [row] = await db.insert(schema.sectors).values({ slug: sector.slug, label: sector.label }).returning();
      console.log(`+ secteur créé : ${sector.label}`);
    }

    for (const { prefix, priority } of sector.nacePrefixes) {
      await db
        .insert(schema.sectorNaceRules)
        .values({ sectorId: row.id, nacePrefix: prefix, priority: priority ?? 0 })
        .onConflictDoNothing();
    }
  }

  console.log(`\n${SECTORS.length} secteurs vérifiés/créés.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
