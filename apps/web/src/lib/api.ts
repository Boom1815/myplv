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
};

export type ProspectsResponse = {
  data: Prospect[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};
