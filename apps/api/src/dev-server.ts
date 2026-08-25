import "dotenv/config";
import { serve } from "@hono/node-server";
import app from "./index";

/**
 * Serveur Node local, pour développer sans wrangler. En production, la même
 * app Hono (`src/index.ts`) est déployée sur Cloudflare Workers.
 */
const requiredEnv = ["DATABASE_URL", "AUTH_SECRET", "APP_URL", "SESSION_COOKIE_NAME", "SESSION_TTL_HOURS"];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.warn(`⚠ Variable d'environnement ${key} manquante (voir .env.example).`);
  }
}

// En Node local, on parle à Postgres en TCP standard (driver `pg`) plutôt
// qu'en HTTP Neon — voir src/db.ts. Ignoré en production (Workers).
process.env.DB_DRIVER ??= "node-postgres";

// Hono lit c.env — en local (non-Workers) on lui fournit process.env comme bindings.
const port = Number(process.env.PORT) || 8787;

serve(
  {
    fetch: (request) => app.fetch(request, process.env as unknown as Record<string, string>),
    port,
  },
  (info) => {
    console.log(`myplv-api en écoute sur http://localhost:${info.port}`);
  },
);
