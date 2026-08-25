import { pgTable, pgEnum, uuid, text, integer, timestamp, index, primaryKey } from "drizzle-orm/pg-core";
import { companies } from "./companies";

/** Statuts du cycle de vie d'un prospect — brief section 42. */
export const prospectStatus = pgEnum("prospect_status", [
  "nouveau",
  "a_contacter",
  "contacte",
  "ouvert",
  "clique",
  "interesse",
  "reponse_recue",
  "a_rappeler",
  "devis_demande",
  "client",
  "pas_interesse",
  "ne_plus_contacter",
]);

export const scoreTier = pgEnum("score_tier", ["tres_haute", "haute", "moyenne", "faible", "ignorer"]);

/**
 * Prospect = une entreprise qualifiée pour la prospection (a passé le
 * filtrage géo/secteur/blacklist). 1-1 avec `companies`. Le score et son
 * détail (`scoreBreakdown`) sont recalculés par le job de scoring — jamais
 * modifiés à la main, pour rester traçables.
 */
export const prospects = pgTable(
  "prospects",
  {
    id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    companyId: uuid("company_id").notNull().unique().references(() => companies.id, { onDelete: "cascade" }),
    status: prospectStatus("status").notNull().default("nouveau"),
    score: integer("score").notNull().default(0),
    scoreTier: scoreTier("score_tier").notNull().default("ignorer"),
    scoreBreakdown: text("score_breakdown"), // JSON stringifié : {ruleSlug: points} pour audit du calcul
    isEligibleForEmail: text("is_eligible_for_email").notNull().default("false"), // email présent + pas blacklisté + pas en suppression list
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("prospects_status_idx").on(t.status),
    index("prospects_score_idx").on(t.score),
    index("prospects_score_tier_idx").on(t.scoreTier),
  ],
);

export const tags = pgTable("tags", {
  id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  label: text("label").notNull().unique(),
  color: text("color"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const prospectTags = pgTable(
  "prospect_tags",
  {
    prospectId: uuid("prospect_id").notNull().references(() => prospects.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.prospectId, t.tagId] })],
);

/**
 * Règle de scoring configurable — brief section 27. `condition` est une
 * expression simple évaluée par le moteur de scoring (ex.
 * {"field":"collectedDaysAgo","op":"lte","value":30}), `points` peut être
 * négatif. Les règles sont éditables sans déploiement de code.
 */
export const scoringRules = pgTable("scoring_rules", {
  id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  slug: text("slug").notNull().unique(),
  label: text("label").notNull(),
  points: integer("points").notNull(),
  condition: text("condition").notNull(), // JSON stringifié
  isActive: text("is_active").notNull().default("true"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
