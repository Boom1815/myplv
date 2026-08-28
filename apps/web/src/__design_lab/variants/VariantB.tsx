import { Topbar } from "../Topbar";
import { FIXTURE_STATS, STATUS_LABELS, TIER_LABELS, TIER_ORDER } from "../fixtures";

/**
 * Variante B — Exploration de mise en page.
 * Colonne étroite "en un coup d'œil" (chips d'icônes colorées, une teinte
 * de marque par type de KPI) à gauche, cartes détaillées en anneau/liste à
 * droite — plutôt que la grille 4 tuiles + 3 cartes actuelle.
 */
export function VariantB() {
  const s = FIXTURE_STATS;
  const total = s.prospects.total;
  const statusEntries = Object.entries(s.prospects.byStatus).sort((a, b) => b[1] - a[1]);

  const tierColors: Record<string, string> = {
    tres_haute: "#E05010",
    haute: "#E88A4A",
    moyenne: "#1090D0",
    faible: "#8fc4e3",
    ignorer: "#e3e3df",
  };
  let acc = 0;
  const ringStops = TIER_ORDER.map((t) => {
    const pct = ((s.prospects.byTier[t] ?? 0) / total) * 100;
    const start = acc;
    acc += pct;
    return `${tierColors[t]} ${start}% ${acc}%`;
  }).join(", ");

  return (
    <div className="mp-b">
      <style>{`
        .mp-b { background: #fafaf8; }
        .mp-b .topbar { background: #fff; border-bottom: 1px solid #e3e3df; }
        .mp-b .nav-tabs button.active { color: #14151a; border-bottom-color: #1090D0; }
        .mp-b .role-pill { background: #eef1f8; border-color: #1090D0; color: #0a5a86; }
        .mp-b-main { display: flex; gap: 0; align-items: flex-start; max-width: 1180px; margin: 0 auto; }
        .mp-b-side { flex: 0 0 260px; padding: 40px 24px; border-right: 1px solid #e3e3df; position: sticky; top: 0; }
        .mp-b-side h1 { font-size: 20px; margin: 0 0 24px; }
        .mp-b-kpi { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid #edede9; }
        .mp-b-kpi:last-child { border-bottom: none; }
        .mp-b-badge { width: 34px; height: 34px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 15px; flex-shrink: 0; }
        .mp-b-kpi-val { font-size: 18px; font-weight: 700; color: #14151a; line-height: 1.1; }
        .mp-b-kpi-label { font-size: 11.5px; color: #8d8e95; }
        .mp-b-content { flex: 1; padding: 40px 32px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .mp-b-card { background: #fff; border: 1px solid #e3e3df; border-radius: 12px; padding: 22px; }
        .mp-b-card h3 { margin: 0 0 16px; font-size: 14px; color: #14151a; }
        .mp-b-ring-wrap { display: flex; align-items: center; gap: 20px; }
        .mp-b-ring { width: 108px; height: 108px; border-radius: 50%; background: conic-gradient(${ringStops}); position: relative; flex-shrink: 0; }
        .mp-b-ring::after { content: ""; position: absolute; inset: 18px; background: #fff; border-radius: 50%; }
        .mp-b-legend { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 7px; font-size: 12.5px; color: #55565f; }
        .mp-b-legend li { display: flex; align-items: center; gap: 7px; }
        .mp-b-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .mp-b-status { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; max-height: 200px; overflow-y: auto; }
        .mp-b-status li { display: flex; justify-content: space-between; font-size: 13px; color: #55565f; padding: 6px 10px; border-radius: 7px; }
        .mp-b-status li:hover { background: #f5f6f4; }
        .mp-b-import dl { display: grid; grid-template-columns: auto 1fr; gap: 6px 14px; margin: 0; font-size: 13px; }
        .mp-b-import dt { color: #8d8e95; }
        .mp-b-import dd { margin: 0; color: #14151a; font-weight: 600; }
        .mp-b-full { grid-column: 1 / -1; }
      `}</style>

      <Topbar />
      <div className="mp-b-main">
        <aside className="mp-b-side">
          <h1>Dashboard</h1>
          <div className="mp-b-kpi">
            <span className="mp-b-badge" style={{ background: "#fdece3" }}>
              👤
            </span>
            <div>
              <div className="mp-b-kpi-val">{total}</div>
              <div className="mp-b-kpi-label">Prospects</div>
            </div>
          </div>
          <div className="mp-b-kpi">
            <span className="mp-b-badge" style={{ background: "#e5f3fb" }}>
              🏢
            </span>
            <div>
              <div className="mp-b-kpi-val">{s.companies.total}</div>
              <div className="mp-b-kpi-label">Entreprises ({s.companies.withEmail} avec email)</div>
            </div>
          </div>
          <div className="mp-b-kpi">
            <span className="mp-b-badge" style={{ background: "#f6e5f2" }}>
              ✉️
            </span>
            <div>
              <div className="mp-b-kpi-val">{s.prospects.eligibleForEmail}</div>
              <div className="mp-b-kpi-label">Éligibles email</div>
            </div>
          </div>
          <div className="mp-b-kpi">
            <span className="mp-b-badge" style={{ background: "#fdece3" }}>
              ⭐
            </span>
            <div>
              <div className="mp-b-kpi-val">{(s.prospects.byTier.tres_haute ?? 0) + (s.prospects.byTier.haute ?? 0)}</div>
              <div className="mp-b-kpi-label">Très haute + haute priorité</div>
            </div>
          </div>
        </aside>

        <div className="mp-b-content">
          <div className="mp-b-card">
            <h3>Répartition par priorité</h3>
            <div className="mp-b-ring-wrap">
              <div className="mp-b-ring" />
              <ul className="mp-b-legend">
                {TIER_ORDER.map((t) => (
                  <li key={t}>
                    <span className="mp-b-dot" style={{ background: tierColors[t] }} />
                    {TIER_LABELS[t]} · {s.prospects.byTier[t] ?? 0}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mp-b-card">
            <h3>Dernier import</h3>
            <div className="mp-b-import">
              <dl>
                <dt>Statut</dt>
                <dd>{s.lastImport?.status}</dd>
                <dt>Créées</dt>
                <dd>{s.lastImport?.recordsCreated}</dd>
                <dt>Mises à jour</dt>
                <dd>{s.lastImport?.recordsUpdated}</dd>
              </dl>
            </div>
          </div>

          <div className="mp-b-card mp-b-full">
            <h3>Statuts</h3>
            <ul className="mp-b-status">
              {statusEntries.map(([status, count]) => (
                <li key={status}>
                  <span>{STATUS_LABELS[status] ?? status}</span>
                  <span>{count}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
