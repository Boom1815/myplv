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

/** Clé de la table `settings` (packages/db) où vit la signature email globale — voir apps/api/src/routes/signature.ts (lecture/écriture) et campaigns.ts (ajout automatique à chaque envoi). Centralisée ici pour éviter que les deux fichiers ne divergent sur la clé. */
export const SIGNATURE_SETTINGS_KEY = "email_signature";

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

/** Données factices pour la prévisualisation (brief section 32) — un exemple représentatif, jamais un vrai prospect sans son accord. Partagé entre l'écran Templates et l'envoi de test depuis une campagne. */
export const SAMPLE_VARIABLES: TemplateVariables = {
  prenom: "Julie",
  nom: "Dupont",
  entreprise: "Boulangerie Dupont",
  secteur: "Horeca",
  commune: "Wavre",
  province: "Brabant wallon",
  offre: "Pack lancement MYPLV",
  lien: "https://myplv.be",
};

// Même largeur de colonne que celle utilisée par blocksToHtml côté éditeur
// (apps/web/src/components/RichEmailEditor.tsx) — le pied de page doit
// s'aligner sur la même colonne centrée que le corps du template, pas
// s'étaler sur toute la largeur du client mail.
const EMAIL_WIDTH = 600;

/**
 * Pied de page de désinscription — brief section 41 : un lien de
 * désinscription fonctionnel sur CHAQUE email de campagne, jamais optionnel
 * ni laissé à la rédaction du template. Ajouté au moment de l'envoi, pas
 * éditable depuis l'écran Templates.
 *
 * Enveloppé dans le même motif "table 100% -> td align=center -> table
 * width=600" que le corps : ajouté tel quel après un bodyHtml déjà
 * centré sur 600px, un simple <p> pleine largeur retombait sur toute la
 * largeur du client mail et se retrouvait visuellement désaligné par
 * rapport au contenu au-dessus.
 */
export function appendUnsubscribeFooter(bodyHtml: string, unsubscribeUrl: string): string {
  return `${bodyHtml}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fafaf8;"><tr><td align="center" style="padding:0 16px 24px;">
<table role="presentation" width="${EMAIL_WIDTH}" cellpadding="0" cellspacing="0" style="width:${EMAIL_WIDTH}px;max-width:${EMAIL_WIDTH}px;">
<tr><td style="padding:0 24px;">
<hr style="border:none;border-top:1px solid #D8DCD3;margin:14px 0;">
<p style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#7b8494;line-height:1.5;margin:0 0 14px;">
  Vous recevez cet email dans le cadre d'une démarche de prospection commerciale de MYPLV.
  <a href="${unsubscribeUrl}" style="color:#a33907;">Se désinscrire</a>
</p>
</td></tr>
</table>
</td></tr></table>`;
}
