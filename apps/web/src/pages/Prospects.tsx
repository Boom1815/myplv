import { useEffect, useState } from "react";
import { api, type ProspectsResponse, type Tag } from "../lib/api";
import { InfoTooltip } from "../components/InfoTooltip";

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

const TIER_LABELS: Record<string, string> = {
  tres_haute: "Très haute",
  haute: "Haute",
  moyenne: "Moyenne",
  faible: "Faible",
  ignorer: "Ignorer",
};

export function Prospects({ isAdmin }: { isAdmin: boolean }) {
  const [result, setResult] = useState<ProspectsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [province, setProvince] = useState("");
  const [scoreMin, setScoreMin] = useState("");

  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [showTagManager, setShowTagManager] = useState(false);
  const [newTagLabel, setNewTagLabel] = useState("");

  function loadProspects() {
    setLoading(true);
    setError(null);

    const params: Record<string, string> = { page: String(page), pageSize: "25" };
    if (search) params.search = search;
    if (province) params.province = province;
    if (scoreMin) params.scoreMin = scoreMin;

    api
      .prospects(params)
      .then(setResult)
      .catch((err) => setError(err instanceof Error ? err.message : "Erreur de chargement."))
      .finally(() => setLoading(false));
  }

  function loadTags() {
    api.tags().then((res) => setAllTags(res.data)).catch(() => {});
  }

  useEffect(loadProspects, [page, search, province, scoreMin]);
  useEffect(loadTags, []);

  async function handleCreateTag() {
    if (!newTagLabel.trim()) return;
    try {
      await api.addTag(newTagLabel.trim());
      setNewTagLabel("");
      loadTags();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de la création du tag.");
    }
  }

  async function handleDeleteTag(id: string) {
    try {
      await api.deleteTag(id);
      loadTags();
      loadProspects();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de la suppression.");
    }
  }

  async function handleAssign(prospectId: string, tagId: string) {
    if (!tagId) return;
    try {
      await api.assignTag(prospectId, tagId);
      loadProspects();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de l'affectation.");
    }
  }

  async function handleUnassign(prospectId: string, tagId: string) {
    try {
      await api.unassignTag(prospectId, tagId);
      loadProspects();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec du retrait.");
    }
  }

  return (
    <div className="main">
      <div className="page-head page-head--hero">
        <h1>
          <span className="brand-mark" aria-hidden="true" />
          Prospects
          <InfoTooltip>Chaque ligne est une entreprise qualifiée (voir Scoring). Les tags sont libres — utilise-les pour marquer un suivi personnel (ex. « appelé », « HOT »), ils n'affectent ni le score ni les campagnes.</InfoTooltip>
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {isAdmin && (
            <button className="btn" onClick={() => setShowTagManager((v) => !v)}>
              Gérer les tags
            </button>
          )}
          {result && (
            <span className="count mono">
              {result.pagination.total} prospect{result.pagination.total > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {showTagManager && isAdmin && (
        <div className="card-block" style={{ marginBottom: 16 }}>
          <h3>Tags</h3>
          <div className="nace-chips" style={{ marginBottom: 10 }}>
            {allTags.length === 0 && <span style={{ fontSize: 12.5, color: "var(--ink-faint)" }}>Aucun tag pour l'instant.</span>}
            {allTags.map((t) => (
              <span className="nace-chip" key={t.id}>
                {t.label}
                <button onClick={() => handleDeleteTag(t.id)} aria-label={`Supprimer ${t.label}`}>
                  ×
                </button>
              </span>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              placeholder="Nouveau tag (ex : HOT)"
              value={newTagLabel}
              onChange={(e) => setNewTagLabel(e.target.value)}
              style={{ flex: 1, maxWidth: 240, padding: "6px 9px", borderRadius: 6, border: "1px solid var(--line)", fontSize: 13 }}
            />
            <button className="btn" onClick={handleCreateTag}>
              Créer
            </button>
          </div>
        </div>
      )}

      <div className="filters">
        <input
          type="search"
          placeholder="Rechercher (entreprise, email)…"
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
        />
        <select
          value={province}
          onChange={(e) => {
            setPage(1);
            setProvince(e.target.value);
          }}
        >
          <option value="">Toutes les provinces</option>
          <option value="Bruxelles-Capitale">Bruxelles-Capitale</option>
          <option value="Brabant wallon">Brabant wallon</option>
          <option value="Hainaut">Hainaut</option>
          <option value="Namur">Namur</option>
        </select>
        <select
          value={scoreMin}
          onChange={(e) => {
            setPage(1);
            setScoreMin(e.target.value);
          }}
        >
          <option value="">Score minimum</option>
          <option value="80">80+ (très haute priorité)</option>
          <option value="60">60+ (haute priorité)</option>
          <option value="40">40+ (moyenne priorité)</option>
        </select>
      </div>

      {error && <div className="form-error">{error}</div>}

      <div className="table-wrap">
        {loading ? (
          <div className="empty-state">Chargement…</div>
        ) : !result || result.data.length === 0 ? (
          <div className="empty-state">
            Aucun prospect pour l'instant. Lance un import (KBO Open Data) pour peupler cette liste.
          </div>
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  <th>Entreprise</th>
                  <th>Commune</th>
                  <th>Province</th>
                  <th>Email</th>
                  <th>Score</th>
                  <th>Statut</th>
                  <th>Tags</th>
                  <th>Collecté</th>
                </tr>
              </thead>
              <tbody>
                {result.data.map((p) => {
                  const availableTags = allTags.filter((t) => !p.tags.some((pt) => pt.id === t.id));
                  return (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.companyName}</strong>
                        {p.enterpriseNumber && (
                          <div className="mono" style={{ fontSize: 11, color: "var(--ink-faint)" }}>
                            {p.enterpriseNumber}
                          </div>
                        )}
                      </td>
                      <td>{p.municipality ?? "—"}</td>
                      <td>{p.province ?? "—"}</td>
                      <td>{p.email ?? "—"}</td>
                      <td>
                        <span className={`score-tier ${p.scoreTier}`}>
                          {p.score} · {TIER_LABELS[p.scoreTier] ?? p.scoreTier}
                        </span>
                      </td>
                      <td>{STATUS_LABELS[p.status] ?? p.status}</td>
                      <td>
                        <div className="nace-chips" style={{ marginTop: 0 }}>
                          {p.tags.map((t) => (
                            <span className="nace-chip" key={t.id}>
                              {t.label}
                              {isAdmin && (
                                <button onClick={() => handleUnassign(p.id, t.id)} aria-label={`Retirer ${t.label}`}>
                                  ×
                                </button>
                              )}
                            </span>
                          ))}
                          {isAdmin && availableTags.length > 0 && (
                            <select
                              value=""
                              onChange={(e) => handleAssign(p.id, e.target.value)}
                              style={{ fontSize: 11, padding: "2px 4px", borderRadius: 6, border: "1px solid var(--line)" }}
                            >
                              <option value="">+ tag</option>
                              {availableTags.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.label}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      </td>
                      <td className="mono">{new Date(p.collectedAt).toLocaleDateString("fr-BE")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="pagination">
              <span>
                Page {result.pagination.page} / {result.pagination.totalPages}
              </span>
              <div className="controls">
                <button className="btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Précédent
                </button>
                <button
                  className="btn"
                  disabled={page >= result.pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Suivant
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
