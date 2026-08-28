import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { InfoTooltip } from "../components/InfoTooltip";
import { RichEmailEditor, signatureLayouts, blocksToHtml, type Block } from "../components/RichEmailEditor";

/**
 * Signature email globale — brief : une seule, configurée ici, ajoutée
 * automatiquement à la fin de CHAQUE campagne envoyée (voir
 * apps/api/src/routes/campaigns.ts), entre le corps du template et le pied
 * de page de désinscription. Pas de va-et-vient à faire dans chaque
 * template : on la règle une fois, elle s'applique partout.
 */
export function Signature({ isAdmin }: { isAdmin: boolean }) {
  const [bodyHtml, setBodyHtml] = useState<string | null>(null); // null = chargement initial
  const [draft, setDraft] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api
      .signature()
      .then((res) => {
        setBodyHtml(res.bodyHtml);
        setDraft(res.bodyHtml);
        setShowPicker(!res.bodyHtml.trim());
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Erreur de chargement."));
  }, []);

  function applyLayout(makeBlocks: () => Block[]) {
    setDraft(blocksToHtml(makeBlocks()));
    setShowPicker(false);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await api.updateSignature(draft);
      setBodyHtml(res.bodyHtml);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  }

  const hasUnsavedChanges = bodyHtml !== null && draft !== bodyHtml;

  return (
    <div className="main main-wide">
      <div className="page-head page-head--hero">
        <h1>
          <span className="brand-mark" aria-hidden="true" />
          Signature email
          <InfoTooltip>
            <p>Une seule signature, globale — elle s'ajoute automatiquement à la fin de chaque email de campagne envoyé, juste avant le lien de désinscription. Inutile de la répéter dans chaque template.</p>
            <p>Choisis une mise en page pour démarrer, puis personnalise-la comme un template classique (glisser-déposer, texte, image, bouton, réseaux sociaux…).</p>
          </InfoTooltip>
        </h1>
        {isAdmin && bodyHtml !== null && !showPicker && (
          <button className="btn" onClick={() => setShowPicker(true)}>
            📐 Changer de mise en page
          </button>
        )}
      </div>

      {!isAdmin && (
        <p className="lede" style={{ marginBottom: 16 }}>
          Lecture seule — la modification de la signature est réservée aux administrateurs.
        </p>
      )}

      {error && <div className="form-error">{error}</div>}

      {bodyHtml === null ? (
        <div className="empty-state">Chargement…</div>
      ) : showPicker && isAdmin ? (
        <>
          <p className="lede" style={{ marginBottom: 16 }}>
            5 mises en page pour démarrer — tout reste modifiable ensuite (textes, images, liens, ordre des blocs…).
          </p>
          <div className="block-palette" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
            {signatureLayouts().map((l) => (
              <button
                key={l.id}
                type="button"
                className="block-palette-card"
                style={{ alignItems: "flex-start", cursor: "pointer", flexDirection: "column", gap: 6, padding: 14 }}
                onClick={() => applyLayout(l.makeBlocks)}
              >
                <span className="block-palette-icon" style={{ fontSize: 22 }}>
                  {l.icon}
                </span>
                <strong style={{ fontSize: 13.5 }}>{l.name}</strong>
                <span style={{ fontSize: 12.5, color: "var(--ink-faint)", fontWeight: 400 }}>{l.description}</span>
              </button>
            ))}
          </div>
          {bodyHtml.trim() && (
            <button className="btn" style={{ marginTop: 14 }} onClick={() => setShowPicker(false)}>
              Annuler — garder la signature actuelle
            </button>
          )}
        </>
      ) : isAdmin ? (
        <>
          <RichEmailEditor value={draft} onChange={setDraft} />
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14 }}>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving || !hasUnsavedChanges}>
              {saving ? "Enregistrement…" : "Enregistrer la signature"}
            </button>
            {saved && !hasUnsavedChanges && <span style={{ fontSize: 13, color: "var(--good)" }}>✓ Enregistré</span>}
            {hasUnsavedChanges && <span style={{ fontSize: 13, color: "var(--ink-faint)" }}>Modifications non enregistrées</span>}
          </div>
        </>
      ) : bodyHtml.trim() ? (
        <div className="card-block">
          <div className="rich-editor-preview-frame" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
        </div>
      ) : (
        <div className="empty-state">Aucune signature configurée.</div>
      )}
    </div>
  );
}
