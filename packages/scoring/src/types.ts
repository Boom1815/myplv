/**
 * Moteur de scoring — brief section 27. Plutôt qu'un langage d'expression
 * générique (risqué à valider correctement dans le temps imparti), chaque
 * règle référence un "kind" reconnu par le moteur avec des paramètres
 * simples (seuils, listes) — modifiable en base sans toucher au code :
 * points, actif/inactif, et les paramètres eux-mêmes.
 */
export type RuleKind =
  | "recent_company"
  | "priority_sector"
  | "priority_zone"
  | "valid_professional_email"
  | "no_website"
  | "weak_digital_presence"
  | "independent"
  | "graphic_potential";

export type RuleCondition =
  | { kind: "recent_company"; params: { maxDaysAgo: number } }
  | { kind: "priority_sector"; params: { sectorSlugs: string[] } }
  | { kind: "priority_zone"; params: { provinces: string[] } }
  | { kind: "valid_professional_email"; params?: Record<string, never> }
  | { kind: "no_website"; params?: Record<string, never> }
  | { kind: "weak_digital_presence"; params?: Record<string, never> }
  | { kind: "independent"; params?: Record<string, never> }
  | { kind: "graphic_potential"; params: { sectorSlugs: string[] } };

/** Ce que le moteur a besoin de connaître d'un prospect pour le noter. */
export type ScoringInput = {
  startDate: string | Date | null;
  collectedAt: string | Date;
  sectorSlug: string | null;
  province: string | null;
  email: string | null;
  /** "yes" | "no" | "unknown" | null — toujours une estimation (brief section 28). */
  hasWebsite: string | null;
  /** TypeOfEnterprise brut KBO : "1" personne physique | "2" personne morale. */
  enterpriseType: string | null;
  now?: Date;
};

export type ScoringRuleDef = {
  id: string;
  slug: string;
  label: string;
  points: number;
  isActive: boolean;
  condition: RuleCondition;
};

export type ScoreTier = "tres_haute" | "haute" | "moyenne" | "faible" | "ignorer";

export type ScoreBreakdownEntry = { slug: string; label: string; points: number; matched: boolean };

export type ScoreResult = {
  score: number;
  tier: ScoreTier;
  breakdown: ScoreBreakdownEntry[];
};
