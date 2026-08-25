import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema/index";

/**
 * Client Postgres compatible edge (Cloudflare Workers) et Node — le driver
 * HTTP de Neon fonctionne dans les deux environnements sans TCP direct, ce
 * qui évite de dépendre d'un runtime spécifique (brief section 62 :
 * abstractions interchangeables).
 */
export function createDb(databaseUrl: string) {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL manquant — voir .env.example");
  }
  const sql = neon(databaseUrl);
  return drizzle(sql, { schema });
}

export type Database = ReturnType<typeof createDb>;
export * as schema from "./schema/index";
