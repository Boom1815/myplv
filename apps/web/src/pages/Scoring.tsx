import { useEffect, useState } from "react";
import { api, type ScoringRule } from "../lib/api";
import { InfoTooltip } from "../components/InfoTooltip";

export function Scoring({ isAdmin }: { isAdmin: boolean }) {
  const [rules, setRules] = useState<ScoringRule[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [recomputing, setRecomputing] = useState(false);
  const [recomputeResult, setRecomputeResult] = useState<string | null>(null);

  function load() {
    api
      .scoringRules()
      .then((res) => setRules(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : "Erreur de chargement."));
  }

  useEffect(load, []);

  async function handlePointsChange(rule: ScoringRule, points: number) {
    setRules((prev) => prev?.map((r) => (r.id === rule.id ? { ...r, points } : r)) ?? prev);
  }

  async function savePoints(rule: ScoringRule) {
    setSavingId(rule.id);
    try {
      await api.updateScoringRule(rule.id, { points: rule.points });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de la sauvegarde.");
    } finally {
      setSavingId(null);
    }
  }

  async function toggleActive(rule: ScoringRule) {
    const nextActive = !rule.isActive;
    setRules((prev) => prev?.map((r) => (r.id === rule.id ? { ...r, isActive: nextActive } : r)) ?? prev);
    try {
      await api.updateScoringRule(rule.id, { isActive: nextActive });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de la sauvegarde.");
      load();
    }
  }

  async function handleRecompute() {
    setRecomputing(true);
    setRecomputeResult(null);
    setError(null);
    try {
      const res = await api.recomputeScores();
      const parts = Object.entries(res.tierCounts)
        .map(([tier, count]) => `${count} ${tier}`)
        .join(", ");
      setRecomputeResult(`${res.total} prospects notés (${parts}) — ${res.eligibleCount} éligibles à l'envoi email.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec du recalcul.");
    } finally {
      setRecomputing(false);
    }
  }

  return (
    <div className="main">
      <div className="page-head">
        <h1>
          Scoring
          <InfoTooltip>
            <p>Chaque règle ajoute (ou retire) des points à un prospect quand sa condition est vraie — le total détermine sa priorité (voir Dashboard).</p>
            <p>Modifier les points ou activer/désactiver une règle ne change rien immédiatement : clique « Recalculer les scores » pour appliquer les nouveaux réglages à tous les prospects existants.</p>
          </InfoTooltip>
        </h1>
        {isAdmin && (
          <button className="btn btn-primary" onClick={handleRecompute} disabled={recomputing}>
            {recomputing ? "Recalcul en cours..." : "Recalculer les scores"}
          </button>
        )}
      </div>

      {!isAdmin && (
        <p className="lede" style={{ marginBottom: 16 }}>
          Lecture seule — la modification des règles est réservée aux administrateurs.
        </p>
      )}

      {error && <div className="form-error">{error}</div>}
      {recomputeResult && (
        <div className="callout-inline" style={{ marginBottom: 16, fontSize: 13.5, color: "var(--good)" }}>
          ✓ {recomputeResult}
        </div>
      )}

      <div className="table-wrap">
        {!rules ? (
          <div className="empty-state">Chargement…</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Règle</th>
                <th>Points</th>
                <th>Actif</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id}>
                  <td>
                    <strong>{rule.label}</strong>
                    <div className="mono" style={{ fontSize: 11, color: "var(--ink-faint)" }}>
                      {rule.slug}
                    </div>
                  </td>
                  <td>
                    <input
                      type="number"
                      className="mono"
                      style={{ width: 72, padding: "5px 8px", borderRadius: 6, border: "1px solid var(--line)" }}
                      value={rule.points}
                      disabled={!isAdmin}
                      onChange={(e) => handlePointsChange(rule, Number(e.target.value))}
                      onBlur={() => isAdmin && savePoints(rule)}
                    />
                    {savingId === rule.id && (
                      <span style={{ marginLeft: 8, fontSize: 12, color: "var(--ink-faint)" }}>…</span>
                    )}
                  </td>
                  <td>
                    <button
                      className="btn"
                      disabled={!isAdmin}
                      onClick={() => toggleActive(rule)}
                      style={
                        rule.isActive
                          ? { background: "var(--good-soft)", color: "var(--good)", borderColor: "transparent" }
                          : undefined
                      }
                    >
                      {rule.isActive ? "Actif" : "Inactif"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
