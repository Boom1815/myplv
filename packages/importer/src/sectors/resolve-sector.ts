export type SectorNaceRule = { sectorId: string; nacePrefix: string; priority: number };

/**
 * Résout le secteur (brief section 23) à partir d'un code NACE : la règle
 * dont le préfixe correspond est retenue ; en cas de chevauchement (ex.
 * "45" automobile vs "46"/"47" commerce, tous deux dans la section G), la
 * priorité la plus haute gagne, puis le préfixe le plus long/spécifique.
 */
export function resolveSectorId(naceCode: string | null, rules: SectorNaceRule[]): string | null {
  if (!naceCode) return null;

  const matches = rules.filter((r) => naceCode.startsWith(r.nacePrefix));
  if (matches.length === 0) return null;

  matches.sort((a, b) => b.priority - a.priority || b.nacePrefix.length - a.nacePrefix.length);
  return matches[0].sectorId;
}
