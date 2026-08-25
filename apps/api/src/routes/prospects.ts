import { Hono } from "hono";
import { schema } from "@myplv/db";
import { createDbForEnv } from "../db";
import { and, desc, eq, gte, ilike, inArray, or, sql, SQL } from "drizzle-orm";
import type { AppBindings } from "../env";
import { requireAuth } from "../middleware/auth";

export const prospectsRoutes = new Hono<AppBindings>();

prospectsRoutes.use("*", requireAuth);

const PAGE_SIZE_DEFAULT = 25;
const PAGE_SIZE_MAX = 100;

/**
 * GET /api/prospects — table filtrable/paginée (brief section 45).
 * Filtres supportés : province, secteur (sectorId), statut, score minimum,
 * recherche libre (nom entreprise / email).
 */
prospectsRoutes.get("/", async (c) => {
  const db = createDbForEnv(c.env);
  const q = c.req.query();

  const page = Math.max(1, Number(q.page) || 1);
  const pageSize = Math.min(PAGE_SIZE_MAX, Math.max(1, Number(q.pageSize) || PAGE_SIZE_DEFAULT));

  const conditions: SQL[] = [];
  if (q.province) conditions.push(eq(schema.companies.province, q.province));
  if (q.sectorId) conditions.push(eq(schema.companies.sectorId, q.sectorId));
  if (q.status) conditions.push(eq(schema.prospects.status, q.status as (typeof schema.prospectStatus.enumValues)[number]));
  if (q.scoreMin) conditions.push(gte(schema.prospects.score, Number(q.scoreMin)));
  if (q.search) {
    const term = `%${q.search}%`;
    conditions.push(or(ilike(schema.companies.name, term), ilike(schema.companies.email, term))!);
  }

  const where = conditions.length ? and(...conditions) : undefined;

  const baseQuery = db
    .select({
      id: schema.prospects.id,
      status: schema.prospects.status,
      score: schema.prospects.score,
      scoreTier: schema.prospects.scoreTier,
      isEligibleForEmail: schema.prospects.isEligibleForEmail,
      createdAt: schema.prospects.createdAt,
      companyId: schema.companies.id,
      companyName: schema.companies.name,
      enterpriseNumber: schema.companies.enterpriseNumber,
      email: schema.companies.email,
      phone: schema.companies.phone,
      website: schema.companies.website,
      municipality: schema.companies.municipality,
      province: schema.companies.province,
      postalCode: schema.companies.postalCode,
      primaryNaceCode: schema.companies.primaryNaceCode,
      sectorId: schema.companies.sectorId,
      collectedAt: schema.companies.collectedAt,
    })
    .from(schema.prospects)
    .innerJoin(schema.companies, eq(schema.companies.id, schema.prospects.companyId));

  const rows = await (where ? baseQuery.where(where) : baseQuery)
    .orderBy(desc(schema.prospects.score), desc(schema.prospects.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const countQuery = db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.prospects)
    .innerJoin(schema.companies, eq(schema.companies.id, schema.prospects.companyId));

  const [{ count: total }] = await (where ? countQuery.where(where) : countQuery);

  const tagsByProspect = new Map<string, Array<{ id: string; label: string; color: string | null }>>();
  if (rows.length > 0) {
    const tagRows = await db
      .select({
        prospectId: schema.prospectTags.prospectId,
        id: schema.tags.id,
        label: schema.tags.label,
        color: schema.tags.color,
      })
      .from(schema.prospectTags)
      .innerJoin(schema.tags, eq(schema.tags.id, schema.prospectTags.tagId))
      .where(
        inArray(
          schema.prospectTags.prospectId,
          rows.map((r) => r.id),
        ),
      );
    for (const t of tagRows) {
      const list = tagsByProspect.get(t.prospectId) ?? [];
      list.push({ id: t.id, label: t.label, color: t.color });
      tagsByProspect.set(t.prospectId, list);
    }
  }

  return c.json({
    data: rows.map((r) => ({ ...r, tags: tagsByProspect.get(r.id) ?? [] })),
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  });
});

prospectsRoutes.get("/:id", async (c) => {
  const db = createDbForEnv(c.env);
  const id = c.req.param("id");

  const rows = await db
    .select()
    .from(schema.prospects)
    .innerJoin(schema.companies, eq(schema.companies.id, schema.prospects.companyId))
    .where(eq(schema.prospects.id, id))
    .limit(1);

  const row = rows[0];
  if (!row) return c.json({ error: "not_found" }, 404);

  const contacts = await db.select().from(schema.contacts).where(eq(schema.contacts.companyId, row.companies.id));

  return c.json({ prospect: row.prospects, company: row.companies, contacts });
});
