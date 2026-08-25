/**
 * Variables de template — brief section 32 : {{prenom}}, {{nom}},
 * {{entreprise}}, {{secteur}}, {{commune}}, {{province}}, {{offre}},
 * {{lien}}.
 */
export type TemplateVariables = {
  prenom?: string;
  nom?: string;
  entreprise?: string;
  secteur?: string;
  commune?: string;
  province?: string;
  offre?: string;
  lien?: string;
};

const VARIABLE_RE = /\{\{\s*(\w+)\s*\}\}/g;

/** Remplace les variables connues ; une valeur manquante est rendue comme chaîne vide (jamais un texte "undefined"). */
export function renderTemplate(source: string, variables: TemplateVariables): string {
  return source.replace(VARIABLE_RE, (match, key: string) => {
    const value = (variables as Record<string, string | undefined>)[key];
    return value ?? "";
  });
}

/** Variables présentes dans le template mais non fournies — utile pour avertir avant l'envoi. */
export function findUnknownVariables(source: string, knownKeys: string[]): string[] {
  const found = new Set<string>();
  for (const match of source.matchAll(VARIABLE_RE)) {
    const key = match[1];
    if (!knownKeys.includes(key)) found.add(key);
  }
  return [...found];
}

export const TEMPLATE_VARIABLE_KEYS = ["prenom", "nom", "entreprise", "secteur", "commune", "province", "offre", "lien"];
