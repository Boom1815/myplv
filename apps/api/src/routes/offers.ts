import { Hono } from "hono";
import { schema } from "@myplv/db";
import { eq } from "drizzle-orm";
import type { AppBindings } from "../env";
import { createDbForEnv } from "../db";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { slugify } from "../lib/slugify";

export const offersRoutes = new Hono<AppBindings>();

offersRoutes.use("*", requireAuth);

/** GET /api/offers — brief section 30, lecture ADMIN+READER. */
offersRoutes.get("/", async (c) => {
  const db = createDbForEnv(c.env);
  const rows = await db.select().from(schema.offers).orderBy(schema.offers.name);
  return c.json({ data: rows });
});

offersRoutes.get("/:id", async (c) => {
  const db = createDbForEnv(c.env);
  const [row] = await db.select().from(schema.offers).where(eq(schema.offers.id, c.req.param("id")));
  if (!row) return c.json({ error: "not_found" }, 404);
  return c.json({ offer: row });
});

/** POST /api/offers — ADMIN uniquement. Le contenu (argumentaire, avantage, CTA) reste rédigé par un humain — jamais généré automatiquement. */
offersRoutes.post("/", requireAdmin, async (c) => {
  const db = createDbForEnv(c.env);
  const body = await c.req
    .json<{
      name?: string;
      description?: string;
      sectorId?: string;
      pitch?: string;
      advantage?: string;
      ctaLabel?: string;
      landingUrl?: string;
    }>()
    .catch(() => ({}) as Record<string, never>);

  const name = body.name?.trim();
  if (!name) return c.json({ error: "invalid_request", message: "name requis." }, 400);

  const [created] = await db
    .insert(schema.offers)
    .values({
      slug: slugify(name) + "_" + Date.now().toString(36),
      name,
      description: body.description?.trim() || null,
      sectorId: body.sectorId || null,
      pitch: body.pitch?.trim() || null,
      advantage: body.advantage?.trim() || null,
      ctaLabel: body.ctaLabel?.trim() || null,
      landingUrl: body.landingUrl?.trim() || null,
    })
    .returning();

  return c.json({ offer: created }, 201);
});

offersRoutes.patch("/:id", requireAdmin, async (c) => {
  const db = createDbForEnv(c.env);
  const id = c.req.param("id");
  const body = await c.req
    .json<Record<string, string | undefined>>()
    .catch(() => ({}) as Record<string, string | undefined>);

  const allowed = ["name", "description", "sectorId", "pitch", "advantage", "ctaLabel", "landingUrl"] as const;
  const patch: Record<string, string | null> = {};
  for (const key of allowed) {
    if (body[key] !== undefined) patch[key] = body[key]?.trim() || null;
  }
  if (Object.keys(patch).length === 0) return c.json({ error: "invalid_request", message: "Rien à modifier." }, 400);

  const [updated] = await db.update(schema.offers).set(patch).where(eq(schema.offers.id, id)).returning();
  if (!updated) return c.json({ error: "not_found" }, 404);
  return c.json({ offer: updated });
});

offersRoutes.delete("/:id", requireAdmin, async (c) => {
  const db = createDbForEnv(c.env);
  const [deleted] = await db.delete(schema.offers).where(eq(schema.offers.id, c.req.param("id"))).returning();
  if (!deleted) return c.json({ error: "not_found" }, 404);
  return c.json({ ok: true });
});
