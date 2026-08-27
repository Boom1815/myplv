import { useEffect, useState, type FormEvent } from "react";
import { api, type BlacklistRule } from "../lib/api";
import { InfoTooltip } from "../components/InfoTooltip";

const SCOPE_LABELS: Record<string, string> = {
  nace_code: "Code NACE",
  sector: "Secteur",
  keyword: "Mot-clé",
  municipality: "Commune",
  company: "Entreprise",
  email: "Email",
  domain: "Domaine",
  contact: "Contact",
};

export function Blacklist({ isAdmin }: { isAdmin: boolean }) {
  const [rules, setRules] = useState<BlacklistRule[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState("keyword");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function load() {
    api
      .blacklist()
      .then((res) => setRules(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : "Erreur de chargement."));
  }

  useEffect(load, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.addBlacklistRule(scope, value.trim(), reason.trim() || undefined);
      setValue("");
      setReason("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de l'ajout.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      await api.deleteBlacklistRule(id);
      setRules((prev) => prev?.filter((r) => r.id !== id) ?? prev);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de la suppression.");
    }
  }

  return (
    <div className="main">
      <div className="page-head">
        <h1>
          Liste noire
          <InfoTooltip>Chaque règle exclut automatiquement les entreprises correspondantes — dès l'import, avant tout scoring ou envoi. Choisis le type qui décrit le mieux ce que tu veux bloquer (un mot dans le nom, une commune, une adresse précise…).</InfoTooltip>
        </h1>
        {rules && <span className="count mono">{rules.length} règle{rules.length > 1 ? "s" : ""}</span>}
      </div>
      <p className="lede" style={{ marginBottom: 16 }}>
        Une entreprise qui correspond à une règle active est exclue automatiquement de la
        prospection dès l'import — jamais intégrée à une campagne.
      </p>

      {isAdmin && (
        <form className="filters" onSubmit={handleSubmit} style={{ alignItems: "flex-end" }}>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "var(--ink-faint)", marginBottom: 4 }}>Type</label>
            <select value={scope} onChange={(e) => setScope(e.target.value)}>
              {Object.entries(SCOPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "var(--ink-faint)", marginBottom: 4 }}>Valeur</label>
            <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="ex : friterie" required />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "var(--ink-faint)", marginBottom: 4 }}>
              Raison (optionnel)
            </label>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="ex : hors cible" />
          </div>
          <button className="btn btn-primary" type="submit" disabled={submitting}>
            {submitting ? "Ajout..." : "Ajouter"}
          </button>
        </form>
      )}

      {error && <div className="form-error">{error}</div>}

      <div className="table-wrap">
        {!rules ? (
          <div className="empty-state">Chargement…</div>
        ) : rules.length === 0 ? (
          <div className="empty-state">Aucune règle de liste noire pour l'instant.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Valeur</th>
                <th>Raison</th>
                <th>Ajoutée le</th>
                {isAdmin && <th></th>}
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id}>
                  <td>
                    <span className="pill-scope">{SCOPE_LABELS[rule.scope] ?? rule.scope}</span>
                  </td>
                  <td>{rule.value}</td>
                  <td style={{ color: "var(--ink-faint)" }}>{rule.reason ?? "—"}</td>
                  <td className="mono">{new Date(rule.createdAt).toLocaleDateString("fr-BE")}</td>
                  {isAdmin && (
                    <td>
                      <button className="btn" onClick={() => handleDelete(rule.id)}>
                        Retirer
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
