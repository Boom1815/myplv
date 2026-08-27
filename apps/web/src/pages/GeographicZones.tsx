import { useEffect, useState, type FormEvent } from "react";
import { api, type GeoZone } from "../lib/api";
import { InfoTooltip } from "../components/InfoTooltip";

const DEFAULT_PROVINCES = ["Bruxelles-Capitale", "Brabant wallon", "Hainaut", "Namur"];

export function GeographicZones({ isAdmin }: { isAdmin: boolean }) {
  const [zones, setZones] = useState<GeoZone[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [postalCode, setPostalCode] = useState("");
  const [municipality, setMunicipality] = useState("");
  const [province, setProvince] = useState(DEFAULT_PROVINCES[0]);
  const [mode, setMode] = useState<"include" | "exclude">("exclude");
  const [submitting, setSubmitting] = useState(false);

  function load() {
    api
      .geographicZones()
      .then((res) => setZones(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : "Erreur de chargement."));
  }

  useEffect(load, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!postalCode.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.upsertGeoZone({
        postalCode: postalCode.trim(),
        municipality: municipality.trim() || undefined,
        province,
        region: province === "Bruxelles-Capitale" ? "Région de Bruxelles-Capitale" : "Région wallonne",
        isActive: mode === "include",
      });
      setPostalCode("");
      setMunicipality("");
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
      await api.deleteGeoZone(id);
      setZones((prev) => prev?.filter((z) => z.id !== id) ?? prev);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de la suppression.");
    }
  }

  return (
    <div className="main">
      <div className="page-head">
        <h1>
          Zones géographiques
          <InfoTooltip>La zone de prospection couvre par défaut 4 provinces. Ici tu ajoutes des exceptions ponctuelles — une commune à inclure ou exclure précisément, même hors de ces provinces.</InfoTooltip>
        </h1>
        {zones && <span className="count mono">{zones.length} exception{zones.length > 1 ? "s" : ""}</span>}
      </div>
      <p className="lede" style={{ marginBottom: 16 }}>
        Le périmètre par défaut couvre {DEFAULT_PROVINCES.join(", ")} par plage de code postal.
        Utilise cette liste pour <strong>exclure</strong> un code postal normalement dans le périmètre,
        ou pour en <strong>inclure</strong> un situé en dehors.
      </p>

      {isAdmin && (
        <form onSubmit={handleSubmit} className="filters" style={{ alignItems: "flex-end" }}>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "var(--ink-faint)", marginBottom: 4 }}>
              Code postal
            </label>
            <input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="1000" required />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "var(--ink-faint)", marginBottom: 4 }}>Commune</label>
            <input value={municipality} onChange={(e) => setMunicipality(e.target.value)} placeholder="optionnel" />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "var(--ink-faint)", marginBottom: 4 }}>Province</label>
            <select value={province} onChange={(e) => setProvince(e.target.value)}>
              {DEFAULT_PROVINCES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
              <option value="autre">Autre (hors périmètre par défaut)</option>
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "var(--ink-faint)", marginBottom: 4 }}>Action</label>
            <select value={mode} onChange={(e) => setMode(e.target.value as "include" | "exclude")}>
              <option value="exclude">Exclure ce code postal</option>
              <option value="include">Inclure ce code postal</option>
            </select>
          </div>
          <button className="btn btn-primary" type="submit" disabled={submitting}>
            {submitting ? "..." : "Enregistrer"}
          </button>
        </form>
      )}

      {error && <div className="form-error">{error}</div>}

      <div className="table-wrap">
        {!zones ? (
          <div className="empty-state">Chargement…</div>
        ) : zones.length === 0 ? (
          <div className="empty-state">Aucune exception — le périmètre par défaut s'applique tel quel.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Code postal</th>
                <th>Commune</th>
                <th>Province</th>
                <th>Effet</th>
                {isAdmin && <th></th>}
              </tr>
            </thead>
            <tbody>
              {zones.map((zone) => (
                <tr key={zone.id}>
                  <td className="mono">{zone.postalCode}</td>
                  <td>{zone.municipality}</td>
                  <td>{zone.province}</td>
                  <td>
                    <span className={`score-tier ${zone.isActive ? "haute" : "faible"}`}>
                      {zone.isActive ? "Inclus" : "Exclu"}
                    </span>
                  </td>
                  {isAdmin && (
                    <td>
                      <button className="btn" onClick={() => handleDelete(zone.id)}>
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
