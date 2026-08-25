import { Hono } from "hono";
import { schema } from "@myplv/db";
import { eq } from "drizzle-orm";
import { verifyUnsubscribeToken } from "@myplv/email";
import type { AppBindings } from "../env";
import { createDbForEnv } from "../db";

export const unsubscribeRoutes = new Hono<AppBindings>();

/**
 * Page publique — brief section 41. Volontairement PAS derrière
 * `requireAuth` : un destinataire qui clique depuis son client email n'a
 * pas de session. Le lien clic-unique (GET) est la convention standard de
 * l'emailing — aucun client email ne peut soumettre un formulaire POST
 * depuis un lien.
 */
function page(title: string, message: string, tone: "good" | "risk" = "good"): string {
  const color = tone === "good" ? "#3E7A54" : "#AE3B34";
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>${title}</title>
<style>
  body{font-family:system-ui,sans-serif;background:#EEF0EC;color:#1C2230;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:24px;}
  .card{max-width:420px;background:#fff;border:1px solid #D8DCD3;border-radius:12px;padding:32px 28px;text-align:center;}
  h1{font-size:20px;margin:0 0 12px;color:${color};}
  p{font-size:14.5px;color:#4B5566;line-height:1.5;margin:0;}
</style></head>
<body><div class="card"><h1>${title}</h1><p>${message}</p></div></body></html>`;
}

unsubscribeRoutes.get("/", async (c) => {
  const email = c.req.query("email")?.trim().toLowerCase();
  const token = c.req.query("token");

  if (!email || !token) {
    return c.html(page("Lien invalide", "Ce lien de désinscription est incomplet ou incorrect."), 400);
  }

  const valid = await verifyUnsubscribeToken(email, token, c.env.AUTH_SECRET);
  if (!valid) {
    return c.html(page("Lien invalide", "Ce lien de désinscription n'a pas pu être vérifié."), 400);
  }

  const db = createDbForEnv(c.env);
  await db
    .insert(schema.suppressionList)
    .values({ email, reason: "unsubscribe" })
    .onConflictDoNothing();

  // Un désinscrit ne doit plus jamais figurer comme prospect éligible (brief section 41/56).
  const [company] = await db.select({ id: schema.companies.id }).from(schema.companies).where(eq(schema.companies.email, email));
  if (company) {
    await db
      .update(schema.prospects)
      .set({ isEligibleForEmail: "false", status: "ne_plus_contacter", updatedAt: new Date() })
      .where(eq(schema.prospects.companyId, company.id));
  }

  await db.insert(schema.auditLogs).values({
    action: "email.unsubscribe",
    entityType: "suppression_list",
    metadata: { email },
  });

  return c.html(page("Désinscription confirmée", `${email} ne recevra plus aucune campagne de MYPLV.`));
});
