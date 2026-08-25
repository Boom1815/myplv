import { pgTable, uuid, text, date, timestamp, index, unique } from "drizzle-orm/pg-core";
import { dataSources } from "./sourcing";
import { sectors } from "./sectors";

/**
 * Entreprise — donnée "officielle" issue des sources publiques (brief
 * section 20). Une entreprise n'est pas encore un prospect qualifié : elle
 * le devient (ligne dans `prospects`) après filtrage/scoring.
 */
export const companies = pgTable(
  "companies",
  {
    id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),

    // Identité
    enterpriseNumber: text("enterprise_number").unique(), // n° BCE, clé de dédoublonnage prioritaire
    name: text("name").notNull(),
    legalForm: text("legal_form"),
    startDate: date("start_date"),

    // Adresse
    street: text("street"),
    houseNumber: text("house_number"),
    postalCode: text("postal_code"),
    municipality: text("municipality"),
    province: text("province"),
    region: text("region"),

    // Activité
    primaryNaceCode: text("primary_nace_code"),
    sectorId: uuid("sector_id").references(() => sectors.id),
    description: text("description"),

    // Contact / présence digitale (quand disponible légalement — brief section 20/28)
    email: text("email"),
    phone: text("phone"),
    website: text("website"),
    hasWebsite: text("has_website"), // "yes" | "no" | "unknown" — signal d'opportunité, jamais affirmatif à 100%

    // Provenance & traçabilité (brief section 20/25)
    dataSourceId: uuid("data_source_id").references(() => dataSources.id),
    sourceRecordId: text("source_record_id"),
    confidence: text("confidence").notNull().default("medium"), // "low" | "medium" | "high"
    collectedAt: timestamp("collected_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),

    // Dédoublonnage (brief section 25) : fusions journalisées via audit_logs,
    // ce champ pointe vers l'enregistrement survivant si celui-ci a été fusionné.
    mergedIntoCompanyId: uuid("merged_into_company_id"),
  },
  (t) => [
    index("companies_postal_code_idx").on(t.postalCode),
    index("companies_province_idx").on(t.province),
    index("companies_nace_idx").on(t.primaryNaceCode),
    index("companies_sector_idx").on(t.sectorId),
    index("companies_collected_at_idx").on(t.collectedAt),
    index("companies_email_idx").on(t.email),
    index("companies_website_idx").on(t.website),
  ],
);

/** Contact nominatif rattaché à une entreprise (dirigeant, personne de contact). */
export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    firstName: text("first_name"),
    lastName: text("last_name"),
    role: text("role"), // fonction (gérant, dirigeant...)
    email: text("email"),
    phone: text("phone"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("contacts_company_id_idx").on(t.companyId),
    index("contacts_email_idx").on(t.email),
    unique("contacts_company_email_unique").on(t.companyId, t.email),
  ],
);
