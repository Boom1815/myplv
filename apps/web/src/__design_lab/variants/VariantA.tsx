import { Topbar } from "../Topbar";
import { FIXTURE_STATS, STATUS_LABELS, TIER_LABELS, TIER_ORDER } from "../fixtures";

/**
 * Variante A — Hiérarchie de l'information.
 * Un seul chiffre héros (le plus actionnable : prospects éligibles email),
 * tout le reste redescend d'un cran. Couleur très retenue : uniquement
 * l'orange de marque sur le chiffre héros et les points clés — le reste
 * reste en encre neutre. Répond directement à "hiérarchie peu claire".
 */
export function VariantA() {
  const s = FIXTURE_STATS;
  const total = s.prospects.total;
  const statusEntries = Object.entries(s.prospects.byStatus).sort((a, b) => b[1] - a[1]);

  return (
    <div className="mp-a">
      <style>{`
        .mp-a { background: #fafaf8; }
        .mp-a .topbar { background: #fff; border-bottom: 1px solid #e3e3df; }
        .mp-a .nav-tabs button.active { color: #14151a; border-bottom-color: #E05010; }
        .mp-a .btn-primary, .mp-a .role-pill { background: #14151a; border-color: #14151a; color: #fff; }
        .mp-a-main { padding: 44px 40px; max-width: 1080px; margin: 0 auto; }
        .mp-a-eyebrow { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #8d8e95; margin-bottom: 8px; }
        .mp-a-hero { display: flex; align-items: baseline; gap: 18px; padding-bottom: 28px; margin-bottom: 32px; border-bottom: 1px solid #e3e3df; }
        .mp-a-hero-num { font-size: 64px; font-weight: 800; letter-spacing: -0.03em; color: #E05010; line-height: 1; }
        .mp-a-hero-label { font-size: 15px; color: #55565f; max-width: 260px; line-height: 1.4; }
        .mp-a-sub-row { display: flex; gap: 32px; margin-bottom: 40px; flex-wrap: wrap; }
        .mp-a-sub { display: flex; flex-direction: column; gap: 3px; }
        .mp-a-sub-val { font-size: 22px; font-weight: 700; color: #14151a; }
        .mp-a-sub-label { font-size: 12px; color: #8d8e95; }
        .mp-a-section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #14151a; margin: 0 0 16px; }
        .mp-a-grid { display: grid; grid-template-columns: 1.3fr 1fr; gap: 32px; }
        .mp-a-bar { display: flex; height: 6px; border-radius: 4px; overflow: hidden; background: #edede9; margin-bottom: 14px; }
        .mp-a-legend { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; font-size: 13px; color: #55565f; }
        .mp-a-legend li { display: flex; align-items: center; gap: 8px; }
        .mp-a-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
        .mp-a-status-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
        .mp-a-status-list li { display: flex; justify-content: space-between; padding: 9px 0; border-bottom: 1px solid #edede9; font-size: 13.5; color: #55565f; }
        .mp-a-status-list li:last-child { border-bottom: none; }
        .mp-a-status-list strong { color: #14151a; font-weight: 700; }
      `}</style>

      <Topbar />
      <div className="mp-a-main">
        <div className="mp-a-eyebrow">Dashboard</div>
        <div className="mp-a-hero">
          <span className="mp-a-hero-num">{s.prospects.eligibleForEmail}</span>
          <span className="mp-a-hero-label">prospects éligibles à un envoi email, sur {total} au total — l'action la plus rentable dès maintenant.</span>
        </div>

        <div className="mp-a-sub-row">
          <div className="mp-a-sub">
            <span className="mp-a-sub-val">{s.companies.total}</span>
            <span className="mp-a-sub-label">Entreprises collectées</span>
          </div>
          <div className="mp-a-sub">
            <span className="mp-a-sub-val">{s.companies.withEmail}</span>
            <span className="mp-a-sub-label">Avec email connu</span>
          </div>
          <div className="mp-a-sub">
            <span className="mp-a-sub-val">{(s.prospects.byTier.tres_haute ?? 0) + (s.prospects.byTier.haute ?? 0)}</span>
            <span className="mp-a-sub-label">Priorité très haute + haute</span>
          </div>
        </div>

        <div className="mp-a-grid">
          <div>
            <h3 className="mp-a-section-title">Répartition par priorité</h3>
            <div className="mp-a-bar">
              {TIER_ORDER.map((t) => {
                const count = s.prospects.byTier[t] ?? 0;
                const pct = (count / total) * 100;
                const shade = t === "tres_haute" ? "#14151a" : t === "haute" ? "#55565f" : t === "moyenne" ? "#8d8e95" : t === "faible" ? "#c7c8cc" : "#e3e3df";
                return <div key={t} style={{ width: `${pct}%`, background: shade }} title={TIER_LABELS[t]} />;
              })}
            </div>
            <ul className="mp-a-legend">
              {TIER_ORDER.map((t) => {
                const shade = t === "tres_haute" ? "#14151a" : t === "haute" ? "#55565f" : t === "moyenne" ? "#8d8e95" : t === "faible" ? "#c7c8cc" : "#e3e3df";
                return (
                  <li key={t}>
                    <span className="mp-a-dot" style={{ background: shade }} />
                    {TIER_LABELS[t]}
                    <span style={{ marginLeft: "auto", color: "#8d8e95" }}>{s.prospects.byTier[t] ?? 0}</span>
                  </li>
                );
              })}
            </ul>
          </div>
          <div>
            <h3 className="mp-a-section-title">Statuts (top 5)</h3>
            <ul className="mp-a-status-list">
              {statusEntries.slice(0, 5).map(([status, count]) => (
                <li key={status}>
                  <span>{STATUS_LABELS[status] ?? status}</span>
                  <strong>{count}</strong>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
