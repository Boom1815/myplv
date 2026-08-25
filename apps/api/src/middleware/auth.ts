import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import { createDbForEnv } from "../db";
import { getUserFromToken } from "../lib/session";
import type { AppBindings } from "../env";

/** Résout la session à partir du cookie et l'expose via c.get("userId")/c.get("userRole"). Ne bloque pas — pour ça voir requireAuth. */
export const attachSession = createMiddleware<AppBindings>(async (c, next) => {
  const cookieName = c.env.SESSION_COOKIE_NAME || "myplv_session";
  const token = getCookie(c, cookieName);
  if (token) {
    const db = createDbForEnv(c.env);
    const user = await getUserFromToken(db, token);
    if (user) {
      c.set("userId", user.id);
      c.set("userRole", user.role);
      c.set("userEmail", user.email);
    }
  }
  await next();
});

export const requireAuth = createMiddleware<AppBindings>(async (c, next) => {
  if (!c.get("userId")) {
    return c.json({ error: "unauthorized", message: "Authentification requise." }, 401);
  }
  await next();
});

/** ADMIN uniquement — envoi, suppression, modification des règles/campagnes/automatisations/paramètres (brief section 15). */
export const requireAdmin = createMiddleware<AppBindings>(async (c, next) => {
  if (!c.get("userId")) {
    return c.json({ error: "unauthorized", message: "Authentification requise." }, 401);
  }
  if (c.get("userRole") !== "admin") {
    return c.json({ error: "forbidden", message: "Réservé aux administrateurs." }, 403);
  }
  await next();
});
