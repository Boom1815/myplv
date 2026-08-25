import { createDb as createNeonDb, createNodeDb, type Database } from "@myplv/db";

/**
 * Choix du driver Postgres selon l'environnement d'exécution :
 * - Cloudflare Workers (production) : driver HTTP Neon, seul compatible
 *   avec un runtime sans sockets TCP.
 * - Node local (`dev-server.ts`, tests) : driver `pg` standard, pour
 *   pouvoir développer contre un Postgres local sans dépendre d'un compte
 *   Neon. Le schéma et les requêtes Drizzle sont strictement les mêmes des
 *   deux côtés — seul le transport change.
 *
 * `DB_DRIVER=node-postgres` n'est positionné qu'en développement local
 * (voir dev-server.ts) ; absent, le driver Neon HTTP est utilisé.
 */
export function createDbForEnv(env: { DATABASE_URL: string; DB_DRIVER?: string }): Database {
  if (env.DB_DRIVER === "node-postgres") {
    return createNodeDb(env.DATABASE_URL) as unknown as Database;
  }
  return createNeonDb(env.DATABASE_URL);
}
