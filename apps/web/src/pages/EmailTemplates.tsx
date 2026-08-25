import { useEffect, useState, type FormEvent } from "react";
import { api, type EmailTemplate } from "../lib/api";

const EMPTY_FORM = {
  name: "",
  subject: "",
  bodyHtml: "<p>Bonjour {{prenom}},</p>\n<p>Votre contenu ici…</p>\n<p>{{offre}}</p>",
};

export function EmailTemplates({ isAdmin }: { isAdmin: boolean }) {
  const [templates, setTemplates] = useState<EmailTemplate[] | null>(null);
  const [availableVars, setAvailableVars] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
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
      const res = await api.addEmailTemplate(form);
      setForm(EMPTY_FORM);
      setShowForm(false);
      load();
      setSelectedId(res.template.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de la création.");
    }
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
    <div className="main">
      <div className="page-head">
        <h1>Templates email</h1>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
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
          <div className="field">
            <label>Nom du template</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="field">
            <label>Objet</label>
            <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required placeholder="ex : {{entreprise}}, félicitations pour votre lancement !" />
          </div>
          <div className="field">
            <label>Corps (HTML)</label>
            <textarea
              value={form.bodyHtml}
              onChange={(e) => setForm({ ...form, bodyHtml: e.target.value })}
              rows={8}
              required
              style={{ width: "100%", fontFamily: "IBM Plex Mono, monospace", fontSize: 12.5, padding: 10, borderRadius: 7, border: "1px solid var(--line)", background: "var(--paper)", color: "var(--ink)" }}
            />
          </div>
          <button className="btn btn-primary" type="submit">
            Créer le template
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
