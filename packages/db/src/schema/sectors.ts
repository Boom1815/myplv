import { pgTable, uuid, text, integer, timestamp, index, unique } from "drizzle-orm/pg-core";

/** Codes NACE-BEL officiels (nomenclature en vigueur depuis le 01/01/2025). */
export const naceCodes = pgTable(
  "nace_codes",
  {
    code: text("code").primaryKey(),
    labelFr: text("label_fr").notNull(),
    labelNl: text("label_nl"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

/**
 * Secteurs métier compréhensibles (Horeca, construction, immobilier…) —
 * brief section 23. Chaque secteur est relié à un ou plusieurs codes NACE
 * (souvent par préfixe de division/groupe) via sectorNaceRules.
 */
export const sectors = pgTable("sectors", {
  id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  slug: text("slug").notNull().unique(),
  label: text("label").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Règle de rattachement NACE -> secteur. `nacePrefix` est comparé en début
 * de code NACE (ex. "43" = tous les travaux de construction spécialisés).
 * `priority` départage les préfixes qui se chevauchent (le plus long/le plus
 * spécifique gagne à priority égale).
 */
export const sectorNaceRules = pgTable(
  "sector_nace_rules",
  {
    id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    sectorId: uuid("sector_id").notNull().references(() => sectors.id, { onDelete: "cascade" }),
    nacePrefix: text("nace_prefix").notNull(),
    priority: integer("priority").notNull().default(0),
  },
  (t) => [
    unique("sector_nace_rules_sector_prefix_unique").on(t.sectorId, t.nacePrefix),
    index("sector_nace_rules_prefix_idx").on(t.nacePrefix),
  ],
);
