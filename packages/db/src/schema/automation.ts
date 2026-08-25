import { pgTable, pgEnum, uuid, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";

/** Définition d'un job planifié (import, scoring, envoi...) — brief section 47/51. */
export const automations = pgTable("automations", {
  id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  slug: text("slug").notNull().unique(), // ex: "kbo_import_daily", "scoring_daily", "send_daily"
  name: text("name").notNull(),
  cronSchedule: text("cron_schedule"), // référence documentaire ; l'ordonnancement réel est fait par GitHub Actions
  isEnabled: text("is_enabled").notNull().default("true"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const automationRunStatus = pgEnum("automation_run_status", [
  "running",
  "succeeded",
  "failed",
]);

/**
 * Une exécution d'automatisation. `lockKey` unique tant que le run est actif
 * empêche la double exécution (brief section 51 : idempotent, protégé
 * contre les doubles exécutions).
 */
export const automationRuns = pgTable(
  "automation_runs",
  {
    id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    automationId: uuid("automation_id").notNull().references(() => automations.id),
    lockKey: text("lock_key").notNull().unique(),
    status: automationRunStatus("status").notNull().default("running"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    attempt: text("attempt").notNull().default("1"),
    result: jsonb("result").$type<Record<string, unknown>>(),
    errorMessage: text("error_message"),
  },
  (t) => [
    index("automation_runs_automation_idx").on(t.automationId),
    index("automation_runs_status_idx").on(t.status),
  ],
);
