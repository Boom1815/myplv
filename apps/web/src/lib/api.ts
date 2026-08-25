export type CurrentUser = {
  id: string;
  email: string;
  role: "admin" | "reader";
};

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
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
