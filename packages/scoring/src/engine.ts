import { evaluateCondition } from "./rules";
import { scoreToTier } from "./tier";
import type { ScoreResult, ScoringInput, ScoringRuleDef } from "./types";

/**
 * Calcule le score d'un prospect à partir des règles actives — brief
 * section 27. Le score est borné à [0, 100] (une règle négative peut faire
 * baisser mais jamais sous 0 ; une accumulation de règles positives ne
 * dépasse jamais 100, pour rester lisible avec la classification par
 * paliers).
 */
export function computeScore(rules: ScoringRuleDef[], input: ScoringInput): ScoreResult {
  const breakdown = rules
    .filter((r) => r.isActive)
    .map((rule) => {
      const matched = evaluateCondition(rule.condition, input);
      return { slug: rule.slug, label: rule.label, points: matched ? rule.points : 0, matched };
    });

  const raw = breakdown.reduce((sum, entry) => sum + entry.points, 0);
  const score = Math.max(0, Math.min(100, raw));

  return { score, tier: scoreToTier(score), breakdown };
}

export * from "./types";
export { evaluateCondition } from "./rules";
export { scoreToTier } from "./tier";
