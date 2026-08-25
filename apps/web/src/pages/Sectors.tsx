import { useEffect, useState, type FormEvent } from "react";
import { api, type Sector } from "../lib/api";

export function Sectors({ isAdmin }: { isAdmin: boolean }) {
  const [sectors, setSectors] = useState<Sector[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [naceDrafts, setNaceDrafts] = useState<Record<string, string>>({});

  function load() {
    api
      .sectors()
      .then((res) => setSectors(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : "Erreur de chargement."));
  }

  useEffect(load, []);

  async function handleAddSector(e: FormEvent) {
    e.preventDefault();
    if (!newLabel.trim()) return;
    setError(null);
    try {
      await api.addSector(newLabel.trim());
      setNewLabel("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de la création.");
    }
  }

  async function handleAddRule(sectorId: string) {
    const prefix = naceDrafts[sectorId]?.trim();
    if (!prefix) return;
    setError(null);
    try {
      await api.addNaceRule(sectorId, prefix);
      setNaceDrafts((d) => ({ ...d, [sectorId]: "" }));
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de l'ajout de la règle.");
    }
  }

  async function handleRemoveRule(sectorId: string, ruleId: string) {
    setError(null);
    try {
      await api.deleteNaceRule(sectorId, ruleId);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de la suppression.");
    }
  }

  async function handleDeleteSector(id: string) {
    setError(null);
    try {
      await api.deleteSector(id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de la suppression.");
    }
  }

  return (
    <div className="main">
      <div className="page-head">
        <h1>Secteurs</h1>
        {sectors && <span className="count mono">{sectors.length} secteurs</span>}
      </div>
      <p className="lede" style={{ marginBottom: 16 }}>
        Chaque secteur regroupe un ou plusieurs préfixes de code NACE. Une entreprise est
        rattachée au secteur dont le préfixe correspond, en priorité la plus haute puis le
        préfixe le plus spécifique.
      </p>

      {isAdmin && (
        <form onSubmit={handleAddSector} className="filters" style={{ marginBottom: 20 }}>
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Nom du nouveau secteur (ex : Bien-être)"
            style={{ minWidth: 260 }}
          />
          <button className="btn btn-primary" type="submit">
            Créer un secteur
          </button>
        </form>
      )}

      {error && <div className="form-error">{error}</div>}

      {!sectors ? (
        <div className="empty-state">Chargement…</div>
      ) : (
        <div className="sector-grid">
          {sectors.map((sector) => (
            <div className="card-block" key={sector.id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <h3>{sector.label}</h3>
                {isAdmin && (
                  <button className="btn" onClick={() => handleDeleteSector(sector.id)} style={{ fontSize: 12 }}>
                    Supprimer
                  </button>
                )}
              </div>
              <div className="nace-chips">
                {sector.naceRules.length === 0 && (
                  <span style={{ fontSize: 12.5, color: "var(--ink-faint)" }}>Aucun préfixe NACE associé.</span>
                )}
                {sector.naceRules.map((rule) => (
                  <span className="nace-chip mono" key={rule.id}>
                    {rule.nacePrefix}
                    {isAdmin && (
                      <button onClick={() => handleRemoveRule(sector.id, rule.id)} aria-label={`Retirer ${rule.nacePrefix}`}>
                        ×
                      </button>
                    )}
                  </span>
                ))}
              </div>
              {isAdmin && (
                <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                  <input
                    className="mono"
                    placeholder="Préfixe NACE (ex : 56)"
                    value={naceDrafts[sector.id] ?? ""}
                    onChange={(e) => setNaceDrafts((d) => ({ ...d, [sector.id]: e.target.value }))}
                    style={{ flex: 1, padding: "6px 9px", borderRadius: 6, border: "1px solid var(--line)", fontSize: 13 }}
                  />
                  <button className="btn" onClick={() => handleAddRule(sector.id)}>
                    Ajouter
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
