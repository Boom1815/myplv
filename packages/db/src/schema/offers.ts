import { pgTable, pgEnum, uuid, text, integer, timestamp, index } from "drizzle-orm/pg-core";
import { sectors } from "./sectors";

/** Offre commerciale MYPLV — brief section 30. Doit rester cohérente avec les services réels de MYPLV, jamais générée automatiquement. */
export const offers = pgTable("offers", {
  id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  sectorId: uuid("sector_id").references(() => sectors.id),
  pitch: text("pitch"), // argumentaire
  advantage: text("advantage"),
  ctaLabel: text("cta_label"),
  landingUrl: text("landing_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const campaignMode = pgEnum("campaign_mode", ["dry_run", "production"]);
export const campaignStatus = pgEnum("campaign_status", ["draft", "scheduled", "running", "paused", "completed"]);

/** Campagne = une séquence d'emails ciblant un segment de prospects. */
export const campaigns = pgTable(
  "campaigns",
  {
    id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    offerId: uuid("offer_id").references(() => offers.id),
    mode: campaignMode("mode").notNull().default("dry_run"), // toute campagne démarre en simulation (brief section 49/50)
    status: campaignStatus("status").notNull().default("draft"),
    segmentFilter: text("segment_filter"), // JSON stringifié des filtres d'audience
    dailySendLimit: integer("daily_send_limit").notNull().default(50),
    createdByUserId: uuid("created_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("campaigns_status_idx").on(t.status)],
);

/** Une étape de séquence (J0, J+4, J+10...) — brief section 34. */
export const campaignSteps = pgTable(
  "campaign_steps",
  {
    id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    campaignId: uuid("campaign_id").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
    stepOrder: integer("step_order").notNull(),
    delayDays: integer("delay_days").notNull().default(0), // délai depuis l'étape précédente (ou depuis l'entrée en campagne pour l'étape 0)
    emailTemplateId: uuid("email_template_id"),
    stopOnReply: text("stop_on_reply").notNull().default("true"),
  },
  (t) => [index("campaign_steps_campaign_idx").on(t.campaignId, t.stepOrder)],
);
