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

/**
 * Pied de page de désinscription — brief section 41 : un lien de
 * désinscription fonctionnel sur CHAQUE email de campagne, jamais optionnel
 * ni laissé à la rédaction du template. Ajouté au moment de l'envoi, pas
 * éditable depuis l'écran Templates.
 */
export function appendUnsubscribeFooter(bodyHtml: string, unsubscribeUrl: string): string {
  return `${bodyHtml}
<hr style="border:none;border-top:1px solid #D8DCD3;margin:28px 0 14px;">
<p style="font-family:system-ui,sans-serif;font-size:12px;color:#7b8494;line-height:1.5;">
  Vous recevez cet email dans le cadre d'une démarche de prospection commerciale de MYPLV.
  <a href="${unsubscribeUrl}" style="color:#2c4a9e;">Se désinscrire</a>
</p>`;
}
