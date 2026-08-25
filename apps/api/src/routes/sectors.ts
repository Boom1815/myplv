import { Hono } from "hono";
import { schema } from "@myplv/db";
import { eq } from "drizzle-orm";
import type { AppBindings } from "../env";
import { createDbForEnv } from "../db";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { slugify } from "../lib/slugify";

export const sectorsRoutes = new Hono<AppBindings>();

sectorsRoutes.use("*", requireAuth);

/** GET /api/sectors — secteurs avec leurs règles NACE (brief section 23), lecture ADMIN+READER. */
sectorsRoutes.get("/", async (c) => {
  const db = createDbForEnv(c.env);
  const [sectors, rules] = await Promise.all([
    db.select().from(schema.sectors).orderBy(schema.sectors.label),
    db.select().from(schema.sectorNaceRules),
  ]);

  return c.json({
    data: sectors.map((s) => ({
      ...s,
      naceRules: rules.filter((r) => r.sectorId === s.id),
    })),
  });
});

/** POST /api/sectors — nouveau secteur, ADMIN uniquement. */
sectorsRoutes.post("/", requireAdmin, async (c) => {
  const db = createDbForEnv(c.env);
  const body = await c.req
    .json<{ label?: string; description?: string }>()
    .catch(() => ({}) as { label?: string; description?: string });

  const label = body.label?.trim();
  if (!label) return c.json({ error: "invalid_request", message: "label requis." }, 400);

  const slug = slugify(label);
  const [existing] = await db.select({ id: schema.sectors.id }).from(schema.sectors).where(eq(schema.sectors.slug, slug));
  if (existing) return c.json({ error: "conflict", message: "Un secteur avec ce nom existe déjà." }, 409);

  const [created] = await db.insert(schema.sectors).values({ slug, label, description: body.description?.trim() || null }).returning();
  return c.json({ sector: { ...created, naceRules: [] } }, 201);
});

sectorsRoutes.delete("/:id", requireAdmin, async (c) => {
  const db = createDbForEnv(c.env);
  const id = c.req.param("id");
  const [deleted] = await db.delete(schema.sectors).where(eq(schema.sectors.id, id)).returning();
  if (!deleted) return c.json({ error: "not_found" }, 404);
  return c.json({ ok: true });
});

/** POST /api/sectors/:id/nace-rules — associe un préfixe NACE au secteur, ADMIN uniquement. */
sectorsRoutes.post("/:id/nace-rules", requireAdmin, async (c) => {
  const db = createDbForEnv(c.env);
  const sectorId = c.req.param("id");
  const body = await c.req
    .json<{ nacePrefix?: string; priority?: number }>()
    .catch(() => ({}) as { nacePrefix?: string; priority?: number });

  const nacePrefix = body.nacePrefix?.trim();
  if (!nacePrefix || !/^\d{2,5}$/.test(nacePrefix)) {
    return c.json({ error: "invalid_request", message: "nacePrefix doit être un préfixe numérique (2 à 5 chiffres)." }, 400);
  }

  const [created] = await db
    .insert(schema.sectorNaceRules)
    .values({ sectorId, nacePrefix, priority: body.priority ?? 0 })
    .onConflictDoNothing()
    .returning();

  if (!created) return c.json({ error: "conflict", message: "Cette règle existe déjà pour ce secteur." }, 409);
  return c.json({ rule: created }, 201);
});

sectorsRoutes.delete("/:sectorId/nace-rules/:ruleId", requireAdmin, async (c) => {
  const db = createDbForEnv(c.env);
  const ruleId = c.req.param("ruleId");
  const [deleted] = await db.delete(schema.sectorNaceRules).where(eq(schema.sectorNaceRules.id, ruleId)).returning();
  if (!deleted) return c.json({ error: "not_found" }, 404);
  return c.json({ ok: true });
});
