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

const EMPTY_FORM = { name: "", offerId: "", province: "", sectorId: "", scoreTier: "", dailySendLimit: "50" };

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
          province: form.province || undefined,
          sectorId: form.sectorId || undefined,
          scoreTier: form.scoreTier || undefined,
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

  return (
    <div className="main">
      <div className="page-head">
        <h1>
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
                Filtres combinés (ET) : seuls les prospects éligibles à l'email (adresse valide, pas désinscrits, pas
                en liste noire) et correspondant à TOUS les critères choisis seront ciblés. Laisse un filtre vide pour
                ne pas le restreindre.
              </InfoTooltip>
            </label>
            <div className="field-row">
              <select value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })}>
                <option value="">Toutes provinces</option>
                <option value="Bruxelles-Capitale">Bruxelles-Capitale</option>
                <option value="Brabant wallon">Brabant wallon</option>
                <option value="Hainaut">Hainaut</option>
                <option value="Namur">Namur</option>
              </select>
              <select value={form.sectorId} onChange={(e) => setForm({ ...form, sectorId: e.target.value })}>
                <option value="">Tous secteurs</option>
                {sectors.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
              <select value={form.scoreTier} onChange={(e) => setForm({ ...form, scoreTier: e.target.value })}>
                <option value="">Tous scores</option>
                {Object.entries(TIER_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
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
                      <div className="step-row" key={step.id}>
                        <span className="step-num mono">
                          {step.stepOrder === 0 ? "J0" : `J+${step.delayDays}`}
                        </span>
                        <div className="step-info">
                          <strong>{step.templateName ?? "Template supprimé"}</strong>
                          <span>{step.templateSubject}</span>
                        </div>
                        <span className="pill">{step.sentCount} envoyé{step.sentCount > 1 ? "s" : ""}</span>
                        {isAdmin && (
                          <>
                            <button className="btn btn-primary" onClick={() => openSendPreview(camp.id, step.id)} style={{ fontSize: 12 }}>
                              Envoyer
                            </button>
                            <button className="btn" onClick={() => handleDeleteStep(camp.id, step.id)} style={{ fontSize: 12 }}>
                              ×
                            </button>
                          </>
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
    </div>
  );
}
