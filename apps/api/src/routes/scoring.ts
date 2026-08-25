import { Hono } from "hono";
import { schema } from "@myplv/db";
import { eq, inArray } from "drizzle-orm";
import { computeScore, type RuleCondition, type ScoringRuleDef } from "@myplv/scoring";
import type { AppBindings } from "../env";
import { createDbForEnv } from "../db";
import { requireAuth, requireAdmin } from "../middleware/auth";

export const scoringRoutes = new Hono<AppBindings>();

scoringRoutes.use("*", requireAuth);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** GET /api/scoring-rules — lecture pour ADMIN et READER (brief section 15). */
scoringRoutes.get("/", async (c) => {
  const db = createDbForEnv(c.env);
  const rows = await db.select().from(schema.scoringRules).orderBy(schema.scoringRules.createdAt);
  return c.json({
    data: rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      label: r.label,
      points: r.points,
      isActive: r.isActive === "true",
      condition: JSON.parse(r.condition),
    })),
  });
});

/** PATCH /api/scoring-rules/:id — points et actif/inactif, ADMIN uniquement (brief section 15/27). */
scoringRoutes.patch("/:id", requireAdmin, async (c) => {
  const db = createDbForEnv(c.env);
  const id = c.req.param("id");
  const body = await c.req
    .json<{ points?: number; isActive?: boolean }>()
    .catch(() => ({}) as { points?: number; isActive?: boolean });

  const patch: Record<string, unknown> = {};
  if (typeof body.points === "number" && Number.isFinite(body.points)) patch.points = Math.trunc(body.points);
  if (typeof body.isActive === "boolean") patch.isActive = body.isActive ? "true" : "false";

  if (Object.keys(patch).length === 0) {
    return c.json({ error: "invalid_request", message: "Rien à modifier." }, 400);
  }

  const [updated] = await db.update(schema.scoringRules).set(patch).where(eq(schema.scoringRules.id, id)).returning();
  if (!updated) return c.json({ error: "not_found" }, 404);

  await db.insert(schema.auditLogs).values({
    userId: c.get("userId")!,
    action: "scoring_rule.update",
    entityType: "scoring_rule",
    entityId: id,
    metadata: patch,
  });

  return c.json({
    rule: {
      id: updated.id,
      slug: updated.slug,
      label: updated.label,
      points: updated.points,
      isActive: updated.isActive === "true",
      condition: JSON.parse(updated.condition),
    },
  });
});

/**
 * POST /api/scoring-rules/recompute — recalcule le score de tous les
 * prospects avec les règles actives (ADMIN uniquement). Équivalent du job
 * `npm run score:run`, déclenchable ici pour un retour immédiat depuis
 * l'écran Scoring. Idempotent (brief section 51).
 */
scoringRoutes.post("/recompute", requireAdmin, async (c) => {
  const db = createDbForEnv(c.env);

  const ruleRows = await db.select().from(schema.scoringRules).where(eq(schema.scoringRules.isActive, "true"));
  const rules: ScoringRuleDef[] = ruleRows.map((r) => ({
    id: r.id,
    slug: r.slug,
    label: r.label,
    points: r.points,
    isActive: true,
    condition: JSON.parse(r.condition) as RuleCondition,
  }));

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

  await db.insert(schema.auditLogs).values({
    userId: c.get("userId")!,
    action: "scoring.recompute",
    metadata: { total: rows.length, tierCounts, eligibleCount },
  });

  return c.json({ total: rows.length, tierCounts, eligibleCount });
});
