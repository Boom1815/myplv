import { pgTable, pgEnum, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { campaigns, campaignSteps } from "./offers";
import { prospects } from "./prospects";

/**
 * Template éditable — brief section 32/33. `bodyHtml` contient les
 * variables {{prenom}}, {{nom}}, {{entreprise}}, {{secteur}}, {{commune}},
 * {{province}}, {{offre}}, {{lien}} résolues à l'envoi.
 */
export const emailTemplates = pgTable("email_templates", {
  id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  bodyHtml: text("body_html").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const emailSendStatus = pgEnum("email_send_status", [
  "scheduled",
  "sent",
  "bounced",
  "failed",
  "skipped_suppressed",
  "skipped_no_email",
]);

/** Un envoi individuel (une étape de campagne pour un prospect donné). */
export const emailSends = pgTable(
  "email_sends",
  {
    id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    campaignId: uuid("campaign_id").notNull().references(() => campaigns.id),
    campaignStepId: uuid("campaign_step_id").references(() => campaignSteps.id),
    prospectId: uuid("prospect_id").notNull().references(() => prospects.id),
    emailTemplateId: uuid("email_template_id").references(() => emailTemplates.id),
    toEmail: text("to_email").notNull(),
    status: emailSendStatus("status").notNull().default("scheduled"),
    providerMessageId: text("provider_message_id"), // id renvoyé par Brevo/EmailProvider, pour recouper les événements
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    errorMessage: text("error_message"),
  },
  (t) => [
    index("email_sends_campaign_idx").on(t.campaignId),
    index("email_sends_prospect_idx").on(t.prospectId),
    index("email_sends_status_idx").on(t.status),
    index("email_sends_provider_message_id_idx").on(t.providerMessageId),
  ],
);

export const emailEventType = pgEnum("email_event_type", [
  "delivered",
  "opened",
  "clicked",
  "bounced",
  "complained",
  "unsubscribed",
]);

/** Événement de tracking (limites du tracking d'ouverture rappelées — brief section 57). */
export const emailEvents = pgTable(
  "email_events",
  {
    id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    emailSendId: uuid("email_send_id").notNull().references(() => emailSends.id, { onDelete: "cascade" }),
    type: emailEventType("type").notNull(),
    metadata: text("metadata"), // JSON (lien cliqué, user-agent, raison de bounce...)
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("email_events_send_idx").on(t.emailSendId), index("email_events_type_idx").on(t.type)],
);

/** Réponse reçue à une campagne — rattachée manuellement ou automatiquement à un envoi. */
export const emailReplies = pgTable(
  "email_replies",
  {
    id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    emailSendId: uuid("email_send_id").references(() => emailSends.id),
    prospectId: uuid("prospect_id").notNull().references(() => prospects.id),
    fromEmail: text("from_email").notNull(),
    subject: text("subject"),
    bodyText: text("body_text"),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("email_replies_prospect_idx").on(t.prospectId)],
);

/**
 * Liste de suppression globale — brief section 41/56. Vérifiée avant CHAQUE
 * envoi ; une entrée ici bloque tout envoi futur vers cet email, toutes
 * campagnes confondues.
 */
export const suppressionList = pgTable(
  "suppression_list",
  {
    id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    email: text("email").notNull().unique(),
    reason: text("reason").notNull(), // "unsubscribe" | "bounce" | "complaint" | "manual"
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("suppression_list_email_idx").on(t.email)],
);
