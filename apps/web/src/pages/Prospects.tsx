import { useEffect, useState } from "react";
import { api, type ProspectsResponse } from "../lib/api";

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

export function Prospects() {
  const [result, setResult] = useState<ProspectsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [province, setProvince] = useState("");
  const [scoreMin, setScoreMin] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params: Record<string, string> = { page: String(page), pageSize: "25" };
    if (search) params.search = search;
    if (province) params.province = province;
    if (scoreMin) params.scoreMin = scoreMin;

    api
      .prospects(params)
      .then((res) => {
        if (!cancelled) setResult(res);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Erreur de chargement.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [page, search, province, scoreMin]);

  return (
    <div className="main">
      <div className="page-head">
        <h1>Prospects</h1>
        {result && (
          <span className="count mono">
            {result.pagination.total} prospect{result.pagination.total > 1 ? "s" : ""}
          </span>
        )}
      </div>

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
                  <th>Collecté</th>
                </tr>
              </thead>
              <tbody>
                {result.data.map((p) => (
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
                    <td className="mono">{new Date(p.collectedAt).toLocaleDateString("fr-BE")}</td>
                  </tr>
                ))}
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
