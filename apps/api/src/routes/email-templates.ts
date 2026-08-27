import { Hono } from "hono";
import { schema } from "@myplv/db";
import { eq } from "drizzle-orm";
import { renderTemplate, TEMPLATE_VARIABLE_KEYS, findUnknownVariables, SAMPLE_VARIABLES } from "@myplv/email";
import type { AppBindings } from "../env";
import { createDbForEnv } from "../db";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { slugify } from "../lib/slugify";

export const emailTemplatesRoutes = new Hono<AppBindings>();

emailTemplatesRoutes.use("*", requireAuth);

/** GET /api/email-templates — lecture ADMIN+READER. */
emailTemplatesRoutes.get("/", async (c) => {
  const db = createDbForEnv(c.env);
  const rows = await db.select().from(schema.emailTemplates).orderBy(schema.emailTemplates.name);
  return c.json({ data: rows, availableVariables: TEMPLATE_VARIABLE_KEYS });
});

emailTemplatesRoutes.get("/:id", async (c) => {
  const db = createDbForEnv(c.env);
  const [row] = await db.select().from(schema.emailTemplates).where(eq(schema.emailTemplates.id, c.req.param("id")));
  if (!row) return c.json({ error: "not_found" }, 404);

  return c.json({
    template: row,
    preview: {
      subject: renderTemplate(row.subject, SAMPLE_VARIABLES),
      bodyHtml: renderTemplate(row.bodyHtml, SAMPLE_VARIABLES),
    },
    unknownVariables: [
      ...findUnknownVariables(row.subject, TEMPLATE_VARIABLE_KEYS),
      ...findUnknownVariables(row.bodyHtml, TEMPLATE_VARIABLE_KEYS),
    ],
  });
});

/** POST /api/email-templates — ADMIN uniquement. Le contenu reste rédigé par un humain. */
emailTemplatesRoutes.post("/", requireAdmin, async (c) => {
  const db = createDbForEnv(c.env);
  const body = await c.req
    .json<{ name?: string; subject?: string; bodyHtml?: string }>()
    .catch(() => ({}) as { name?: string; subject?: string; bodyHtml?: string });

  const name = body.name?.trim();
  const subject = body.subject?.trim();
  const bodyHtml = body.bodyHtml?.trim();
  if (!name || !subject || !bodyHtml) {
    return c.json({ error: "invalid_request", message: "name, subject et bodyHtml sont requis." }, 400);
  }

  const [created] = await db
    .insert(schema.emailTemplates)
    .values({ slug: slugify(name) + "_" + Date.now().toString(36), name, subject, bodyHtml })
    .returning();

  return c.json({ template: created }, 201);
});

emailTemplatesRoutes.patch("/:id", requireAdmin, async (c) => {
  const db = createDbForEnv(c.env);
  const id = c.req.param("id");
  const body = await c.req
    .json<{ name?: string; subject?: string; bodyHtml?: string }>()
    .catch(() => ({}) as { name?: string; subject?: string; bodyHtml?: string });

  const patch: Record<string, string> = {};
  if (body.name?.trim()) patch.name = body.name.trim();
  if (body.subject?.trim()) patch.subject = body.subject.trim();
  if (body.bodyHtml?.trim()) patch.bodyHtml = body.bodyHtml.trim();
  if (Object.keys(patch).length === 0) return c.json({ error: "invalid_request", message: "Rien à modifier." }, 400);

  const [updated] = await db
    .update(schema.emailTemplates)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(schema.emailTemplates.id, id))
    .returning();
  if (!updated) return c.json({ error: "not_found" }, 404);
  return c.json({ template: updated });
});

emailTemplatesRoutes.delete("/:id", requireAdmin, async (c) => {
  const db = createDbForEnv(c.env);
  const [deleted] = await db.delete(schema.emailTemplates).where(eq(schema.emailTemplates.id, c.req.param("id"))).returning();
  if (!deleted) return c.json({ error: "not_found" }, 404);
  return c.json({ ok: true });
});
