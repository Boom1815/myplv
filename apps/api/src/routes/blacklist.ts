import { Hono } from "hono";
import { schema } from "@myplv/db";
import { desc, eq } from "drizzle-orm";
import type { AppBindings } from "../env";
import { createDbForEnv } from "../db";
import { requireAuth, requireAdmin } from "../middleware/auth";

export const blacklistRoutes = new Hono<AppBindings>();

blacklistRoutes.use("*", requireAuth);

const VALID_SCOPES = new Set([
  "nace_code",
  "sector",
  "keyword",
  "municipality",
  "company",
  "email",
  "domain",
  "contact",
]);

/** GET /api/blacklist — lecture pour ADMIN et READER (brief section 24). */
blacklistRoutes.get("/", async (c) => {
  const db = createDbForEnv(c.env);
  const rows = await db.select().from(schema.blacklists).orderBy(desc(schema.blacklists.createdAt));
  return c.json({ data: rows });
});

/** POST /api/blacklist — ajout d'une règle, ADMIN uniquement (brief section 15/24). */
blacklistRoutes.post("/", requireAdmin, async (c) => {
  const db = createDbForEnv(c.env);
  const body = await c.req
    .json<{ scope?: string; value?: string; reason?: string }>()
    .catch(() => ({}) as { scope?: string; value?: string; reason?: string });

  const scope = body.scope?.trim();
  const value = body.value?.trim();

  if (!scope || !VALID_SCOPES.has(scope)) {
    return c.json({ error: "invalid_request", message: `scope invalide (attendu : ${[...VALID_SCOPES].join(", ")}).` }, 400);
  }
  if (!value) {
    return c.json({ error: "invalid_request", message: "value requis." }, 400);
  }

  const [created] = await db
    .insert(schema.blacklists)
    .values({
      scope: scope as (typeof schema.blacklistScope.enumValues)[number],
      value,
      reason: body.reason?.trim() || null,
      createdByUserId: c.get("userId")!,
    })
    .returning();

  await db.insert(schema.auditLogs).values({
    userId: c.get("userId")!,
    action: "blacklist.create",
    entityType: "blacklist",
    entityId: created.id,
    metadata: { scope, value },
  });

  return c.json({ rule: created }, 201);
});

/** DELETE /api/blacklist/:id — ADMIN uniquement. Une entrée retirée redevient éligible dès le prochain import. */
blacklistRoutes.delete("/:id", requireAdmin, async (c) => {
  const db = createDbForEnv(c.env);
  const id = c.req.param("id");

  const [deleted] = await db.delete(schema.blacklists).where(eq(schema.blacklists.id, id)).returning();
  if (!deleted) return c.json({ error: "not_found" }, 404);

  await db.insert(schema.auditLogs).values({
    userId: c.get("userId")!,
    action: "blacklist.delete",
    entityType: "blacklist",
    entityId: id,
    metadata: { scope: deleted.scope, value: deleted.value },
  });

  return c.json({ ok: true });
});
