import "dotenv/config";
import { createNodeDb, schema } from "@myplv/db";
import { eq } from "drizzle-orm";
import type { RuleCondition } from "@myplv/scoring";

/**
 * Règles de scoring de départ — reprend exactement l'exemple du brief
 * (section 27). Modifiables ensuite depuis l'écran Scoring (points,
 * actif/inactif) sans redéploiement.
 */
const RULES: Array<{ slug: string; label: string; points: number; condition: RuleCondition }> = [
  {
    slug: "recent_company",
    label: "Entreprise récente (< 30 jours)",
    points: 20,
    condition: { kind: "recent_company", params: { maxDaysAgo: 30 } },
  },
  {
    slug: "priority_sector",
    label: "Secteur prioritaire",
    points: 15,
    condition: { kind: "priority_sector", params: { sectorSlugs: ["horeca", "construction", "commerce", "immobilier"] } },
  },
  {
    slug: "priority_zone",
    label: "Zone prioritaire",
    points: 10,
    condition: {
      kind: "priority_zone",
      params: { provinces: ["Bruxelles-Capitale", "Brabant wallon", "Hainaut", "Namur"] },
    },
  },
  {
    slug: "valid_professional_email",
    label: "Email professionnel valide",
    points: 10,
    condition: { kind: "valid_professional_email" },
  },
  { slug: "no_website", label: "Absence de site", points: 10, condition: { kind: "no_website" } },
  {
    slug: "weak_digital_presence",
    label: "Présence digitale faible",
    points: 10,
    condition: { kind: "weak_digital_presence" },
  },
  { slug: "independent", label: "Indépendant", points: 5, condition: { kind: "independent" } },
  {
    slug: "graphic_potential",
    label: "Potentiel graphique",
    points: 5,
    condition: {
      kind: "graphic_potential",
      params: { sectorSlugs: ["horeca", "beaute", "evenementiel", "commerce", "automobile"] },
    },
  },
];

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL manquant (voir .env.example).");
    process.exit(1);
  }
  const db = createNodeDb(databaseUrl);

  for (const r of RULES) {
    const [existing] = await db.select().from(schema.scoringRules).where(eq(schema.scoringRules.slug, r.slug));
    const values = {
      slug: r.slug,
      label: r.label,
      points: r.points,
      condition: JSON.stringify(r.condition),
    };
    if (existing) {
      // On ne touche pas aux points/actif si la règle existe déjà — elle a
      // pu être ajustée manuellement depuis l'écran Scoring.
      console.log(`= règle déjà présente, inchangée : ${r.label}`);
    } else {
      await db.insert(schema.scoringRules).values(values);
      console.log(`+ règle créée : ${r.label} (${r.points} pts)`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
