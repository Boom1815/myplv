import { useEffect, useState, type FormEvent } from "react";
import {
  api,
  type Campaign,
  type CampaignSendPreview,
  type CampaignStep,
  type EmailTemplate,
  type Offer,
  type Sector,
} from "../lib/api";
import { InfoTooltip } from "../components/InfoTooltip";

const TIER_LABELS: Record<string, string> = {
  tres_haute: "Très haute",
  haute: "Haute",
  moyenne: "Moyenne",
  faible: "Faible",
  ignorer: "Ignorer",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  scheduled: "Planifiée",
  running: "En cours",
  paused: "En pause",
  completed: "Terminée",
};

const PROVINCES = ["Bruxelles-Capitale", "Brabant wallon", "Hainaut", "Namur"];

const EMPTY_FORM = {
  name: "",
  offerId: "",
  provinces: [] as string[],
  sectorIds: [] as string[],
  scoreTiers: [] as string[],
  dailySendLimit: "50",
};

function toggleInList(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/** Groupe de cases à cocher compact — provinces/secteurs/scores du segment. */
function CheckboxGroup({
  options,
  selected,
  onToggle,
}: {
  options: Array<{ value: string; label: string }>;
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px" }}>
      {options.map((o) => (
        <label key={o.value} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13 }}>
          <input type="checkbox" checked={selected.includes(o.value)} onChange={() => onToggle(o.value)} />
          {o.label}
        </label>
      ))}
    </div>
  );
}

