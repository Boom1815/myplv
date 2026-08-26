import { Hono } from "hono";
import { sql } from "drizzle-orm";
import type { AppBindings } from "../env";
import { createDbForEnv } from "../db";

export const healthRoutes = new Hono<AppBindings>();

healthRoutes.get("/", (c) => c.json({ status: "ok", service: "myplv-api", time: new Date().toISOString() }));

/**
 * Diagnostic temporaire (à retirer une fois le login en production validé) :
 * tente une requête triviale contre DATABASE_URL et renvoie l'erreur exacte
 * au lieu de la masquer — pour identifier la cause d'un 500 sur /auth/login
 * sans avoir besoin des logs du dashboard Cloudflare.
 */
healthRoutes.get("/db", async (c) => {
  try {
    const db = createDbForEnv(c.env);
    const rows = await db.execute(sql`select 1 as ok`);
    return c.json({ status: "ok", result: rows });
  } catch (err) {
    return c.json(
      {
        status: "error",
        message: err instanceof Error ? err.message : String(err),
        name: err instanceof Error ? err.name : undefined,
        stack: err instanceof Error ? err.stack : undefined,
      },
      500,
    );
  }
});
