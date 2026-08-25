/**
 * Résolution province/région à partir du code postal belge. S'appuie sur les
 * plages postales officielles (bpost / SPF Économie), qui sont une donnée
 * publique stable — pas une source inventée. Limité aux 4 zones du
 * périmètre de lancement (brief section 22, confirmé le 25/08) ; les autres
 * codes postaux renvoient `null` (l'entreprise reste importée, simplement
 * hors périmètre géographique prioritaire).
 */
export type GeoResolution = { province: string; region: string };

const RANGES: Array<{ min: number; max: number; province: string; region: string }> = [
  { min: 1000, max: 1299, province: "Bruxelles-Capitale", region: "Région de Bruxelles-Capitale" },
  { min: 1300, max: 1499, province: "Brabant wallon", region: "Région wallonne" },
  { min: 5000, max: 5680, province: "Namur", region: "Région wallonne" },
  { min: 6000, max: 6599, province: "Hainaut", region: "Région wallonne" },
  { min: 7000, max: 7999, province: "Hainaut", region: "Région wallonne" },
];

export function resolveGeoFromPostalCode(postalCode: string | null | undefined): GeoResolution | null {
  if (!postalCode) return null;
  const code = Number(postalCode.trim());
  if (!Number.isFinite(code)) return null;

  const match = RANGES.find((r) => code >= r.min && code <= r.max);
  return match ? { province: match.province, region: match.region } : null;
}
