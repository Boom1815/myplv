import { useEffect, useRef, useState } from "react";
import { Topbar } from "../Topbar";
import { FIXTURE_STATS, STATUS_LABELS, TIER_LABELS, TIER_ORDER } from "../fixtures";

/** Compte de 0 à `value` sur ~700ms (ease-out), respecte prefers-reduced-motion. */
function useCountUp(value: number, durationMs = 700) {
  const [display, setDisplay] = useState(0);
  const startRef = useRef<number | null>(null);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setDisplay(value);
      return;
    }
    startRef.current = null;
    let raf: number;
    function tick(ts: number) {
      if (startRef.current === null) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const t = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(value * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return display;
}

function AnimatedStat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  const shown = useCountUp(value);
  return (
    <div className="mp-d-stat">
      <span className="mp-d-stat-label">{label}</span>
      <span className="mp-d-stat-val" style={accent ? { color: accent } : undefined}>
        {shown.toLocaleString("fr-BE")}
      </span>
    </div>
  );
}

/**
 * Variante D — Modèle d'interaction. Les chiffres comptent depuis 0 à
 * l'affichage, les barres de priorité poussent depuis la gauche, un survol
 * sur un segment affiche une bulle de détail, un point "live" pulse près du
 * dernier import. Répond directement à "manque de vie/de feedback".
 */
export function VariantD() {
  const s = FIXTURE_STATS;
  const total = s.prospects.total;
  const statusEntries = Object.entries(s.prospects.byStatus).sort((a, b) => b[1] - a[1]);
  const [grown, setGrown] = useState(false);
  const [hoverTier, setHoverTier] = useState<string | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setGrown(true), 60);
    return () => clearTimeout(t);
  }, []);
  const tierColor: Record<string, string> = { tres_haute: "#E05010", haute: "#E88A4A", moyenne: "#1090D0", faible: "#8fc4e3", ignorer: "#e3e3df" };

  return (
    <div className="mp-d">
      <style>{`
        .mp-d { background: #fafaf8; }
        .mp-d .topbar { background: #fff; border-bottom: 1px solid #e3e3df; }
        .mp-d .nav-tabs button { transition: color 0.15s ease, border-color 0.15s ease; }
        .mp-d .nav-tabs button.active { color: #14151a; border-bottom-color: #901080; }
        .mp-d-main { padding: 40px; max-width: 1080px; margin: 0 auto; }
        .mp-d-stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: #e3e3df; border: 1px solid #e3e3df; margin-bottom: 24px; border-radius: 10px; overflow: hidden; }
        .mp-d-stat { background: #fff; padding: 18px 20px; display: flex; flex-direction: column; gap: 4px; transition: background 0.2s ease; }
        .mp-d-stat:hover { background: #fdfaf7; }
        .mp-d-stat-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #8d8e95; }
        .mp-d-stat-val { font-size: 27px; font-weight: 700; color: #14151a; font-variant-numeric: tabular-nums; }
        .mp-d-grid { display: grid; grid-template-columns: 1.2fr 1fr; gap: 20px; }
        .mp-d-card { background: #fff; border: 1px solid #e3e3df; border-radius: 10px; padding: 20px 22px; }
        .mp-d-card h3 { margin: 0 0 14px; font-size: 14px; }
        .mp-d-bar { display: flex; height: 10px; border-radius: 6px; overflow: hidden; background: #edede9; margin-bottom: 12px; position: relative; }
        .mp-d-seg { height: 100%; transition: width 0.9s cubic-bezier(0.16,1,0.3,1); cursor: pointer; }
        .mp-d-tooltip { position: absolute; bottom: calc(100% + 8px); background: #14151a; color: #fff; font-size: 11.5px; padding: 6px 10px; border-radius: 6px; white-space: nowrap; transform: translateX(-50%); pointer-events: none; animation: mp-d-pop 0.15s ease-out; }
        @keyframes mp-d-pop { from { opacity: 0; transform: translateX(-50%) translateY(4px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
        .mp-d-legend { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 7px; font-size: 12.5px; color: #55565f; }
        .mp-d-legend li { display: flex; align-items: center; gap: 8px; }
        .mp-d-dot { width: 8px; height: 8px; border-radius: 50%; }
        .mp-d-status-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; max-height: 240px; overflow-y: auto; }
        .mp-d-status-list li { display: flex; justify-content: space-between; padding: 8px 10px; border-radius: 7px; font-size: 13px; color: #55565f; transition: background 0.15s ease, transform 0.15s ease; }
        .mp-d-status-list li:hover { background: #f5f0fa; transform: translateX(3px); color: #14151a; }
        .mp-d-live { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: #3e7a54; margin-top: 12px; }
        .mp-d-live-dot { width: 7px; height: 7px; border-radius: 50%; background: #3e7a54; animation: mp-d-pulse 1.6s ease-in-out infinite; }
        @keyframes mp-d-pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(62,122,84,0.5); } 50% { box-shadow: 0 0 0 5px rgba(62,122,84,0); } }
      `}</style>

      <Topbar />
      <div className="mp-d-main">
        <h1 style={{ fontSize: 22, margin: "0 0 20px" }}>Dashboard</h1>

        <div className="mp-d-stat-grid">
          <AnimatedStat label="Prospects" value={total} />
          <AnimatedStat label="Entreprises" value={s.companies.total} />
          <AnimatedStat label="Éligibles envoi email" value={s.prospects.eligibleForEmail} accent="#E05010" />
          <AnimatedStat label="Très haute + haute priorité" value={(s.prospects.byTier.tres_haute ?? 0) + (s.prospects.byTier.haute ?? 0)} accent="#901080" />
        </div>

        <div className="mp-d-grid">
          <div className="mp-d-card">
            <h3>Répartition par priorité</h3>
            <div className="mp-d-bar">
              {TIER_ORDER.map((t) => {
                const count = s.prospects.byTier[t] ?? 0;
                const pct = (count / total) * 100;
                return (
                  <div
                    key={t}
                    className="mp-d-seg"
                    style={{ width: grown ? `${pct}%` : "0%", background: tierColor[t] }}
                    onMouseEnter={() => setHoverTier(t)}
                    onMouseLeave={() => setHoverTier(null)}
                  >
                    {hoverTier === t && (
                      <span className="mp-d-tooltip" style={{ left: "50%" }}>
                        {TIER_LABELS[t]} — {count} ({pct.toFixed(0)}%)
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <ul className="mp-d-legend">
              {TIER_ORDER.map((t) => (
                <li key={t}>
                  <span className="mp-d-dot" style={{ background: tierColor[t] }} />
                  {TIER_LABELS[t]}
                  <span style={{ marginLeft: "auto" }}>{s.prospects.byTier[t] ?? 0}</span>
                </li>
              ))}
            </ul>
            <div className="mp-d-live">
              <span className="mp-d-live-dot" />
              Dernier import : {s.lastImport?.status}
            </div>
          </div>

          <div className="mp-d-card">
            <h3>Statuts</h3>
            <ul className="mp-d-status-list">
              {statusEntries.map(([status, count]) => (
                <li key={status}>
                  <span>{STATUS_LABELS[status] ?? status}</span>
                  <span style={{ fontWeight: 600, color: "#14151a" }}>{count}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
