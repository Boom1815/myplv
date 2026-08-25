import { Hono } from "hono";
import { schema } from "@myplv/db";
import { eq } from "drizzle-orm";
import type { AppBindings } from "../env";
import { createDbForEnv } from "../db";
import { requireAuth, requireAdmin } from "../middleware/auth";

export const geoZonesRoutes = new Hono<AppBindings>();

geoZonesRoutes.use("*", requireAuth);

/**
 * GET /api/geographic-zones — brief section 22. La couverture par défaut
 * (Bruxelles-Capitale, Brabant wallon, Hainaut, Namur) reste pilotée par
 * plage de code postal côté import (donnée publique stable, voir
 * packages/importer). Cette table sert d'exceptions explicites :
 * `isActive: false` exclut un code postal normalement dans le périmètre,
 * `isActive: true` en ajoute un en dehors — c'est le mécanisme
 * "exclusions, zones personnalisées" du brief, sans prétendre reconstituer
 * ici la liste exhaustive des ~1100 codes postaux belges.
 */
geoZonesRoutes.get("/", async (c) => {
  const db = createDbForEnv(c.env);
  const rows = await db.select().from(schema.geographicZones).orderBy(schema.geographicZones.postalCode);
  return c.json({ data: rows });
});

geoZonesRoutes.post("/", requireAdmin, async (c) => {
  const db = createDbForEnv(c.env);
  const body = await c.req
    .json<{ postalCode?: string; municipality?: string; province?: string; region?: string; isActive?: boolean }>()
    .catch(() => ({}) as Record<string, never>);

  const postalCode = body.postalCode?.trim();
  const province = body.province?.trim();
  const region = body.region?.trim();

  if (!postalCode || !province || !region) {
    return c.json({ error: "invalid_request", message: "postalCode, province et region sont requis." }, 400);
  }

  const [created] = await db
    .insert(schema.geographicZones)
    .values({
      postalCode,
      municipality: body.municipality?.trim() || postalCode,
      province,
      region,
      isActive: body.isActive ?? true,
    })
    .onConflictDoUpdate({
      target: schema.geographicZones.postalCode,
      set: {
        municipality: body.municipality?.trim() || postalCode,
        province,
        region,
        isActive: body.isActive ?? true,
      },
    })
    .returning();

  await db.insert(schema.auditLogs).values({
    userId: c.get("userId")!,
    action: "geographic_zone.upsert",
    entityType: "geographic_zone",
    entityId: created.id,
    metadata: { postalCode, province, isActive: created.isActive },
  });

  return c.json({ zone: created }, 201);
});

geoZonesRoutes.delete("/:id", requireAdmin, async (c) => {
  const db = createDbForEnv(c.env);
  const id = c.req.param("id");
  const [deleted] = await db.delete(schema.geographicZones).where(eq(schema.geographicZones.id, id)).returning();
  if (!deleted) return c.json({ error: "not_found" }, 404);

  await db.insert(schema.auditLogs).values({
    userId: c.get("userId")!,
    action: "geographic_zone.delete",
    entityType: "geographic_zone",
    entityId: id,
    metadata: { postalCode: deleted.postalCode },
  });

  return c.json({ ok: true });
});
