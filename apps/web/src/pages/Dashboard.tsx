import { useEffect, useState } from "react";
import { api, type DashboardStats } from "../lib/api";
import { InfoTooltip } from "../components/InfoTooltip";

const TIER_ORDER = ["tres_haute", "haute", "moyenne", "faible", "ignorer"] as const;
const TIER_LABELS: Record<string, string> = {
  tres_haute: "Très haute",
  haute: "Haute",
  moyenne: "Moyenne",
  faible: "Faible",
  ignorer: "Ignorer",
};
// Une seule teinte (accent), du plus foncé/opaque (priorité la plus haute) au
// plus clair (priorité la plus basse) — échelle séquentielle, pas catégorielle :
// le score est une magnitude ordonnée, pas des catégories indépendantes.
const TIER_OPACITY: Record<string, number> = {
  tres_haute: 1,
  haute: 0.78,
  moyenne: 0.56,
  faible: 0.36,
  ignorer: 0.2,
};

const STATUS_LABELS: Record<string, string> = {
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

function StatTile({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <div className="stat-tile">
      <span className="stat-label">{label}</span>
      <span className={`stat-value mono${accent ? " stat-value--accent" : ""}`}>{value}</span>
      {sub && <span className="stat-sub">{sub}</span>}
    </div>
  );
}

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .dashboard()
      .then(setStats)
      .catch((err) => setError(err instanceof Error ? err.message : "Erreur de chargement."));
  }, []);

  if (error) {
    return (
      <div className="main">
        <div className="form-error">{error}</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="main">
        <div className="empty-state">Chargement…</div>
      </div>
    );
  }

  const total = stats.prospects.total;
  const statusEntries = Object.entries(stats.prospects.byStatus).sort((a, b) => b[1] - a[1]);

  return (
    <div className="main">
      <div className="page-head page-head--hero">
        <h1>
          <span className="brand-mark" aria-hidden="true" />
          Dashboard
          <InfoTooltip>
            <p>Vue d'ensemble de la prospection : combien d'entreprises sont collectées, combien sont qualifiées comme prospects, et combien peuvent recevoir un email.</p>
            <p>Rien à faire ici — c'est une vue de lecture, mise à jour automatiquement.</p>
          </InfoTooltip>
        </h1>
      </div>

      <div className="stat-grid">
        <StatTile label="Prospects" value={total} />
        <StatTile
          label="Entreprises"
          value={stats.companies.total}
          sub={`${stats.companies.withEmail} avec email`}
        />
        <StatTile label="Éligibles envoi email" value={stats.prospects.eligibleForEmail} accent />
        <StatTile
          label="Très haute + haute priorité"
          value={(stats.prospects.byTier.tres_haute ?? 0) + (stats.prospects.byTier.haute ?? 0)}
        />
      </div>

      <div className="dash-grid">
        <div className="card-block card-block--lift card-block--tier">
          <h3>
            Répartition par priorité
            <InfoTooltip>
              Le niveau de priorité (score) vient de l'écran Scoring — plus il est élevé, plus l'entreprise correspond
              au profil client type. Réglable dans Scoring → Recalculer.
            </InfoTooltip>
          </h3>
          {total === 0 ? (
            <p className="lede" style={{ fontSize: 13.5 }}>
              Aucun prospect pour l'instant.
            </p>
          ) : (
            <>
              <div className="tier-bar" role="img" aria-label="Répartition des prospects par niveau de priorité">
                {TIER_ORDER.map((tier) => {
                  const count = stats.prospects.byTier[tier] ?? 0;
                  const pct = total ? (count / total) * 100 : 0;
                  if (pct === 0) return null;
                  return (
                    <div
                      key={tier}
                      className="tier-seg"
                      style={{ width: `${pct}%`, background: `color-mix(in srgb, var(--accent) ${TIER_OPACITY[tier] * 100}%, var(--surface))` }}
                      title={`${TIER_LABELS[tier]} : ${count}`}
                    />
                  );
                })}
              </div>
              <ul className="tier-legend">
                {TIER_ORDER.map((tier) => (
                  <li key={tier}>
                    <span
                      className="tier-dot"
                      style={{ background: `color-mix(in srgb, var(--accent) ${TIER_OPACITY[tier] * 100}%, var(--surface))` }}
                    />
                    {TIER_LABELS[tier]}
                    <span className="mono" style={{ marginLeft: 6, color: "var(--ink-faint)" }}>
                      {stats.prospects.byTier[tier] ?? 0}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="card-block card-block--lift card-block--info">
          <h3>Statuts</h3>
          {statusEntries.length === 0 ? (
            <p className="lede" style={{ fontSize: 13.5 }}>
              Aucun prospect pour l'instant.
            </p>
          ) : (
            <ul className="status-list">
              {statusEntries.map(([status, count]) => (
                <li key={status}>
                  <span>{STATUS_LABELS[status] ?? status}</span>
                  <span className="mono">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card-block card-block--lift card-block--meta">
          <h3>Dernier import</h3>
          {stats.lastImport ? (
            <dl className="import-meta">
              <dt>Statut</dt>
              <dd>{stats.lastImport.status}</dd>
              <dt>Démarré</dt>
              <dd className="mono">{new Date(stats.lastImport.startedAt).toLocaleString("fr-BE")}</dd>
              <dt>Créées</dt>
              <dd className="mono">{stats.lastImport.recordsCreated}</dd>
              <dt>Mises à jour</dt>
              <dd className="mono">{stats.lastImport.recordsUpdated}</dd>
              <dt>Ignorées</dt>
              <dd className="mono">{stats.lastImport.recordsSkipped}</dd>
            </dl>
          ) : (
            <p className="lede" style={{ fontSize: 13.5 }}>
              Aucun import effectué pour l'instant.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
