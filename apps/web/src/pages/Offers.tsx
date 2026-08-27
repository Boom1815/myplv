import { useEffect, useState, type FormEvent } from "react";
import { api, type Offer } from "../lib/api";
import { InfoTooltip } from "../components/InfoTooltip";

const EMPTY_FORM = { name: "", description: "", pitch: "", advantage: "", ctaLabel: "", landingUrl: "" };

export function Offers({ isAdmin }: { isAdmin: boolean }) {
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);

  function load() {
    api
      .offers()
      .then((res) => setOffers(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : "Erreur de chargement."));
  }

  useEffect(load, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setError(null);
    try {
      await api.addOffer(form);
      setForm(EMPTY_FORM);
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de la création.");
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      await api.deleteOffer(id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de la suppression.");
    }
  }

  return (
    <div className="main">
      <div className="page-head">
        <h1>
          Offres
          <InfoTooltip>Une offre commerciale, reliée à une campagne (écran Campagnes) — son nom et son lien remplissent automatiquement les variables {"{{offre}}"} et {"{{lien}}"} dans les templates email.</InfoTooltip>
        </h1>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Annuler" : "Nouvelle offre"}
          </button>
        )}
      </div>
      <p className="lede" style={{ marginBottom: 16 }}>
        Une offre reste rédigée par vous — argumentaire, avantage, CTA ne sont jamais générés
        automatiquement. Elle sera reliée à une campagne en Phase 3.
      </p>

      {showForm && isAdmin && (
        <form onSubmit={handleSubmit} className="card-block" style={{ marginBottom: 20, maxWidth: 560 }}>
          <div className="field">
            <label>Nom de l'offre</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="field">
            <label>Description</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="field">
            <label>Argumentaire</label>
            <input value={form.pitch} onChange={(e) => setForm({ ...form, pitch: e.target.value })} />
          </div>
          <div className="field">
            <label>Avantage clé</label>
            <input value={form.advantage} onChange={(e) => setForm({ ...form, advantage: e.target.value })} />
          </div>
          <div className="field">
            <label>Libellé du bouton (CTA)</label>
            <input value={form.ctaLabel} onChange={(e) => setForm({ ...form, ctaLabel: e.target.value })} />
          </div>
          <div className="field">
            <label>Lien (landing page)</label>
            <input value={form.landingUrl} onChange={(e) => setForm({ ...form, landingUrl: e.target.value })} />
          </div>
          <button className="btn btn-primary" type="submit">
            Créer l'offre
          </button>
        </form>
      )}

      {error && <div className="form-error">{error}</div>}

      {!offers ? (
        <div className="empty-state">Chargement…</div>
      ) : offers.length === 0 ? (
        <div className="empty-state">Aucune offre pour l'instant.</div>
      ) : (
        <div className="sector-grid">
          {offers.map((offer) => (
            <div className="card-block" key={offer.id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <h3>{offer.name}</h3>
                {isAdmin && (
                  <button className="btn" onClick={() => handleDelete(offer.id)} style={{ fontSize: 12 }}>
                    Supprimer
                  </button>
                )}
              </div>
              {offer.description && <p style={{ fontSize: 13.5, color: "var(--ink-soft)", margin: "6px 0" }}>{offer.description}</p>}
              {offer.pitch && (
                <p style={{ fontSize: 13, color: "var(--ink-faint)", margin: "4px 0" }}>
                  <em>{offer.pitch}</em>
                </p>
              )}
              {offer.ctaLabel && (
                <span className="pill-scope" style={{ marginTop: 8, display: "inline-block" }}>
                  {offer.ctaLabel}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
