import "dotenv/config";
import { createNodeDb, schema } from "@myplv/db";
import { hashPassword } from "@myplv/auth";
import { eq } from "drizzle-orm";

/**
 * Crée (ou met à jour le mot de passe d') un utilisateur ADMIN initial.
 *
 * Usage :
 *   npm run seed:admin -- --email info@myplv.be --name "Pierre Bataille" --password "..."
 *
 * À lancer une seule fois par environnement, avec un mot de passe fort
 * généré (ex. `openssl rand -base64 24`) — pas un mot de passe mémorisable.
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const email = get("--email");
  const name = get("--name");
  const password = get("--password");
  if (!email || !name || !password) {
    console.error('Usage: npm run seed:admin -- --email <email> --name "<nom>" --password <mot de passe>');
    process.exit(1);
  }
  if (password.length < 12) {
    console.error("Le mot de passe doit faire au moins 12 caractères.");
    process.exit(1);
  }
  return { email: email.toLowerCase(), name, password };
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL manquant (voir .env.example).");
    process.exit(1);
  }
  const { email, name, password } = parseArgs();
  const db = createNodeDb(databaseUrl);
  const passwordHash = await hashPassword(password);

  const [existing] = await db.select().from(schema.users).where(eq(schema.users.email, email));

  if (existing) {
    await db.update(schema.users).set({ passwordHash, name, role: "admin", isActive: true }).where(eq(schema.users.id, existing.id));
    console.log(`Utilisateur admin mis à jour : ${email}`);
  } else {
    await db.insert(schema.users).values({ email, name, passwordHash, role: "admin" });
    console.log(`Utilisateur admin créé : ${email}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
