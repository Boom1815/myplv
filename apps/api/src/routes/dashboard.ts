import { Hono } from "hono";
import { schema } from "@myplv/db";
import { desc, sql } from "drizzle-orm";
import type { AppBindings } from "../env";
import { createDbForEnv } from "../db";
import { requireAuth } from "../middleware/auth";

export const dashboardRoutes = new Hono<AppBindings>();

dashboardRoutes.use("*", requireAuth);

/** GET /api/dashboard — vue d'ensemble (brief section 44), lecture pour ADMIN et READER. */
dashboardRoutes.get("/", async (c) => {
  const db = createDbForEnv(c.env);

  const [byTier, byStatus, companyCounts, lastImport] = await Promise.all([
    db
      .select({ tier: schema.prospects.scoreTier, count: sql<number>`count(*)::int` })
      .from(schema.prospects)
      .groupBy(schema.prospects.scoreTier),
    db
      .select({ status: schema.prospects.status, count: sql<number>`count(*)::int` })
      .from(schema.prospects)
      .groupBy(schema.prospects.status),
    db
      .select({
        totalCompanies: sql<number>`count(*)::int`,
        withEmail: sql<number>`count(*) filter (where ${schema.companies.email} is not null)::int`,
      })
      .from(schema.companies),
    db
      .select()
      .from(schema.dataImports)
      .orderBy(desc(schema.dataImports.startedAt))
      .limit(1),
  ]);

  const [eligible] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.prospects)
    .where(sql`${schema.prospects.isEligibleForEmail} = 'true'`);

  return c.json({
    prospects: {
      total: byTier.reduce((sum, t) => sum + t.count, 0),
      byTier: Object.fromEntries(byTier.map((t) => [t.tier, t.count])),
      byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s.count])),
      eligibleForEmail: eligible?.count ?? 0,
    },
    companies: {
      total: companyCounts[0]?.totalCompanies ?? 0,
      withEmail: companyCounts[0]?.withEmail ?? 0,
    },
    lastImport: lastImport[0]
      ? {
          status: lastImport[0].status,
          startedAt: lastImport[0].startedAt,
          finishedAt: lastImport[0].finishedAt,
          recordsCreated: lastImport[0].recordsCreated,
          recordsUpdated: lastImport[0].recordsUpdated,
          recordsSkipped: lastImport[0].recordsSkipped,
        }
      : null,
  });
});
