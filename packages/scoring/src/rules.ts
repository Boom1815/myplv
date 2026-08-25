import type { RuleCondition, ScoringInput } from "./types";

function daysAgo(date: string | Date | null, now: Date): number | null {
  if (!date) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Une seule fonction par kind, pure et testable. Retourne true si la règle s'applique. */
export function evaluateCondition(condition: RuleCondition, input: ScoringInput): boolean {
  const now = input.now ?? new Date();

  switch (condition.kind) {
    case "recent_company": {
      // Priorité à la date de début d'activité ; à défaut, date de collecte.
      const age = daysAgo(input.startDate, now) ?? daysAgo(input.collectedAt, now);
      return age !== null && age >= 0 && age <= condition.params.maxDaysAgo;
    }

    case "priority_sector":
      return !!input.sectorSlug && condition.params.sectorSlugs.includes(input.sectorSlug);

    case "priority_zone":
      return !!input.province && condition.params.provinces.includes(input.province);

    case "valid_professional_email":
      return !!input.email && EMAIL_RE.test(input.email);

    case "no_website":
      return input.hasWebsite === "no";

    case "weak_digital_presence":
      // Distinct de "no_website" : ici on ne SAIT PAS s'il y a un site — signal plus faible, jamais affirmatif.
      return input.hasWebsite === "unknown" || input.hasWebsite === null;

    case "independent":
      return input.enterpriseType === "1";

    case "graphic_potential":
      return !!input.sectorSlug && condition.params.sectorSlugs.includes(input.sectorSlug);

    default: {
      const _exhaustive: never = condition;
      return _exhaustive;
    }
  }
}
