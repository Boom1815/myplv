import { pgTable, uuid, text, boolean, timestamp, index, unique } from "drizzle-orm/pg-core";

/**
 * Zones géographiques — hiérarchie Région → Province → Commune → Code postal
 * (brief section 22). Une ligne par code postal, avec la commune/province/
 * région associées, et un flag "active" pour activer/désactiver une zone du
 * périmètre de prospection sans supprimer la donnée.
 *
 * Périmètre de lancement confirmé (25/08) : Bruxelles-Capitale, Brabant
 * wallon, Hainaut, Namur.
 */
export const geographicZones = pgTable(
  "geographic_zones",
  {
    id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    postalCode: text("postal_code").notNull(),
    municipality: text("municipality").notNull(),
    province: text("province").notNull(),
    region: text("region").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("geographic_zones_postal_code_unique").on(t.postalCode),
    index("geographic_zones_province_idx").on(t.province),
    index("geographic_zones_region_idx").on(t.region),
    index("geographic_zones_active_idx").on(t.isActive),
  ],
);
