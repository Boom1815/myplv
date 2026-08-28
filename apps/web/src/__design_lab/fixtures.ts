/**
 * Design Lab — données fixes partagées par les 5 variantes, pour une
 * comparaison équitable (mêmes chiffres partout). Forme calquée sur
 * DashboardStats (apps/web/src/lib/api.ts) — fichier temporaire, supprimé
 * à la fin de l'exploration (voir DESIGN_PLAN.md une fois généré).
 */

export type DashboardStats = {
  prospects: {
    total: number;
    byTier: Record<string, number>;
    byStatus: Record<string, number>;
    eligibleForEmail: number;
  };
  companies: { total: number; withEmail: number };
  lastImport: {
    status: string;
    startedAt: string;
    finishedAt: string | null;
    recordsCreated: number;
    recordsUpdated: number;
    recordsSkipped: number;
  } | null;
};

export const FIXTURE_STATS: DashboardStats = {
  prospects: {
    total: 1284,
    byTier: { tres_haute: 96, haute: 214, moyenne: 402, faible: 380, ignorer: 192 },
    byStatus: {
      nouveau: 310,
      a_contacter: 248,
      contacte: 402,
      ouvert: 118,
      clique: 54,
      interesse: 61,
      reponse_recue: 33,
      a_rappeler: 22,
      devis_demande: 14,
      client: 12,
      pas_interesse: 8,
      ne_plus_contacter: 2,
    },
    eligibleForEmail: 967,
  },
  companies: { total: 2140, withEmail: 1580 },
  lastImport: {
    status: "Terminé",
    startedAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    finishedAt: new Date(Date.now() - 1000 * 60 * 55 * 6).toISOString(),
    recordsCreated: 142,
    recordsUpdated: 318,
    recordsSkipped: 26,
  },
};

export const TIER_ORDER = ["tres_haute", "haute", "moyenne", "faible", "ignorer"] as const;
export const TIER_LABELS: Record<string, string> = {
  tres_haute: "Très haute",
  haute: "Haute",
  moyenne: "Moyenne",
  faible: "Faible",
  ignorer: "Ignorer",
};

export const STATUS_LABELS: Record<string, string> = {
  nouveau: "Nouveau",
  a_contacter: "À contacter",
  contacte: "Contacté",
  ouvert: "Ouvert",
  clique: "Cliqué",
  interesse: "Intéressé",
  reponse_recue: "Réponse reçue",
  a_rappeler: "À rappeler",
  devis_demande: "Devis demandé",
  client: "Client",
  pas_interesse: "Pas intéressé",
  ne_plus_contacter: "Ne plus contacter",
};
