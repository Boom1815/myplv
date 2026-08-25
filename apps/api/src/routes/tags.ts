import { Hono } from "hono";
import { schema } from "@myplv/db";
import { eq, and } from "drizzle-orm";
import type { AppBindings } from "../env";
import { createDbForEnv } from "../db";
import { requireAuth, requireAdmin } from "../middleware/auth";

export const tagsRoutes = new Hono<AppBindings>();

tagsRoutes.use("*", requireAuth);

/** GET /api/tags — brief section 54, lecture ADMIN+READER. */
tagsRoutes.get("/", async (c) => {
  const db = createDbForEnv(c.env);
  const rows = await db.select().from(schema.tags).orderBy(schema.tags.label);
  return c.json({ data: rows });
});

/** POST /api/tags — création, ADMIN uniquement. */
tagsRoutes.post("/", requireAdmin, async (c) => {
  const db = createDbForEnv(c.env);
  const body = await c.req
    .json<{ label?: string; color?: string }>()
    .catch(() => ({}) as { label?: string; color?: string });

  const label = body.label?.trim();
  if (!label) return c.json({ error: "invalid_request", message: "label requis." }, 400);

  const [existing] = await db.select({ id: schema.tags.id }).from(schema.tags).where(eq(schema.tags.label, label));
  if (existing) return c.json({ error: "conflict", message: "Ce tag existe déjà." }, 409);

  const [created] = await db.insert(schema.tags).values({ label, color: body.color?.trim() || null }).returning();
  return c.json({ tag: created }, 201);
});

/** DELETE /api/tags/:id — ADMIN uniquement. Retire aussi les affectations existantes (cascade). */
tagsRoutes.delete("/:id", requireAdmin, async (c) => {
  const db = createDbForEnv(c.env);
  const id = c.req.param("id");
  const [deleted] = await db.delete(schema.tags).where(eq(schema.tags.id, id)).returning();
  if (!deleted) return c.json({ error: "not_found" }, 404);
  return c.json({ ok: true });
});

/** POST /api/prospects/:prospectId/tags — affecter un tag à un prospect, ADMIN uniquement. */
tagsRoutes.post("/assign/:prospectId", requireAdmin, async (c) => {
  const db = createDbForEnv(c.env);
  const prospectId = c.req.param("prospectId");
  const body = await c.req.json<{ tagId?: string }>().catch(() => ({}) as { tagId?: string });
  if (!body.tagId) return c.json({ error: "invalid_request", message: "tagId requis." }, 400);

  await db.insert(schema.prospectTags).values({ prospectId, tagId: body.tagId }).onConflictDoNothing();
  return c.json({ ok: true }, 201);
});

/** DELETE /api/prospects/:prospectId/tags/:tagId — retirer un tag d'un prospect, ADMIN uniquement. */
tagsRoutes.delete("/assign/:prospectId/:tagId", requireAdmin, async (c) => {
  const db = createDbForEnv(c.env);
  const prospectId = c.req.param("prospectId");
  const tagId = c.req.param("tagId");

  await db
    .delete(schema.prospectTags)
    .where(and(eq(schema.prospectTags.prospectId, prospectId), eq(schema.prospectTags.tagId, tagId)));

  return c.json({ ok: true });
});
