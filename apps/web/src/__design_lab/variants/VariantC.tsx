import { Topbar } from "../Topbar";
import { FIXTURE_STATS, STATUS_LABELS, TIER_LABELS, TIER_ORDER } from "../fixtures";

/**
 * Variante C — Densité (plus compacte que le "confortable" actuel, pour
 * montrer le compromis lisibilité / quantité visible). Tuiles plus
 * petites, tout tient sur un écran sans scroll. Couleur en petites touches
 * (points, mini-barres) plutôt qu'en aplats.
 */
export function VariantC() {
  const s = FIXTURE_STATS;
  const total = s.prospects.total;
  const statusEntries = Object.entries(s.prospects.byStatus).sort((a, b) => b[1] - a[1]);
  const tierColor: Record<string, string> = { tres_haute: "#E05010", haute: "#E88A4A", moyenne: "#1090D0", faible: "#8fc4e3", ignorer: "#c7c8cc" };
  const maxStatus = Math.max(...statusEntries.map(([, c]) => c));

  return (
    <div className="mp-c">
      <style>{`
        .mp-c { background: #fafaf8; font-size: 13px; }
        .mp-c .topbar { background: #fff; border-bottom: 1px solid #e3e3df; padding: 12px 24px; }
        .mp-c .nav-tabs button.active { color: #14151a; border-bottom-color: #E05010; }
        .mp-c-main { padding: 24px 28px; max-width: 1180px; margin: 0 auto; }
        .mp-c-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 16px; }
        .mp-c-head h1 { font-size: 18px; margin: 0; }
        .mp-c-stat-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 1px; background: #e3e3df; border: 1px solid #e3e3df; margin-bottom: 16px; }
        .mp-c-stat { background: #fff; padding: 10px 12px; display: flex; flex-direction: column; gap: 2px; }
        .mp-c-stat-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; color: #8d8e95; }
        .mp-c-stat-val { font-size: 18px; font-weight: 700; color: #14151a; }
        .mp-c-grid { display: grid; grid-template-columns: 1fr 1fr 0.8fr; gap: 12px; }
        .mp-c-card { background: #fff; border: 1px solid #e3e3df; border-radius: 6px; padding: 14px 16px; }
        .mp-c-card h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #8d8e95; margin: 0 0 10px; }
        .mp-c-row { display: flex; align-items: center; gap: 8px; padding: 3px 0; font-size: 12.5px; color: #55565f; }
        .mp-c-row-label { width: 74px; flex-shrink: 0; }
        .mp-c-mini-bar-track { flex: 1; height: 5px; background: #edede9; border-radius: 3px; overflow: hidden; }
        .mp-c-mini-bar { height: 100%; border-radius: 3px; }
        .mp-c-row-val { width: 32px; text-align: right; color: #14151a; font-weight: 600; flex-shrink: 0; }
        .mp-c-status-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 14px; }
        .mp-c-status-item { display: flex; justify-content: space-between; font-size: 12px; padding: 2px 0; border-bottom: 1px dotted #edede9; }
        .mp-c-import-item { display: flex; justify-content: space-between; font-size: 12px; padding: 3px 0; }
        .mp-c-import-item b { color: #14151a; }
      `}</style>

      <Topbar />
      <div className="mp-c-main">
        <div className="mp-c-head">
          <h1>Dashboard</h1>
          <span style={{ fontSize: 11.5, color: "#8d8e95" }}>Mis à jour automatiquement</span>
        </div>

        <div className="mp-c-stat-grid">
          <div className="mp-c-stat">
            <span className="mp-c-stat-label">Prospects</span>
            <span className="mp-c-stat-val">{total}</span>
          </div>
          <div className="mp-c-stat">
            <span className="mp-c-stat-label">Entreprises</span>
            <span className="mp-c-stat-val">{s.companies.total}</span>
          </div>
          <div className="mp-c-stat">
            <span className="mp-c-stat-label">Avec email</span>
            <span className="mp-c-stat-val">{s.companies.withEmail}</span>
          </div>
          <div className="mp-c-stat">
            <span className="mp-c-stat-label">Éligibles</span>
            <span className="mp-c-stat-val" style={{ color: "#E05010" }}>
              {s.prospects.eligibleForEmail}
            </span>
          </div>
          <div className="mp-c-stat">
            <span className="mp-c-stat-label">Prio. haute+</span>
            <span className="mp-c-stat-val">{(s.prospects.byTier.tres_haute ?? 0) + (s.prospects.byTier.haute ?? 0)}</span>
          </div>
          <div className="mp-c-stat">
            <span className="mp-c-stat-label">Dernier import</span>
            <span className="mp-c-stat-val" style={{ fontSize: 13 }}>
              {s.lastImport?.status}
            </span>
          </div>
        </div>

        <div className="mp-c-grid">
          <div className="mp-c-card">
            <h3>Priorité</h3>
            {TIER_ORDER.map((t) => {
              const count = s.prospects.byTier[t] ?? 0;
              const pct = (count / total) * 100;
              return (
                <div className="mp-c-row" key={t}>
                  <span className="mp-c-row-label">{TIER_LABELS[t]}</span>
                  <span className="mp-c-mini-bar-track">
                    <span className="mp-c-mini-bar" style={{ width: `${pct}%`, background: tierColor[t] }} />
                  </span>
                  <span className="mp-c-row-val">{count}</span>
                </div>
              );
            })}
          </div>

          <div className="mp-c-card">
            <h3>Statuts</h3>
            <div className="mp-c-status-grid">
              {statusEntries.map(([status, count]) => (
                <div className="mp-c-status-item" key={status}>
                  <span>{STATUS_LABELS[status] ?? status}</span>
                  <span style={{ color: count === maxStatus ? "#E05010" : "#14151a", fontWeight: 600 }}>{count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mp-c-card">
            <h3>Dernier import</h3>
            <div className="mp-c-import-item">
              <span>Créées</span>
              <b>{s.lastImport?.recordsCreated}</b>
            </div>
            <div className="mp-c-import-item">
              <span>Mises à jour</span>
              <b>{s.lastImport?.recordsUpdated}</b>
            </div>
            <div className="mp-c-import-item">
              <span>Ignorées</span>
              <b>{s.lastImport?.recordsSkipped}</b>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
