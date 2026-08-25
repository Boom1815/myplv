import type { ScoreTier } from "./types";

/** Classification par score — brief section 27, seuils exacts du brief. */
export function scoreToTier(score: number): ScoreTier {
  if (score >= 80) return "tres_haute";
  if (score >= 60) return "haute";
  if (score >= 40) return "moyenne";
  if (score >= 20) return "faible";
  return "ignorer";
}
