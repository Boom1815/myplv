import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema/index";

/**
 * Client Postgres "classique" (TCP, driver `pg`) — pour tout ce qui tourne
 * en Node pur : scripts d'import, seeds, migrations, GitHub Actions. Neon
 * (comme n'importe quel Postgres) supporte le protocole standard, donc ce
 * client fonctionne aussi bien en local (Postgres/Docker) qu'en production.
 *
 * Le client HTTP (`createDb`, dans client.ts) reste réservé à l'API
 * déployée sur Cloudflare Workers, seul environnement qui ne permet pas de
 * sockets TCP directs.
 */
export function createNodeDb(databaseUrl: string) {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL manquant — voir .env.example");
  }
  const pool = new Pool({ connectionString: databaseUrl });
  return drizzle(pool, { schema });
}

export type NodeDatabase = ReturnType<typeof createNodeDb>;
