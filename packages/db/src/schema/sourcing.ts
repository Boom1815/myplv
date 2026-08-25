import { pgTable, pgEnum, uuid, text, integer, timestamp, jsonb, index } from "drizzle-orm/pg-core";

export const dataImportStatus = pgEnum("data_import_status", [
  "pending",
  "running",
  "succeeded",
  "failed",
]);

/** Source de données (KBO Open Data, CBE API, import CSV manuel...) — brief section 62. */
export const dataSources = pgTable("data_sources", {
  id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  adapterType: text("adapter_type").notNull(), // ex: "kbo_open_data", "csv_manual", "cbe_api"
  isEnabled: text("is_enabled").notNull().default("true"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Une exécution d'import (fichier KBO, upload CSV manuel...). Journalisée, idempotente. */
export const dataImports = pgTable(
  "data_imports",
  {
    id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    dataSourceId: uuid("data_source_id").notNull().references(() => dataSources.id),
    status: dataImportStatus("status").notNull().default("pending"),
    fileName: text("file_name"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    recordsSeen: integer("records_seen").notNull().default(0),
    recordsCreated: integer("records_created").notNull().default(0),
    recordsUpdated: integer("records_updated").notNull().default(0),
    recordsSkipped: integer("records_skipped").notNull().default(0),
    duplicatesFound: integer("duplicates_found").notNull().default(0),
    errorMessage: text("error_message"),
    summary: jsonb("summary").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("data_imports_source_idx").on(t.dataSourceId),
    index("data_imports_status_idx").on(t.status),
    index("data_imports_created_at_idx").on(t.createdAt),
  ],
);

export const blacklistScope = pgEnum("blacklist_scope", [
  "nace_code",
  "sector",
  "keyword",
  "municipality",
  "company",
  "email",
  "domain",
  "contact",
]);

/** Liste noire configurable — brief section 24. Une entrée blacklistée exclut automatiquement du pipeline (jamais intégrée à une campagne). */
export const blacklists = pgTable(
  "blacklists",
  {
    id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    scope: blacklistScope("scope").notNull(),
    value: text("value").notNull(),
    reason: text("reason"),
    createdByUserId: uuid("created_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("blacklists_scope_value_idx").on(t.scope, t.value)],
);
