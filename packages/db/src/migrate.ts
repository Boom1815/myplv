import "dotenv/config";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

/**
 * Applique les migrations générées (`npm run db:generate`) sur la base
 * pointée par DATABASE_URL — fonctionne contre n'importe quel Postgres
 * (local, Docker, Neon) via le driver TCP standard.
 */
async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL manquant (voir .env.example).");
    process.exit(1);
  }
  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool);
  console.log("Application des migrations...");
  await migrate(db, { migrationsFolder: "./migrations" });
  console.log("Migrations appliquées.");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
