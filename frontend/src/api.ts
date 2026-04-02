import { Project, TimeEntry, LoginResponse, User, AdminUser, ProviderInfo, Integration, TestResult, SyncResult, SyncLog, Plugin, PluginStats, ActionResult, PluginExecutionLog } from "./types";

const BASE = "/api";

function getToken(): string | null {
  return localStorage.getItem("fauke_token");
}

export function setToken(token: string): void {
  localStorage.setItem("fauke_token", token);
}

export function clearToken(): void {
  localStorage.removeItem("fauke_token");
  localStorage.removeItem("fauke_user");
}

export function getSavedUser(): User | null {
  const raw = localStorage.getItem("fauke_user");
  return raw ? JSON.parse(raw) : null;
}

export function saveUser(user: User): void {
  localStorage.setItem("fauke_user", JSON.stringify(user));
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}${path}`, {
    headers,
    ...options,
  });

  if (res.status === 401) {
    clearToken();
    window.location.reload();
    throw new Error("Session expired");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// Auth
export const login = (username: string, password: string) =>
  request<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });

export const getMe = () => request<User>("/auth/me");

// Projects
export const getProjects = () => request<Project[]>("/projects");

export const createProject = (data: { name: string; color?: string }) =>
  request<Project>("/projects", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updateProject = (id: string, data: Partial<Pick<Project, "name" | "color">>) =>
  request<Project>(`/projects/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

export const deleteProject = (id: string) =>
  request<void>(`/projects/${id}`, { method: "DELETE" });

// Entries
export const getEntries = (from?: string, to?: string) => {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const qs = params.toString();
  return request<TimeEntry[]>(`/entries${qs ? `?${qs}` : ""}`);
};

export const createEntry = (data: {
  date: string;
  hours: number;
  note?: string;
  projectId: string;
}) =>
  request<TimeEntry>("/entries", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updateEntry = (
  id: string,
  data: Partial<{ date: string; hours: number; note: string; projectId: string }>
) =>
  request<TimeEntry>(`/entries/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

export const deleteEntry = (id: string) =>
  request<void>(`/entries/${id}`, { method: "DELETE" });

// Export helpers — fetch with auth and trigger download
async function downloadFile(path: string, filename: string) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Export failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const exportCsv = (from?: string, to?: string) => {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const qs = params.toString();
  const dateStr = new Date().toISOString().split("T")[0];
  return downloadFile(`/export/csv${qs ? `?${qs}` : ""}`, `fauke-export-${dateStr}.csv`);
};

export const exportPdf = (from?: string, to?: string) => {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const qs = params.toString();
  const dateStr = new Date().toISOString().split("T")[0];
  return downloadFile(`/export/pdf${qs ? `?${qs}` : ""}`, `fauke-report-${dateStr}.pdf`);
};

// Admin
export const getAdminUsers = () => request<AdminUser[]>("/admin/users");

export const createAdminUser = (data: {
  username: string;
  password: string;
  displayName: string;
  role: string;
  projectIds: string[];
}) =>
  request<AdminUser>("/admin/users", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updateAdminUser = (
  id: string,
  data: {
    displayName?: string;
    role?: string;
    password?: string;
    projectIds?: string[];
  }
) =>
  request<AdminUser>(`/admin/users/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

export const deleteAdminUser = (id: string) =>
  request<void>(`/admin/users/${id}`, { method: "DELETE" });

// ── Integrations ─────────────────────────────────────────

export const getProviders = () =>
  request<ProviderInfo[]>("/admin/integrations/providers");

export const getIntegrations = () =>
  request<Integration[]>("/admin/integrations");

export const getIntegration = (id: string) =>
  request<Integration>(`/admin/integrations/${id}`);

export const createIntegration = (data: { provider: string; name: string; config: Record<string, unknown> }) =>
  request<Integration>("/admin/integrations", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updateIntegration = (id: string, data: { name?: string; config?: Record<string, unknown>; enabled?: boolean }) =>
  request<Integration>(`/admin/integrations/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

export const deleteIntegration = (id: string) =>
  request<void>(`/admin/integrations/${id}`, { method: "DELETE" });

export const testIntegration = (id: string) =>
  request<TestResult>(`/admin/integrations/${id}/test`, { method: "POST" });

export const assignUserToIntegration = (integrationId: string, userId: string, externalId?: string) =>
  request<{ id: string; externalId: string | null; user: { id: string; displayName: string; username: string } }>(
    `/admin/integrations/${integrationId}/users`,
    { method: "POST", body: JSON.stringify({ userId, externalId }) }
  );

export const removeUserFromIntegration = (integrationId: string, userId: string) =>
  request<void>(`/admin/integrations/${integrationId}/users/${userId}`, { method: "DELETE" });

export const syncIntegration = (integrationId: string, userId: string, from: string, to: string) =>
  request<SyncResult>(`/admin/integrations/${integrationId}/sync`, {
    method: "POST",
    body: JSON.stringify({ userId, from, to }),
  });

export const getIntegrationLogs = (integrationId: string) =>
  request<SyncLog[]>(`/admin/integrations/${integrationId}/logs`);
// ── OAuth ──────────────────────────────────────────────────

export const getOAuthAuthorizationUrl = (integrationId: string) =>
  request<{ authorizationUrl: string }>("/integrations/oauth/authorize", {
    method: "POST",
    body: JSON.stringify({ integrationId }),
  });

export const refreshOAuthToken = (integrationId: string) =>
  request<{ success: boolean; message: string }>("/integrations/oauth/refresh", {
    method: "POST",
    body: JSON.stringify({ integrationId }),
  });


// ── Plugins (v2.0) ────────────────────────────────────────

export const getPlugins = () =>
  request<{ plugins: Plugin["metadata"][]; stats: PluginStats }>("/plugins");

export const getPlugin = (id: string) =>
  request<Plugin>(`/plugins/${id}`);

export const testPlugin = (id: string, config: Record<string, any>) =>
  request<ActionResult>(`/plugins/${id}/test`, {
    method: "POST",
    body: JSON.stringify({ config }),
  });

export const executePluginAction = (id: string, action: string, config: Record<string, any>, params?: any) =>
  request<ActionResult>(`/plugins/${id}/execute`, {
    method: "POST",
    body: JSON.stringify({ action, config, params }),
  });

export const getPluginsByCategory = (category: string) =>
  request<{ plugins: Plugin["metadata"][] }>(`/plugins/category/${category}`);

export const getRecentPluginLogs = (limit = 10, pluginId?: string) => {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  if (pluginId) params.set("pluginId", pluginId);
  return request<{ logs: PluginExecutionLog[] }>(`/plugins/logs/recent?${params.toString()}`);
};
