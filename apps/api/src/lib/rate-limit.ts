import type { Database } from "@myplv/db";
import { schema } from "@myplv/db";
import { and, eq, gt, sql } from "drizzle-orm";

const WINDOW_MINUTES = 15;
const MAX_ATTEMPTS_PER_WINDOW = 10;

/** Protection brute force simple — brief section 16 : rate limiting + protection brute force. */
export async function isLoginRateLimited(db: Database, email: string, ipAddress: string): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.loginAttempts)
    .where(
      and(
        eq(schema.loginAttempts.success, false),
        gt(schema.loginAttempts.createdAt, since),
        sql`(${schema.loginAttempts.email} = ${email} or ${schema.loginAttempts.ipAddress} = ${ipAddress})`,
      ),
    );

  return count >= MAX_ATTEMPTS_PER_WINDOW;
}

export async function recordLoginAttempt(
  db: Database,
  email: string,
  ipAddress: string,
  success: boolean,
): Promise<void> {
  await db.insert(schema.loginAttempts).values({ email, ipAddress, success });
}
