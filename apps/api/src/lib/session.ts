import type { Database } from "@myplv/db";
import { schema } from "@myplv/db";
import { eq } from "drizzle-orm";
import { randomToken, sha256Hex } from "@myplv/auth";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "reader";
};

export async function createSession(
  db: Database,
  userId: string,
  ttlHours: number,
  meta: { userAgent?: string; ipAddress?: string },
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomToken(32);
  const tokenHash = await sha256Hex(token);
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

  await db.insert(schema.sessions).values({
    userId,
    tokenHash,
    userAgent: meta.userAgent ?? null,
    ipAddress: meta.ipAddress ?? null,
    expiresAt,
  });

  return { token, expiresAt };
}

export async function getUserFromToken(db: Database, token: string): Promise<SessionUser | null> {
  if (!token) return null;
  const tokenHash = await sha256Hex(token);

  const rows = await db
    .select({
      sessionExpiresAt: schema.sessions.expiresAt,
      userId: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
      role: schema.users.role,
      isActive: schema.users.isActive,
    })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(eq(schema.sessions.tokenHash, tokenHash))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  if (!row.isActive) return null;
  if (row.sessionExpiresAt.getTime() < Date.now()) return null;

  return { id: row.userId, email: row.email, name: row.name, role: row.role };
}

export async function destroySessionByToken(db: Database, token: string): Promise<void> {
  const tokenHash = await sha256Hex(token);
  await db.delete(schema.sessions).where(eq(schema.sessions.tokenHash, tokenHash));
}
