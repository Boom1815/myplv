import { Topbar } from "../Topbar";
import { FIXTURE_STATS, STATUS_LABELS, TIER_LABELS, TIER_ORDER } from "../fixtures";

/**
 * Variante E — Direction expressive. Pousse le plus loin la palette de
 * marque (orange / bleu / magenta du logo) : halo dégradé discret en fond
 * d'en-tête, liseré coloré par carte selon son rôle, pastille "caméléon"
 * en dégradé comme clin d'œil au logo (sans le reprendre littéralement),
 * légère élévation au survol. La plus "Linear" des cinq — teintes vives
 * mais dosées, jamais toute la surface.
 */
export function VariantE() {
  const s = FIXTURE_STATS;
  const total = s.prospects.total;
  const statusEntries = Object.entries(s.prospects.byStatus).sort((a, b) => b[1] - a[1]);
  const tierGrad: Record<string, string> = {
    tres_haute: "linear-gradient(90deg, #E05010, #E02020)",
    haute: "linear-gradient(90deg, #E88A4A, #E05010)",
    moyenne: "linear-gradient(90deg, #1090D0, #2070B0)",
    faible: "linear-gradient(90deg, #8fc4e3, #1090D0)",
    ignorer: "#e3e3df",
  };
  const tierDot: Record<string, string> = { tres_haute: "#E05010", haute: "#E88A4A", moyenne: "#1090D0", faible: "#8fc4e3", ignorer: "#c7c8cc" };

  return (
    <div className="mp-e">
      <style>{`
        .mp-e { background: #fafaf8; }
        .mp-e .topbar { background: rgba(255,255,255,0.9); backdrop-filter: blur(6px); border-bottom: 1px solid #e3e3df; }
        .mp-e .nav-tabs button { transition: color 0.15s ease, border-color 0.15s ease; }
        .mp-e .nav-tabs button.active { color: #14151a; border-bottom: 2px solid transparent; border-image: linear-gradient(90deg, #E05010, #901080) 1; }
        .mp-e .role-pill { background: linear-gradient(90deg, #fdece3, #f6e5f2); border-color: transparent; color: #901080; font-weight: 700; }
        .mp-e-hero { position: relative; padding: 44px 40px 8px; overflow: hidden; }
        .mp-e-glow { position: absolute; top: -140px; left: 50%; transform: translateX(-50%); width: 900px; height: 320px; background: radial-gradient(closest-side, rgba(224,80,16,0.14), rgba(144,16,128,0.10) 45%, rgba(16,144,208,0.08) 70%, transparent 80%); filter: blur(6px); pointer-events: none; }
        .mp-e-hero-inner { position: relative; max-width: 1080px; margin: 0 auto; display: flex; align-items: center; gap: 14px; }
        .mp-e-mark { width: 34px; height: 34px; border-radius: 10px; background: conic-gradient(from 200deg, #E05010, #E00070, #901080, #1090D0, #E05010); flex-shrink: 0; box-shadow: 0 4px 14px rgba(144,16,128,0.25); }
        .mp-e-hero h1 { font-size: 24px; margin: 0; letter-spacing: -0.02em; }
        .mp-e-main { padding: 24px 40px 44px; max-width: 1080px; margin: 0 auto; }
        .mp-e-stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 22px; }
        .mp-e-stat { background: #fff; border: 1px solid #e3e3df; border-radius: 12px; padding: 18px 20px; display: flex; flex-direction: column; gap: 5px; transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease; }
        .mp-e-stat:hover { transform: translateY(-3px); box-shadow: 0 12px 28px -8px rgba(20,21,26,0.16); border-color: #e3e3df; }
        .mp-e-stat-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #8d8e95; }
        .mp-e-stat-val { font-size: 27px; font-weight: 800; letter-spacing: -0.02em; color: #14151a; }
        .mp-e-stat.accent .mp-e-stat-val { background: linear-gradient(90deg, #E05010, #901080); -webkit-background-clip: text; background-clip: text; color: transparent; }
        .mp-e-grid { display: grid; grid-template-columns: 1.2fr 1fr; gap: 16px; }
        .mp-e-card { background: #fff; border: 1px solid #e3e3df; border-radius: 12px; padding: 20px 22px; border-left: 3px solid transparent; transition: box-shadow 0.18s ease, transform 0.18s ease; }
        .mp-e-card:hover { box-shadow: 0 14px 32px -12px rgba(20,21,26,0.16); transform: translateY(-2px); }
        .mp-e-card.tier { border-left-color: #E05010; }
        .mp-e-card.status { border-left-color: #1090D0; }
        .mp-e-card.import { border-left-color: #901080; }
        .mp-e-card h3 { margin: 0 0 14px; font-size: 14px; }
        .mp-e-bar { display: flex; height: 9px; border-radius: 6px; overflow: hidden; background: #edede9; margin-bottom: 12px; }
        .mp-e-seg { height: 100%; transition: filter 0.15s ease; }
        .mp-e-seg:hover { filter: brightness(1.08); }
        .mp-e-legend { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 7px; font-size: 12.5px; color: #55565f; }
        .mp-e-legend li { display: flex; align-items: center; gap: 8px; }
        .mp-e-dot { width: 8px; height: 8px; border-radius: 50%; }
        .mp-e-status-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; max-height: 220px; overflow-y: auto; }
        .mp-e-status-list li { display: flex; justify-content: space-between; padding: 8px 10px; border-radius: 8px; font-size: 13px; color: #55565f; transition: background 0.15s ease; }
        .mp-e-status-list li:hover { background: linear-gradient(90deg, #fdece3, #fff); color: #14151a; }
        .mp-e-card.import dl { display: grid; grid-template-columns: auto 1fr; gap: 7px 14px; margin: 0; font-size: 13px; }
        .mp-e-card.import dt { color: #8d8e95; }
        .mp-e-card.import dd { margin: 0; color: #14151a; font-weight: 700; }
      `}</style>

      <Topbar />
      <div className="mp-e-hero">
        <div className="mp-e-glow" />
        <div className="mp-e-hero-inner">
          <span className="mp-e-mark" />
          <h1>Dashboard</h1>
        </div>
      </div>

      <div className="mp-e-main">
        <div className="mp-e-stat-grid">
          <div className="mp-e-stat">
            <span className="mp-e-stat-label">Prospects</span>
            <span className="mp-e-stat-val">{total}</span>
          </div>
          <div className="mp-e-stat">
            <span className="mp-e-stat-label">Entreprises</span>
            <span className="mp-e-stat-val">{s.companies.total}</span>
          </div>
          <div className="mp-e-stat accent">
            <span className="mp-e-stat-label">Éligibles envoi email</span>
            <span className="mp-e-stat-val">{s.prospects.eligibleForEmail}</span>
          </div>
          <div className="mp-e-stat">
            <span className="mp-e-stat-label">Très haute + haute priorité</span>
            <span className="mp-e-stat-val">{(s.prospects.byTier.tres_haute ?? 0) + (s.prospects.byTier.haute ?? 0)}</span>
          </div>
        </div>

        <div className="mp-e-grid">
          <div className="mp-e-card tier">
            <h3>Répartition par priorité</h3>
            <div className="mp-e-bar">
              {TIER_ORDER.map((t) => {
                const count = s.prospects.byTier[t] ?? 0;
                const pct = (count / total) * 100;
                return <div key={t} className="mp-e-seg" style={{ width: `${pct}%`, background: tierGrad[t] }} title={TIER_LABELS[t]} />;
              })}
            </div>
            <ul className="mp-e-legend">
              {TIER_ORDER.map((t) => (
                <li key={t}>
                  <span className="mp-e-dot" style={{ background: tierDot[t] }} />
                  {TIER_LABELS[t]}
                  <span style={{ marginLeft: "auto" }}>{s.prospects.byTier[t] ?? 0}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mp-e-card import">
            <h3>Dernier import</h3>
            <dl>
              <dt>Statut</dt>
              <dd>{s.lastImport?.status}</dd>
              <dt>Créées</dt>
              <dd>{s.lastImport?.recordsCreated}</dd>
              <dt>Mises à jour</dt>
              <dd>{s.lastImport?.recordsUpdated}</dd>
              <dt>Ignorées</dt>
              <dd>{s.lastImport?.recordsSkipped}</dd>
            </dl>
          </div>

          <div className="mp-e-card status" style={{ gridColumn: "1 / -1" }}>
            <h3>Statuts</h3>
            <ul className="mp-e-status-list" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 14px" }}>
              {statusEntries.map(([status, count]) => (
                <li key={status}>
                  <span>{STATUS_LABELS[status] ?? status}</span>
                  <span style={{ fontWeight: 700 }}>{count}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
