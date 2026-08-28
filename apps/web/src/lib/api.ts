export type CurrentUser = {
  id: string;
  email: string;
  role: "admin" | "reader";
};

// En production sur un domaine unique (app.myplv.be), l'API est servie en
// relatif (/api/...) — c'est le cas par défaut. Pour un aperçu où frontend
// (Cloudflare Pages) et API (Cloudflare Workers) vivent sur deux domaines
// distincts (*.pages.dev / *.workers.dev), VITE_API_BASE_URL pointe vers
// l'URL complète du Worker, injectée au moment du build.
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ?? "";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}/api${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message ?? `Erreur ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  me: () => request<{ user: CurrentUser | null }>("/auth/me"),
  login: (email: string, password: string) =>
    request<{ user: CurrentUser }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  logout: () => request<{ ok: true }>("/auth/logout", { method: "POST" }),
  prospects: (params: Record<string, string>) =>
    request<ProspectsResponse>(`/prospects?${new URLSearchParams(params).toString()}`),
  scoringRules: () => request<{ data: ScoringRule[] }>("/scoring-rules"),
  updateScoringRule: (id: string, patch: { points?: number; isActive?: boolean }) =>
    request<{ rule: ScoringRule }>(`/scoring-rules/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  recomputeScores: () =>
    request<{ total: number; tierCounts: Record<string, number>; eligibleCount: number }>(
      "/scoring-rules/recompute",
      { method: "POST" },
    ),
  dashboard: () => request<DashboardStats>("/dashboard"),
  blacklist: () => request<{ data: BlacklistRule[] }>("/blacklist"),
  addBlacklistRule: (scope: string, value: string, reason?: string) =>
    request<{ rule: BlacklistRule }>("/blacklist", { method: "POST", body: JSON.stringify({ scope, value, reason }) }),
  deleteBlacklistRule: (id: string) => request<{ ok: true }>(`/blacklist/${id}`, { method: "DELETE" }),
  sectors: () => request<{ data: Sector[] }>("/sectors"),
  addSector: (label: string, description?: string) =>
    request<{ sector: Sector }>("/sectors", { method: "POST", body: JSON.stringify({ label, description }) }),
  deleteSector: (id: string) => request<{ ok: true }>(`/sectors/${id}`, { method: "DELETE" }),
  addNaceRule: (sectorId: string, nacePrefix: string, priority?: number) =>
    request<{ rule: NaceRule }>(`/sectors/${sectorId}/nace-rules`, {
      method: "POST",
      body: JSON.stringify({ nacePrefix, priority }),
    }),
  deleteNaceRule: (sectorId: string, ruleId: string) =>
    request<{ ok: true }>(`/sectors/${sectorId}/nace-rules/${ruleId}`, { method: "DELETE" }),
  geographicZones: () => request<{ data: GeoZone[] }>("/geographic-zones"),
  upsertGeoZone: (zone: { postalCode: string; municipality?: string; province: string; region: string; isActive: boolean }) =>
    request<{ zone: GeoZone }>("/geographic-zones", { method: "POST", body: JSON.stringify(zone) }),
  deleteGeoZone: (id: string) => request<{ ok: true }>(`/geographic-zones/${id}`, { method: "DELETE" }),
  tags: () => request<{ data: Tag[] }>("/tags"),
  addTag: (label: string, color?: string) =>
    request<{ tag: Tag }>("/tags", { method: "POST", body: JSON.stringify({ label, color }) }),
  deleteTag: (id: string) => request<{ ok: true }>(`/tags/${id}`, { method: "DELETE" }),
  assignTag: (prospectId: string, tagId: string) =>
    request<{ ok: true }>(`/tags/assign/${prospectId}`, { method: "POST", body: JSON.stringify({ tagId }) }),
  unassignTag: (prospectId: string, tagId: string) =>
    request<{ ok: true }>(`/tags/assign/${prospectId}/${tagId}`, { method: "DELETE" }),
  offers: () => request<{ data: Offer[] }>("/offers"),
  addOffer: (offer: Partial<Offer> & { name: string }) =>
    request<{ offer: Offer }>("/offers", { method: "POST", body: JSON.stringify(offer) }),
  updateOffer: (id: string, patch: Partial<Offer>) =>
    request<{ offer: Offer }>(`/offers/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteOffer: (id: string) => request<{ ok: true }>(`/offers/${id}`, { method: "DELETE" }),
  emailTemplates: () => request<{ data: EmailTemplate[]; availableVariables: string[] }>("/email-templates"),
  emailTemplate: (id: string) =>
    request<{ template: EmailTemplate; preview: { subject: string; bodyHtml: string }; unknownVariables: string[] }>(
      `/email-templates/${id}`,
    ),
  addEmailTemplate: (t: { name: string; subject: string; bodyHtml: string }) =>
    request<{ template: EmailTemplate }>("/email-templates", { method: "POST", body: JSON.stringify(t) }),
  updateEmailTemplate: (id: string, patch: { name?: string; subject?: string; bodyHtml?: string }) =>
    request<{ template: EmailTemplate }>(`/email-templates/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteEmailTemplate: (id: string) => request<{ ok: true }>(`/email-templates/${id}`, { method: "DELETE" }),
  signature: () => request<{ bodyHtml: string; updatedAt: string | null }>("/signature"),
  updateSignature: (bodyHtml: string) =>
    request<{ bodyHtml: string }>("/signature", { method: "PUT", body: JSON.stringify({ bodyHtml }) }),
  campaigns: () => request<{ data: Campaign[] }>("/campaigns"),
  campaign: (id: string) => request<{ campaign: Campaign; steps: CampaignStep[] }>(`/campaigns/${id}`),
  addCampaign: (payload: { name: string; offerId?: string; segmentFilter?: SegmentFilter; dailySendLimit?: number }) =>
    request<{ campaign: Campaign }>("/campaigns", { method: "POST", body: JSON.stringify(payload) }),
  updateCampaign: (
    id: string,
    patch: Partial<{ name: string; offerId: string | null; segmentFilter: SegmentFilter; dailySendLimit: number; mode: string; status: string }>,
  ) => request<{ campaign: Campaign }>(`/campaigns/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteCampaign: (id: string) => request<{ ok: true }>(`/campaigns/${id}`, { method: "DELETE" }),
  campaignAudience: (id: string) => request<{ total: number; sample: AudienceSample[] }>(`/campaigns/${id}/audience`),
  addCampaignStep: (id: string, payload: { emailTemplateId: string; delayDays?: number; stopOnReply?: boolean }) =>
    request<{ step: CampaignStep }>(`/campaigns/${id}/steps`, { method: "POST", body: JSON.stringify(payload) }),
  deleteCampaignStep: (id: string, stepId: string) =>
    request<{ ok: true }>(`/campaigns/${id}/steps/${stepId}`, { method: "DELETE" }),
  sendCampaignStep: (id: string, stepId: string, confirm = false) =>
    request<CampaignSendResult>(`/campaigns/${id}/steps/${stepId}/send`, { method: "POST", body: JSON.stringify({ confirm }) }),
  sendCampaignTestEmail: (id: string, stepId: string, to: string) =>
    request<CampaignTestSendResult>(`/campaigns/${id}/steps/${stepId}/test`, { method: "POST", body: JSON.stringify({ to }) }),
};

export type Offer = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sectorId: string | null;
  pitch: string | null;
  advantage: string | null;
  ctaLabel: string | null;
  landingUrl: string | null;
};

export type EmailTemplate = {
  id: string;
  slug: string;
  name: string;
  subject: string;
  bodyHtml: string;
  updatedAt: string;
};

export type Tag = { id: string; label: string; color: string | null };

export type NaceRule = { id: string; sectorId: string; nacePrefix: string; priority: number };
export type Sector = { id: string; slug: string; label: string; description: string | null; naceRules: NaceRule[] };
export type GeoZone = {
  id: string;
  postalCode: string;
  municipality: string;
  province: string;
  region: string;
  isActive: boolean;
};

export type DashboardStats = {
  prospects: {
    total: number;
    byTier: Record<string, number>;
    byStatus: Record<string, number>;
    eligibleForEmail: number;
  };
  companies: { total: number; withEmail: number };
  lastImport: {
    status: string;
    startedAt: string;
    finishedAt: string | null;
    recordsCreated: number;
    recordsUpdated: number;
    recordsSkipped: number;
  } | null;
};

export type BlacklistRule = {
  id: string;
  scope: string;
  value: string;
  reason: string | null;
  createdAt: string;
};

export type ScoringRule = {
  id: string;
  slug: string;
  label: string;
  points: number;
  isActive: boolean;
  condition: unknown;
};

export type Prospect = {
  id: string;
  status: string;
  score: number;
  scoreTier: string;
  isEligibleForEmail: string;
  createdAt: string;
  companyId: string;
  companyName: string;
  enterpriseNumber: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  municipality: string | null;
  province: string | null;
  postalCode: string | null;
  primaryNaceCode: string | null;
  collectedAt: string;
  tags: Tag[];
};

export type ProspectsResponse = {
  data: Prospect[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

export type SegmentFilter = { provinces?: string[]; sectorIds?: string[]; scoreTiers?: string[] };

export type Campaign = {
  id: string;
  name: string;
  mode: "dry_run" | "production";
  status: "draft" | "scheduled" | "running" | "paused" | "completed";
  segmentFilter: SegmentFilter;
  dailySendLimit: number;
  offerId: string | null;
  offerName: string | null;
  landingUrl?: string | null;
  stepCount?: number;
  createdAt: string;
  updatedAt: string;
};

export type CampaignStep = {
  id: string;
  stepOrder: number;
  delayDays: number;
  stopOnReply: string;
  emailTemplateId: string | null;
  templateName: string | null;
  templateSubject: string | null;
  sentCount: number;
};

export type AudienceSample = { companyName: string; email: string | null; province: string | null; scoreTier: string };

export type CampaignSendPreview = {
  dryRun: true;
  reason: "dry_run" | "confirmation_required";
  eligibleCount: number;
  willSend: number;
  dailySendLimit: number;
  globalDailyLimit: number;
  globalRemainingToday: number;
  preview: Array<{ companyName: string; email: string | null; subject: string; bodyHtml: string }>;
};

export type CampaignSendResult =
  | CampaignSendPreview
  | { dryRun: false; attempted: number; sent: number; failed: number; remainingEligible: number };

export type CampaignTestSendResult = { ok: boolean; provider: string; error?: string };