export function Campaigns({ isAdmin }: { isAdmin: boolean }) {
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ campaign: Campaign; steps: CampaignStep[] } | null>(null);
  const [audience, setAudience] = useState<{ total: number } | null>(null);
  const [stepForm, setStepForm] = useState({ emailTemplateId: "", delayDays: "0" });

  const [sendModal, setSendModal] = useState<{ stepId: string; preview: CampaignSendPreview } | null>(null);
  const [sending, setSending] = useState(false);
  const [sendResultMsg, setSendResultMsg] = useState<string | null>(null);

  const [previewModal, setPreviewModal] = useState<{
    subject: string;
    bodyHtml: string;
    unknownVariables: string[];
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [testStepId, setTestStepId] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState("info@myplv.be");
  const [testingStepId, setTestingStepId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ stepId: string; message: string; ok: boolean } | null>(null);

  function loadCampaigns() {
    api.campaigns().then((res) => setCampaigns(res.data)).catch((err) => setError(err instanceof Error ? err.message : "Erreur de chargement."));
  }

  useEffect(loadCampaigns, []);
  useEffect(() => {
    api.offers().then((res) => setOffers(res.data)).catch(() => {});
    api.sectors().then((res) => setSectors(res.data)).catch(() => {});
    api.emailTemplates().then((res) => setTemplates(res.data)).catch(() => {});
  }, []);

  function loadDetail(id: string) {
    api.campaign(id).then(setDetail).catch((err) => setError(err instanceof Error ? err.message : "Erreur de chargement."));
    api.campaignAudience(id).then(setAudience).catch(() => setAudience(null));
  }

  function toggleOpen(id: string) {
    if (openId === id) {
      setOpenId(null);
      setDetail(null);
      setAudience(null);
      return;
    }
    setOpenId(id);
    setSendResultMsg(null);
    loadDetail(id);
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setError(null);
    try {
      await api.addCampaign({
        name: form.name.trim(),
        offerId: form.offerId || undefined,
        dailySendLimit: Number(form.dailySendLimit) || 50,
        segmentFilter: {
          provinces: form.provinces.length ? form.provinces : undefined,
          sectorIds: form.sectorIds.length ? form.sectorIds : undefined,
          scoreTiers: form.scoreTiers.length ? form.scoreTiers : undefined,
        },
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
      loadCampaigns();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de la création.");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer cette campagne et ses étapes ? Cette action est irréversible.")) return;
    setError(null);
    try {
      await api.deleteCampaign(id);
      if (openId === id) setOpenId(null);
      loadCampaigns();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de la suppression.");
    }
  }

  async function handleToggleMode(campaign: Campaign) {
    const next = campaign.mode === "dry_run" ? "production" : "dry_run";
    if (next === "production" && !confirm("Passer cette campagne en mode PRODUCTION : les prochains envois seront réels, pas simulés. Continuer ?")) {
      return;
    }
    try {
      await api.updateCampaign(campaign.id, { mode: next });
      loadCampaigns();
      if (openId === campaign.id) loadDetail(campaign.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec du changement de mode.");
    }
  }

  async function handleAddStep(e: FormEvent, campaignId: string) {
    e.preventDefault();
    if (!stepForm.emailTemplateId) return;
    setError(null);
    try {
      await api.addCampaignStep(campaignId, { emailTemplateId: stepForm.emailTemplateId, delayDays: Number(stepForm.delayDays) || 0 });
      setStepForm({ emailTemplateId: "", delayDays: "0" });
      loadDetail(campaignId);
      loadCampaigns();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de l'ajout de l'étape.");
    }
  }

  async function handleDeleteStep(campaignId: string, stepId: string) {
    setError(null);
    try {
      await api.deleteCampaignStep(campaignId, stepId);
      loadDetail(campaignId);
      loadCampaigns();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de la suppression de l'étape.");
    }
  }

  async function openSendPreview(campaignId: string, stepId: string) {
    setError(null);
    setSendResultMsg(null);
    try {
      const result = await api.sendCampaignStep(campaignId, stepId, false);
      if (result.dryRun) setSendModal({ stepId, preview: result });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec du calcul de l'aperçu.");
    }
  }

  async function confirmSend(campaignId: string, stepId: string) {
    setSending(true);
    setError(null);
    try {
      const result = await api.sendCampaignStep(campaignId, stepId, true);
      if (!result.dryRun) {
        setSendResultMsg(`${result.sent} email(s) envoyé(s), ${result.failed} échec(s). ${result.remainingEligible} prospect(s) restent éligibles pour un prochain envoi.`);
        loadDetail(campaignId);
        loadCampaigns();
      }
      setSendModal(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de l'envoi.");
    } finally {
      setSending(false);
    }
  }

  async function openTemplatePreview(templateId: string | null) {
    if (!templateId) return;
    setError(null);
    setPreviewLoading(true);
    try {
      const res = await api.emailTemplate(templateId);
      setPreviewModal({ subject: res.preview.subject, bodyHtml: res.preview.bodyHtml, unknownVariables: res.unknownVariables });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de l'aperçu.");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleSendTest(campaignId: string, stepId: string) {
    if (!testEmail.trim()) return;
    setTestingStepId(stepId);
    setTestResult(null);
    try {
      const res = await api.sendCampaignTestEmail(campaignId, stepId, testEmail.trim());
      if (res.provider === "dry_run") {
        setTestResult({
          stepId,
          ok: false,
          message: "Simulé seulement — aucune clé Brevo active (EMAIL_PROVIDER=brevo + BREVO_API_KEY requis), donc rien n'a été envoyé pour de vrai.",
        });
      } else if (res.ok) {
        setTestResult({ stepId, ok: true, message: `Envoyé à ${testEmail.trim()} via ${res.provider}.` });
      } else {
        setTestResult({ stepId, ok: false, message: res.error ?? "Échec de l'envoi du test." });
      }
    } catch (err) {
      setTestResult({ stepId, ok: false, message: err instanceof Error ? err.message : "Échec de l'envoi du test." });
    } finally {
      setTestingStepId(null);
    }
  }

  return (
    <div className="main">
      <div className="page-head page-head--hero">
        <h1>
          <span className="brand-mark" aria-hidden="true" />
          Campagnes
          <InfoTooltip>
            <p>
              Une campagne envoie une séquence d'emails à un <strong>segment</strong> de prospects (filtré par
              province, secteur, score…).
            </p>
            <p>
              Chaque campagne démarre en mode <strong>Simulation</strong> : tu peux tout tester (audience, aperçu des
              emails) sans qu'aucun message ne parte réellement. Passe en <strong>Production</strong> uniquement
              quand tu es prêt·e à envoyer pour de vrai.
            </p>
          </InfoTooltip>
        </h1>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Annuler" : "Nouvelle campagne"}
          </button>
        )}
      </div>

      {showForm && isAdmin && (
        <form onSubmit={handleCreate} className="card-block" style={{ marginBottom: 20, maxWidth: 640 }}>
          <div className="field">
            <label>
              Nom de la campagne
              <InfoTooltip>Un nom repère pour toi seul·e — jamais visible par les destinataires.</InfoTooltip>
            </label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="field">
            <label>
              Offre liée
              <InfoTooltip>Optionnel — utilisée pour remplir automatiquement la variable {"{{offre}}"} dans le template.</InfoTooltip>
            </label>
            <select value={form.offerId} onChange={(e) => setForm({ ...form, offerId: e.target.value })}>
              <option value="">Aucune</option>
              {offers.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>
              Segment ciblé
              <InfoTooltip>
                Coche ce que tu veux inclure dans chaque catégorie (aucune case cochée = toutes). Les catégories se
                combinent en ET entre elles (ex. Hainaut OU Namur, ET secteur Horeca) — seuls les prospects éligibles
                à l'email (adresse valide, pas désinscrits, pas en liste noire) sont de toute façon ciblés.
              </InfoTooltip>
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <div style={{ fontSize: 11.5, color: "var(--ink-faint)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Provinces
                </div>
                <CheckboxGroup
                  options={PROVINCES.map((p) => ({ value: p, label: p }))}
                  selected={form.provinces}
                  onToggle={(v) => setForm({ ...form, provinces: toggleInList(form.provinces, v) })}
                />
              </div>
              <div>
                <div style={{ fontSize: 11.5, color: "var(--ink-faint)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Secteurs
                </div>
                <CheckboxGroup
                  options={sectors.map((s) => ({ value: s.id, label: s.label }))}
                  selected={form.sectorIds}
                  onToggle={(v) => setForm({ ...form, sectorIds: toggleInList(form.sectorIds, v) })}
                />
              </div>
              <div>
                <div style={{ fontSize: 11.5, color: "var(--ink-faint)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Scores
                </div>
                <CheckboxGroup
                  options={Object.entries(TIER_LABELS).map(([v, l]) => ({ value: v, label: l }))}
                  selected={form.scoreTiers}
                  onToggle={(v) => setForm({ ...form, scoreTiers: toggleInList(form.scoreTiers, v) })}
                />
              </div>
            </div>
          </div>

          <div className="field" style={{ maxWidth: 220 }}>
            <label>
              Limite d'envoi / clic
              <InfoTooltip>
                Nombre maximum d'emails envoyés en un clic sur « Envoyer ». Une limite globale (compte Brevo,
                réglable par un administrateur) s'applique aussi, tous secteurs confondus.
              </InfoTooltip>
            </label>
            <input
              type="number"
              min={1}
              value={form.dailySendLimit}
              onChange={(e) => setForm({ ...form, dailySendLimit: e.target.value })}
            />
          </div>

          <button className="btn btn-primary" type="submit" style={{ marginTop: 6 }}>
            Créer la campagne (mode simulation)
          </button>
        </form>
      )}

      {error && <div className="form-error">{error}</div>}

      {!campaigns ? (
        <div className="empty-state">Chargement…</div>
      ) : campaigns.length === 0 ? (
        <div className="empty-state">
          Aucune campagne pour l'instant. {isAdmin && "Crée-en une pour commencer à cibler un segment de prospects."}
        </div>
      ) : (
        <div className="campaign-grid">
          {campaigns.map((camp) => (
            <div className="campaign-card" key={camp.id}>
              <div className="campaign-card-head">
                <h3>{camp.name}</h3>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn" onClick={() => toggleOpen(camp.id)} style={{ fontSize: 12 }}>
                    {openId === camp.id ? "Fermer" : "Ouvrir"}
                  </button>
                  {isAdmin && (
                    <button className="btn" onClick={() => handleDelete(camp.id)} style={{ fontSize: 12 }}>
                      Supprimer
                    </button>
                  )}
                </div>
              </div>
              <div className="campaign-meta">
                <span className={`pill mode-${camp.mode}`}>{camp.mode === "dry_run" ? "Simulation" : "Production"}</span>
                <span className={`pill status-${camp.status}`}>{STATUS_LABELS[camp.status] ?? camp.status}</span>
                {camp.offerName && <span className="pill">{camp.offerName}</span>}
                <span className="pill">
                  {camp.stepCount ?? 0} étape{(camp.stepCount ?? 0) > 1 ? "s" : ""}
                </span>
                <span className="pill">Limite {camp.dailySendLimit}/envoi</span>
              </div>

              {isAdmin && (
                <button className="btn" onClick={() => handleToggleMode(camp)} style={{ alignSelf: "flex-start", fontSize: 12 }}>
                  {camp.mode === "dry_run" ? "Passer en Production" : "Repasser en Simulation"}
                </button>
              )}

              {openId === camp.id && (
                <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14, marginTop: 4 }}>
                  {audience && (
                    <div className="audience-box" style={{ marginBottom: 14 }}>
                      <strong>{audience.total}</strong> prospect{audience.total > 1 ? "s" : ""} éligible
                      {audience.total > 1 ? "s" : ""} dans ce segment
                      <InfoTooltip>
                        Compte à jour, recalculé à chaque ouverture — inclut uniquement les prospects avec un email
                        valide, ni en liste noire, ni désinscrits, correspondant aux filtres de la campagne.
                      </InfoTooltip>
                    </div>
                  )}

                  {sendResultMsg && <div className="form-error" style={{ background: "var(--good-soft)", color: "var(--good)" }}>{sendResultMsg}</div>}

                  <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
                    <h3 style={{ fontSize: 14 }}>
                      Séquence d'emails
                      <InfoTooltip>
                        Une ou plusieurs étapes envoyées dans l'ordre. Le délai (en jours) indique combien de temps
                        après l'étape précédente elle serait envoyée — la planification automatique n'est pas encore
                        active, chaque étape s'envoie manuellement pour l'instant via le bouton « Envoyer ».
                      </InfoTooltip>
                    </h3>
                  </div>

                  {detail?.steps.length === 0 && <p style={{ fontSize: 13, color: "var(--ink-faint)" }}>Aucune étape pour l'instant.</p>}

                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                    {detail?.steps.map((step) => (
                      <div key={step.id} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <div className="step-row">
                          <span className="step-num mono">
                            {step.stepOrder === 0 ? "J0" : `J+${step.delayDays}`}
                          </span>
                          <div className="step-info">
                            <strong>{step.templateName ?? "Template supprimé"}</strong>
                            <span>{step.templateSubject}</span>
                          </div>
                          <span className="pill">{step.sentCount} envoyé{step.sentCount > 1 ? "s" : ""}</span>
                          <button
                            className="btn"
                            onClick={() => openTemplatePreview(step.emailTemplateId)}
                            disabled={!step.emailTemplateId || previewLoading}
                            style={{ fontSize: 12 }}
                          >
                            Aperçu
                          </button>
                          {isAdmin && (
                            <>
                              <button
                                className="btn"
                                onClick={() => {
                                  setTestStepId(testStepId === step.id ? null : step.id);
                                  setTestResult(null);
                                }}
                                style={{ fontSize: 12 }}
                              >
                                Test
                              </button>
                              <button className="btn btn-primary" onClick={() => openSendPreview(camp.id, step.id)} style={{ fontSize: 12 }}>
                                Envoyer
                              </button>
                              <button className="btn" onClick={() => handleDeleteStep(camp.id, step.id)} style={{ fontSize: 12 }}>
                                ×
                              </button>
                            </>
                          )}
                        </div>

                        {testStepId === step.id && (
                          <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 58 }}>
                            <input
                              type="email"
                              value={testEmail}
                              onChange={(e) => setTestEmail(e.target.value)}
                              placeholder="ton@email.be"
                              style={{ flex: 1, maxWidth: 260, padding: "6px 9px", borderRadius: 6, border: "1px solid var(--line)", fontSize: 13 }}
                            />
                            <button
                              className="btn"
                              onClick={() => handleSendTest(camp.id, step.id)}
                              disabled={testingStepId === step.id}
                              style={{ fontSize: 12 }}
                            >
                              {testingStepId === step.id ? "Envoi…" : "Envoyer le test"}
                            </button>
                          </div>
                        )}
                        {testResult?.stepId === step.id && (
                          <div
                            style={{ marginLeft: 58, fontSize: 12.5, color: testResult.ok ? "var(--good)" : "var(--risk)" }}
                          >
                            {testResult.message}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {isAdmin && (
                    <form onSubmit={(e) => handleAddStep(e, camp.id)} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
                      <div className="field" style={{ marginBottom: 0, flex: 1, minWidth: 200 }}>
                        <label>Ajouter une étape — template</label>
                        <select
                          value={stepForm.emailTemplateId}
                          onChange={(e) => setStepForm({ ...stepForm, emailTemplateId: e.target.value })}
                        >
                          <option value="">Choisir un template…</option>
                          {templates.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="field" style={{ marginBottom: 0, width: 120 }}>
                        <label>Délai (jours)</label>
                        <input
                          type="number"
                          min={0}
                          value={stepForm.delayDays}
                          onChange={(e) => setStepForm({ ...stepForm, delayDays: e.target.value })}
                        />
                      </div>
                      <button className="btn" type="submit">
                        Ajouter
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {sendModal && (
        <div className="modal-backdrop" onClick={() => !sending && setSendModal(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h2>Aperçu de l'envoi</h2>
            <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 14 }}>
              {sendModal.preview.reason === "dry_run"
                ? "Cette campagne est en mode Simulation : voici ce qui serait envoyé si elle passait en Production. Rien n'est envoyé maintenant."
                : "Vérifie l'aperçu avant de confirmer — cet envoi sera réel."}
            </p>

            <div className="stat-grid" style={{ marginBottom: 16 }}>
              <div className="stat-tile">
                <span className="stat-label">Éligibles</span>
                <span className="stat-value">{sendModal.preview.eligibleCount}</span>
              </div>
              <div className="stat-tile">
                <span className="stat-label">Seraient envoyés</span>
                <span className="stat-value">{sendModal.preview.willSend}</span>
                <span className="stat-sub">plafonné par les limites d'envoi</span>
              </div>
              <div className="stat-tile">
                <span className="stat-label">Limite globale restante</span>
                <span className="stat-value">{sendModal.preview.globalRemainingToday}</span>
                <span className="stat-sub">sur {sendModal.preview.globalDailyLimit}/jour, tous secteurs</span>
              </div>
            </div>

            <h3 style={{ fontSize: 13, marginBottom: 8 }}>Exemples ({sendModal.preview.preview.length})</h3>
            <div className="send-preview" style={{ marginBottom: 16 }}>
              {sendModal.preview.preview.length === 0 && <div className="send-preview-item">Aucun destinataire éligible.</div>}
              {sendModal.preview.preview.map((p, i) => (
                <div className="send-preview-item" key={i}>
                  <div className="to">
                    À : {p.companyName} · {p.email}
                  </div>
                  <div className="subject">{p.subject}</div>
                </div>
              ))}
            </div>

            <div className="modal-actions">
              <button className="btn" onClick={() => setSendModal(null)} disabled={sending}>
                Fermer
              </button>
              {sendModal.preview.reason === "confirmation_required" && sendModal.preview.willSend > 0 && (
                <button
                  className="btn btn-primary"
                  onClick={() => confirmSend(openId!, sendModal.stepId)}
                  disabled={sending}
                  style={{ background: "var(--risk)", borderColor: "var(--risk)" }}
                >
                  {sending ? "Envoi en cours…" : `Confirmer l'envoi à ${sendModal.preview.willSend} prospect(s)`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {previewModal && (
        <div className="modal-backdrop" onClick={() => setPreviewModal(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h2>Aperçu de l'email</h2>
            <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 14 }}>
              Rendu avec des données d'exemple (pas un vrai prospect) — c'est à ça que ressemblera l'email une fois
              les variables remplacées.
            </p>
            {previewModal.unknownVariables.length > 0 && (
              <div className="form-error" style={{ marginBottom: 12 }}>
                Variable(s) non reconnue(s) : {previewModal.unknownVariables.map((v) => `{{${v}}}`).join(", ")}
              </div>
            )}
            <div style={{ fontSize: 12, color: "var(--ink-faint)", marginBottom: 4 }}>Objet</div>
            <div style={{ fontWeight: 600, marginBottom: 16 }}>{previewModal.subject}</div>
            <div style={{ fontSize: 12, color: "var(--ink-faint)", marginBottom: 4 }}>Corps</div>
            <div
              style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 16, background: "var(--paper)" }}
              dangerouslySetInnerHTML={{ __html: previewModal.bodyHtml }}
            />
            <div className="modal-actions">
              <button className="btn" onClick={() => setPreviewModal(null)}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
