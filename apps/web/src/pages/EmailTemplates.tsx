import { useEffect, useState, type FormEvent } from "react";
import { api, type EmailTemplate } from "../lib/api";
import { InfoTooltip } from "../components/InfoTooltip";
import { RichEmailEditor, starterHtml } from "../components/RichEmailEditor";

function emptyForm() {
  return { name: "", subject: "", bodyHtml: starterHtml() };
}

export function EmailTemplates({ isAdmin }: { isAdmin: boolean }) {
  const [templates, setTemplates] = useState<EmailTemplate[] | null>(null);
  const [availableVars, setAvailableVars] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ subject: string; bodyHtml: string } | null>(null);
  const [unknownVars, setUnknownVars] = useState<string[]>([]);

  function load() {
    api
      .emailTemplates()
      .then((res) => {
        setTemplates(res.data);
        setAvailableVars(res.availableVariables);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Erreur de chargement."));
  }

  useEffect(load, []);

  useEffect(() => {
    if (!selectedId) {
      setPreview(null);
      return;
    }
    api
      .emailTemplate(selectedId)
      .then((res) => {
        setPreview(res.preview);
        setUnknownVars(res.unknownVariables);
      })
      .catch(() => setPreview(null));
  }, [selectedId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.subject.trim() || !form.bodyHtml.trim()) return;
    setError(null);
    try {
      if (editingId) {
        await api.updateEmailTemplate(editingId, form);
        setSelectedId(editingId);
      } else {
        const res = await api.addEmailTemplate(form);
        setSelectedId(res.template.id);
      }
      setForm(emptyForm());
      setEditingId(null);
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : editingId ? "Échec de la modification." : "Échec de la création.");
    }
  }

  function handleStartEdit(t: EmailTemplate) {
    setForm({ name: t.name, subject: t.subject, bodyHtml: t.bodyHtml });
    setEditingId(t.id);
    setShowForm(true);
  }

  function handleCancelForm() {
    setForm(emptyForm());
    setEditingId(null);
    setShowForm(false);
  }

  function handleStartCreate() {
    setForm(emptyForm());
    setEditingId(null);
    setShowForm(true);
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      await api.deleteEmailTemplate(id);
      if (selectedId === id) setSelectedId(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de la suppression.");
    }
  }

  return (
    <div className="main main-wide">
      <div className="page-head page-head--hero">
        <h1>
          <span className="brand-mark" aria-hidden="true" />
          Templates email
          <InfoTooltip>
            <p>Le contenu (sujet + corps) que tu rédiges ici, avec des variables comme {"{{prenom}}"} ou {"{{entreprise}}"} qui sont remplacées automatiquement par les vraies données de chaque prospect au moment de l'envoi.</p>
            <p>Un template est ensuite relié à une étape de campagne (écran Campagnes). Le lien de désinscription est ajouté automatiquement — inutile de l'écrire toi-même.</p>
          </InfoTooltip>
        </h1>
        {isAdmin && (
          <button className="btn btn-primary" onClick={showForm ? handleCancelForm : handleStartCreate}>
            {showForm ? "Annuler" : "Nouveau template"}
          </button>
        )}
      </div>
      <p className="lede" style={{ marginBottom: 16 }}>
        Variables disponibles :{" "}
        {availableVars.map((v) => (
          <code className="inline-var" key={v}>{`{{${v}}}`}</code>
        ))}
        . Un lien de désinscription est ajouté automatiquement à chaque envoi — inutile (et
        impossible) de le retirer du template.
      </p>

      {showForm && isAdmin && (
        <form onSubmit={handleSubmit} className="card-block" style={{ marginBottom: 20 }}>
          <h3 style={{ marginBottom: 14 }}>{editingId ? "Modifier le template" : "Nouveau template"}</h3>
          <div className="field">
            <label>Nom du template</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="field">
            <label>Objet</label>
            <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required placeholder="ex : {{entreprise}}, félicitations pour votre lancement !" />
          </div>
          <div className="field">
            <label>
              Corps
              <InfoTooltip>
                <p>L'email se compose par blocs (texte, image, bouton, séparateur) — chacun dans son propre encadré. Saisis la poignée ⠿ pour le glisser-déposer à un autre endroit, ou la croix pour le supprimer. Ajoute-en un nouveau depuis la barre en bas de l'éditeur.</p>
                <p>Dans un bloc de texte, sélectionne des mots puis choisis gras/italique/souligné, une police, un corps (taille) ou une couleur (pipette) — comme dans un traitement de texte.</p>
              </InfoTooltip>
            </label>
            <RichEmailEditor value={form.bodyHtml} onChange={(html) => setForm({ ...form, bodyHtml: html })} />
          </div>
          <button className="btn btn-primary" type="submit" style={{ marginTop: 6 }}>
            {editingId ? "Enregistrer les modifications" : "Créer le template"}
          </button>
        </form>
      )}

      {error && <div className="form-error">{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 16 }}>
        <div className="table-wrap" style={{ alignSelf: "start" }}>
          {!templates ? (
            <div className="empty-state">Chargement…</div>
          ) : templates.length === 0 ? (
            <div className="empty-state">Aucun template.</div>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {templates.map((t) => (
                <li key={t.id} style={{ borderBottom: "1px solid var(--line-soft)" }}>
                  <button
                    onClick={() => setSelectedId(t.id)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "10px 14px",
                      border: "none",
                      background: selectedId === t.id ? "var(--accent-soft)" : "transparent",
                      color: selectedId === t.id ? "var(--accent-ink)" : "var(--ink)",
                      fontSize: 13.5,
                    }}
                  >
                    {t.name}
                  </button>
                  {isAdmin && (
                    <button
                      className="btn"
                      style={{ margin: "0 10px 8px", fontSize: 11 }}
                      onClick={() => handleDelete(t.id)}
                    >
                      Supprimer
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card-block">
          {!selectedId ? (
            <p className="lede" style={{ fontSize: 13.5 }}>
              Sélectionne un template pour voir sa prévisualisation (avec des données d'exemple).
            </p>
          ) : preview ? (
            <>
              {isAdmin && (
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
                  <button
                    className="btn"
                    onClick={() => {
                      const t = templates?.find((tpl) => tpl.id === selectedId);
                      if (t) handleStartEdit(t);
                    }}
                  >
                    Modifier
                  </button>
                </div>
              )}
              {unknownVars.length > 0 && (
                <div className="form-error" style={{ marginBottom: 12 }}>
                  Variable(s) non reconnue(s) : {unknownVars.map((v) => `{{${v}}}`).join(", ")}
                </div>
              )}
              <div style={{ fontSize: 12, color: "var(--ink-faint)", marginBottom: 4 }}>Objet</div>
              <div style={{ fontWeight: 600, marginBottom: 16 }}>{preview.subject}</div>
              <div style={{ fontSize: 12, color: "var(--ink-faint)", marginBottom: 4 }}>Aperçu</div>
              <div
                style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 16, background: "var(--paper)" }}
                dangerouslySetInnerHTML={{ __html: preview.bodyHtml }}
              />
            </>
          ) : (
            <div className="empty-state">Chargement…</div>
          )}
        </div>
      </div>
    </div>
  );
}
