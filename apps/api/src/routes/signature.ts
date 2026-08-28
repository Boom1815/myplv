import { Hono } from "hono";
import { schema } from "@myplv/db";
import { eq } from "drizzle-orm";
import { SIGNATURE_SETTINGS_KEY } from "@myplv/email";
import type { AppBindings } from "../env";
import { createDbForEnv } from "../db";
import { requireAuth, requireAdmin } from "../middleware/auth";

export const signatureRoutes = new Hono<AppBindings>();

signatureRoutes.use("*", requireAuth);

/**
 * Signature email — une seule, globale, ajoutée automatiquement à la fin de
 * chaque campagne envoyée (voir campaigns.ts), entre le corps du template
 * et le pied de page de désinscription. Stockée dans la table générique
 * `settings` (clé/valeur) plutôt qu'une table dédiée : un seul enregistrement,
 * même format `bodyHtml` (blocs sérialisés) que les templates email.
 */
type SignatureValue = { bodyHtml: string };

function isSignatureValue(v: unknown): v is SignatureValue {
  return typeof v === "object" && v !== null && typeof (v as { bodyHtml?: unknown }).bodyHtml === "string";
}

/** GET /api/signature — lecture ADMIN+READER. bodyHtml vide si jamais configurée. */
signatureRoutes.get("/", async (c) => {
  const db = createDbForEnv(c.env);
  const [row] = await db.select().from(schema.settings).where(eq(schema.settings.key, SIGNATURE_SETTINGS_KEY));
  const bodyHtml = row && isSignatureValue(row.value) ? row.value.bodyHtml : "";
  return c.json({ bodyHtml, updatedAt: row?.updatedAt ?? null });
});

/** PUT /api/signature — ADMIN uniquement. bodyHtml vide = désactive la signature (elle n'est plus ajoutée aux envois). */
signatureRoutes.put("/", requireAdmin, async (c) => {
  const db = createDbForEnv(c.env);
  const body = await c.req.json<{ bodyHtml?: string }>().catch(() => ({}) as { bodyHtml?: string });
  const bodyHtml = (body.bodyHtml ?? "").trim();
  const value: SignatureValue = { bodyHtml };

  await db
    .insert(schema.settings)
    .values({ key: SIGNATURE_SETTINGS_KEY, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value, updatedAt: new Date() } });

  return c.json({ bodyHtml });
});
