import { Hono } from "hono";
import { setCookie, deleteCookie, getCookie } from "hono/cookie";
import { createDbForEnv } from "../db";
import { schema } from "@myplv/db";
import { eq } from "drizzle-orm";
import type { AppBindings } from "../env";
import { verifyPassword } from "@myplv/auth";
import { createSession, destroySessionByToken } from "../lib/session";
import { isLoginRateLimited, recordLoginAttempt } from "../lib/rate-limit";

export const authRoutes = new Hono<AppBindings>();

authRoutes.post("/login", async (c) => {
  const body = await c.req
    .json<{ email?: string; password?: string }>()
    .catch(() => ({}) as { email?: string; password?: string });
  const email = body.email?.trim().toLowerCase();
  const password = body.password;

  if (!email || !password) {
    return c.json({ error: "invalid_request", message: "Email et mot de passe requis." }, 400);
  }

  const db = createDbForEnv(c.env);
  const ipAddress = c.req.header("cf-connecting-ip") ?? c.req.header("x-forwarded-for") ?? "unknown";

  if (await isLoginRateLimited(db, email, ipAddress)) {
    return c.json(
      { error: "rate_limited", message: "Trop de tentatives. Réessaie dans quelques minutes." },
      429,
    );
  }

  const rows = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
  const user = rows[0];

  const passwordOk = user ? await verifyPassword(password, user.passwordHash) : false;

  if (!user || !user.isActive || !passwordOk) {
    await recordLoginAttempt(db, email, ipAddress, false);
    return c.json({ error: "invalid_credentials", message: "Identifiants invalides." }, 401);
  }

  await recordLoginAttempt(db, email, ipAddress, true);
  await db.update(schema.users).set({ lastLoginAt: new Date() }).where(eq(schema.users.id, user.id));

  const ttlHours = Number(c.env.SESSION_TTL_HOURS || "168");
  const { token, expiresAt } = await createSession(db, user.id, ttlHours, {
    userAgent: c.req.header("user-agent"),
    ipAddress,
  });

  setCookie(c, c.env.SESSION_COOKIE_NAME || "myplv_session", token, {
    httpOnly: true,
    secure: true,
    // "Lax" en production (front et API sur le même domaine, app.myplv.be).
    // "None" uniquement pour un aperçu où front (Pages) et API (Workers)
    // vivent sur deux domaines distincts — jamais le défaut, à activer
    // explicitement via la variable d'environnement.
    sameSite: (c.env.SESSION_COOKIE_SAMESITE as "Lax" | "Strict" | "None" | undefined) || "Lax",
    path: "/",
    expires: expiresAt,
  });

  await db.insert(schema.auditLogs).values({
    userId: user.id,
    action: "auth.login",
    entityType: "user",
    entityId: user.id,
  });

  return c.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});

authRoutes.post("/logout", async (c) => {
  const cookieName = c.env.SESSION_COOKIE_NAME || "myplv_session";
  const token = getCookie(c, cookieName);
  if (token) {
    const db = createDbForEnv(c.env);
    await destroySessionByToken(db, token);
  }
  deleteCookie(c, cookieName, { path: "/" });
  return c.json({ ok: true });
});

authRoutes.get("/me", async (c) => {
  const userId = c.get("userId");
  if (!userId) {
    return c.json({ user: null });
  }
  return c.json({
    user: { id: userId, email: c.get("userEmail"), role: c.get("userRole") },
  });
});
