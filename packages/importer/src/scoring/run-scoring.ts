import "dotenv/config";
import { createNodeDb, schema } from "@myplv/db";
import { eq, inArray } from "drizzle-orm";
import { computeScore, type RuleCondition, type ScoringRuleDef } from "@myplv/scoring";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * (Re)calcule le score de tous les prospects à partir des règles actives —
 * brief section 27. À lancer après un import, ou périodiquement (pipeline
 * quotidien, brief section 47). Idempotent : relançable sans effet de bord,
 * le score est entièrement recalculé à chaque exécution, jamais accumulé.
 */
async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL manquant (voir .env.example).");
    process.exit(1);
  }
  const db = createNodeDb(databaseUrl);

  const ruleRows = await db.select().from(schema.scoringRules).where(eq(schema.scoringRules.isActive, "true"));
  const rules: ScoringRuleDef[] = ruleRows.map((r) => ({
    id: r.id,
    slug: r.slug,
    label: r.label,
    points: r.points,
    isActive: true,
    condition: JSON.parse(r.condition) as RuleCondition,
  }));

  if (rules.length === 0) {
    console.warn("Aucune règle de scoring active — lance `npm run seed:scoring` d'abord.");
  }

  const sectorRows = await db.select({ id: schema.sectors.id, slug: schema.sectors.slug }).from(schema.sectors);
  const sectorSlugById = new Map(sectorRows.map((s) => [s.id, s.slug]));

  const rows = await db
    .select({
      prospectId: schema.prospects.id,
      startDate: schema.companies.startDate,
      collectedAt: schema.companies.collectedAt,
      sectorId: schema.companies.sectorId,
      province: schema.companies.province,
      email: schema.companies.email,
      hasWebsite: schema.companies.hasWebsite,
      enterpriseType: schema.companies.enterpriseType,
    })
    .from(schema.prospects)
    .innerJoin(schema.companies, eq(schema.companies.id, schema.prospects.companyId));

  const emails = rows.map((r) => r.email).filter((e): e is string => !!e);
  const suppressed = emails.length
    ? new Set(
        (
          await db
            .select({ email: schema.suppressionList.email })
            .from(schema.suppressionList)
            .where(inArray(schema.suppressionList.email, emails))
        ).map((s) => s.email),
      )
    : new Set<string>();

  const tierCounts: Record<string, number> = {};
  let eligibleCount = 0;

  for (const row of rows) {
    const result = computeScore(rules, {
      startDate: row.startDate,
      collectedAt: row.collectedAt,
      sectorSlug: row.sectorId ? (sectorSlugById.get(row.sectorId) ?? null) : null,
      province: row.province,
      email: row.email,
      hasWebsite: row.hasWebsite,
      enterpriseType: row.enterpriseType,
    });

    const hasValidEmail = !!row.email && EMAIL_RE.test(row.email);
    const isEligible = hasValidEmail && !suppressed.has(row.email!);
    if (isEligible) eligibleCount++;

    tierCounts[result.tier] = (tierCounts[result.tier] ?? 0) + 1;

    await db
      .update(schema.prospects)
      .set({
        score: result.score,
        scoreTier: result.tier,
        scoreBreakdown: JSON.stringify(result.breakdown),
        isEligibleForEmail: isEligible ? "true" : "false",
        updatedAt: new Date(),
      })
      .where(eq(schema.prospects.id, row.prospectId));
  }

  console.log(`${rows.length} prospects notés avec ${rules.length} règle(s) active(s).`);
  console.log(`Répartition : ${JSON.stringify(tierCounts)}`);
  console.log(`${eligibleCount} éligibles à l'envoi email (email valide + hors liste de suppression).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
