import { useState, useEffect, useCallback } from "react";
import {
  ProviderInfo,
  Integration,
  IntegrationUser,
  AdminUser,
  SyncLog,
} from "../types";
import * as api from "../api";
import {
  X,
  Plus,
  Trash2,
  Loader2,
  Save,
  Plug,
  Unplug,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  UserPlus,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
  ArrowRightLeft,
  History,
} from "lucide-react";
import { useOAuth } from "../hooks/useOAuth";

interface IntegrationsPanelProps {
  showToast: (message: string, type: "success" | "error") => void;
}

// ─── Provider logos / icons by key ───
const PROVIDER_COLORS: Record<string, string> = {
  fortnox: "#32A071",
  visma: "#E4002B",
  pe_accounting: "#1E40AF",
};

export default function IntegrationsPanel({ showToast }: IntegrationsPanelProps) {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const { authorizing, oauthError, oauthSuccess, authorize, clearMessages } = useOAuth(() => {
    loadData();
  });
  const [loading, setLoading] = useState(true);

  // Create form
  const [createOpen, setCreateOpen] = useState(false);
  const [createProvider, setCreateProvider] = useState<string>("");
  const [createName, setCreateName] = useState("");
  const [createConfig, setCreateConfig] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Expanded integration detail
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editConfig, setEditConfig] = useState<Record<string, string>>({});
  const [editName, setEditName] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // Test connection
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);

  // User assignment
  const [assignOpen, setAssignOpen] = useState<string | null>(null);
  const [assignUserId, setAssignUserId] = useState("");
  const [assignExternalId, setAssignExternalId] = useState("");

  // Sync
  const [syncOpen, setSyncOpen] = useState<{ integrationId: string; userId: string } | null>(null);
  const [syncFrom, setSyncFrom] = useState("");
  const [syncTo, setSyncTo] = useState("");
  const [syncing, setSyncing] = useState(false);

  // Logs
  const [logsOpen, setLogsOpen] = useState<string | null>(null);
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Visible passwords
  const [visibleFields, setVisibleFields] = useState<Set<string>>(new Set());

  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [p, i, u] = await Promise.all([
        api.getProviders(),
        api.getIntegrations(),
        api.getAdminUsers(),
      ]);
      setProviders(p);
      setIntegrations(i);
      setUsers(u);
    } catch {
      showToast("Failed to load integration data", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (oauthError || oauthSuccess) {
      const timer = setTimeout(() => clearMessages(), 5000);
      return () => clearTimeout(timer);
    }
  }, [oauthError, oauthSuccess, clearMessages]);

  // ─── Create integration ───
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createProvider || !createName) return;
    setSaving(true);
    try {
      await api.createIntegration({
        provider: createProvider,
        name: createName,
        config: createConfig,
      });
      showToast("Integration created", "success");
      setCreateOpen(false);
      setCreateProvider("");
      setCreateName("");
      setCreateConfig({});
      loadData();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Failed to create", "error");
    } finally {
      setSaving(false);
    }
  };

  // ─── Update integration ───
  const handleUpdate = async (id: string) => {
    setEditSaving(true);
    try {
      await api.updateIntegration(id, { name: editName, config: editConfig });
      showToast("Integration updated", "success");
      loadData();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Failed to update", "error");
    } finally {
      setEditSaving(false);
    }
  };

  // ─── Toggle enabled ───
  const toggleEnabled = async (integration: Integration) => {
    try {
      await api.updateIntegration(integration.id, { enabled: !integration.enabled });
      showToast(
        `Integration ${integration.enabled ? "disabled" : "enabled"}`,
        "success"
      );
      loadData();
    } catch {
      showToast("Failed to toggle integration", "error");
    }
  };

  // ─── Delete ───
  const handleDelete = async (id: string) => {
    try {
      await api.deleteIntegration(id);
      showToast("Integration deleted", "success");
      setDeleteConfirm(null);
      if (expandedId === id) setExpandedId(null);
      loadData();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Failed to delete", "error");
    }
  };

  // ─── Test connection ───
  const handleTest = async (id: string) => {
    setTesting(id);
    setTestResult(null);
    try {
      const result = await api.testIntegration(id);
      setTestResult({ id, ...result });
    } catch {
      setTestResult({ id, success: false, message: "Request failed" });
    } finally {
      setTesting(null);
    }
  };

  // ─── Assign user ───
  const handleAssignUser = async (integrationId: string) => {
    if (!assignUserId) return;
    try {
      await api.assignUserToIntegration(integrationId, assignUserId, assignExternalId || undefined);
      showToast("User assigned", "success");
      setAssignOpen(null);
      setAssignUserId("");
      setAssignExternalId("");
      loadData();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Failed to assign user", "error");
    }
  };

  // ─── Remove user ───
  const handleRemoveUser = async (integrationId: string, userId: string) => {
    try {
      await api.removeUserFromIntegration(integrationId, userId);
      showToast("User removed", "success");
      loadData();
    } catch {
      showToast("Failed to remove user", "error");
    }
  };

  // ─── Sync ───
  const handleSync = async () => {
    if (!syncOpen || !syncFrom || !syncTo) return;
    setSyncing(true);
    try {
      const result = await api.syncIntegration(
        syncOpen.integrationId,
        syncOpen.userId,
        syncFrom,
        syncTo
      );
      showToast(
        result.message || `Synced ${result.entriesSynced} entries`,
        result.success ? "success" : "error"
      );
      setSyncOpen(null);
      loadData();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Sync failed", "error");
    } finally {
      setSyncing(false);
    }
  };

  // ─── Logs ───
  const openLogs = async (integrationId: string) => {
    setLogsOpen(integrationId);
    setLogsLoading(true);
    try {
      const data = await api.getIntegrationLogs(integrationId);
      setLogs(data);
    } catch {
      showToast("Failed to load logs", "error");
    } finally {
      setLogsLoading(false);
    }
  };

  // ─── Expand / collapse ───
  const toggleExpand = (integration: Integration) => {
    if (expandedId === integration.id) {
      setExpandedId(null);
    } else {
      setExpandedId(integration.id);
      // Load full config for editing
      const cfg = integration.config as Record<string, unknown>;
      const stringCfg: Record<string, string> = {};
      for (const [k, v] of Object.entries(cfg)) {
        stringCfg[k] = typeof v === "string" ? v : String(v ?? "");
      }
      setEditConfig(stringCfg);
      setEditName(integration.name);
    }
  };

  const toggleFieldVisibility = (key: string) => {
    setVisibleFields((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectedProvider = providers.find((p) => p.key === createProvider);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 size={24} className="animate-spin text-brand-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header + Add button */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          Integrations ({integrations.length})
        </h3>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Add Integration
        </button>
      </div>

      {oauthError && (
        <div className="px-4 py-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
          {oauthError}
        </div>
      )}

      {oauthSuccess && (
        <div className="px-4 py-3 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 text-sm">
          {oauthSuccess}
        </div>
      )}

      {/* Integration list */}
      {integrations.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Plug size={32} className="mx-auto mb-3 opacity-50" />
          <p className="text-sm">No integrations configured yet</p>
          <p className="text-xs mt-1">Add Fortnox, Visma, or PE Accounting to start syncing time reports</p>
        </div>
      ) : (
        <div className="space-y-3">
          {integrations.map((integration) => {
            const provider = providers.find((p) => p.key === integration.provider);
            const isExpanded = expandedId === integration.id;
            const color = PROVIDER_COLORS[integration.provider] || "#6366f1";

            return (
              <div
                key={integration.id}
                className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden"
              >
                {/* Integration header row */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
                  onClick={() => toggleExpand(integration)}
                >
                  {isExpanded ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}

                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                    style={{ backgroundColor: color }}
                  >
                    {(provider?.label || integration.provider).slice(0, 2).toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{integration.name}</span>
                      <span className="text-xs text-gray-400">{provider?.label}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                      <span>{integration.users.length} user{integration.users.length !== 1 ? "s" : ""}</span>
                      {integration._count && <span>{integration._count.syncLogs} sync{integration._count.syncLogs !== 1 ? "s" : ""}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {/* Enabled toggle */}
                    <button
                      onClick={() => toggleEnabled(integration)}
                      className={`p-1.5 rounded-lg transition-colors ${integration.enabled
                          ? "text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20"
                          : "text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                        }`}
                      title={integration.enabled ? "Enabled — click to disable" : "Disabled — click to enable"}
                    >
                      {integration.enabled ? <Plug size={16} /> : <Unplug size={16} />}
                    </button>

                    {/* Test */}
                    <button
                      onClick={() => handleTest(integration.id)}
                      disabled={testing === integration.id}
                      className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-500 transition-colors disabled:opacity-50"
                      title="Test connection"
                    >
                      {testing === integration.id ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <RefreshCw size={16} />
                      )}
                    </button>

                    {/* Logs */}
                    <button
                      onClick={() => openLogs(integration.id)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 transition-colors"
                      title="Sync logs"
                    >
                      <History size={16} />
                    </button>

                    {/* Delete */}
                    {deleteConfirm === integration.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(integration.id)}
                          className="px-2 py-1 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded-lg"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(integration.id)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-red-500 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Test result inline */}
                {testResult && testResult.id === integration.id && (
                  <div
                    className={`mx-4 mb-3 px-3 py-2 rounded-lg text-xs flex items-center gap-2 ${testResult.success
                        ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800"
                        : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800"
                      }`}
                  >
                    {testResult.success ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                    {testResult.message}
                  </div>
                )}

                {/* Expanded detail panel */}
                {isExpanded && (
                  <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-4 space-y-5 bg-gray-50/50 dark:bg-gray-800/20">
                    {/* Config editing */}
                    <div>
                      <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                        Configuration
                      </h4>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                            Name
                          </label>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                          />
                        </div>
                        {provider?.configFields.map((field) => (
                          <div key={field.key}>
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                              {field.label}
                              {field.required && <span className="text-red-400 ml-0.5">*</span>}
                            </label>
                            {field.type === "select" ? (
                              <select
                                value={editConfig[field.key] || ""}
                                onChange={(e) =>
                                  setEditConfig({ ...editConfig, [field.key]: e.target.value })
                                }
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                              >
                                <option value="">Select...</option>
                                {field.options?.map((o) => (
                                  <option key={o} value={o}>
                                    {o}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <div className="relative">
                                <input
                                  type={
                                    field.type === "password" && !visibleFields.has(`${integration.id}-${field.key}`)
                                      ? "password"
                                      : "text"
                                  }
                                  value={editConfig[field.key] || ""}
                                  onChange={(e) =>
                                    setEditConfig({ ...editConfig, [field.key]: e.target.value })
                                  }
                                  className="w-full px-3 py-2 pr-10 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                                  placeholder={field.label}
                                />
                                {field.type === "password" && (
                                  <button
                                    type="button"
                                    onClick={() => toggleFieldVisibility(`${integration.id}-${field.key}`)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                                  >
                                    {visibleFields.has(`${integration.id}-${field.key}`) ? (
                                      <EyeOff size={14} />
                                    ) : (
                                      <Eye size={14} />
                                    )}
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                        <button
                          onClick={() => handleUpdate(integration.id)}
                          disabled={editSaving}
                          className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                          {editSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                          Save Changes
                        </button>
                        {(integration.provider === "fortnox" || integration.provider === "visma") && (
                          <button
                            onClick={() => authorize(integration.id)}
                            disabled={authorizing === integration.id}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                          >
                            {authorizing === integration.id ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : null}
                            🔐 Authorize with {provider?.label || integration.provider}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Assigned users */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Assigned Users ({integration.users.length})
                        </h4>
                        <button
                          onClick={() => {
                            setAssignOpen(assignOpen === integration.id ? null : integration.id);
                            setAssignUserId("");
                            setAssignExternalId("");
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-lg transition-colors"
                        >
                          <UserPlus size={14} />
                          Assign User
                        </button>
                      </div>

                      {/* Assign form */}
                      {assignOpen === integration.id && (
                        <div className="mb-3 p-3 rounded-lg border border-brand-200 dark:border-brand-800 bg-brand-50/50 dark:bg-brand-900/10 space-y-2">
                          <select
                            value={assignUserId}
                            onChange={(e) => setAssignUserId(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                          >
                            <option value="">Select user...</option>
                            {users
                              .filter((u) => !integration.users.some((iu) => iu.user.id === u.id))
                              .map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.displayName} ({u.username})
                                </option>
                              ))}
                          </select>
                          <input
                            type="text"
                            value={assignExternalId}
                            onChange={(e) => setAssignExternalId(e.target.value)}
                            placeholder="External Employee ID (in the target system)"
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleAssignUser(integration.id)}
                              disabled={!assignUserId}
                              className="px-3 py-1.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors"
                            >
                              Assign
                            </button>
                            <button
                              onClick={() => setAssignOpen(null)}
                              className="px-3 py-1.5 text-xs rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}

                      {integration.users.length === 0 ? (
                        <p className="text-xs text-gray-400">No users assigned</p>
                      ) : (
                        <div className="space-y-1.5">
                          {integration.users.map((iu: IntegrationUser) => (
                            <div
                              key={iu.id}
                              className="flex items-center justify-between px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                            >
                              <div>
                                <span className="text-sm font-medium">{iu.user.displayName}</span>
                                <span className="text-xs text-gray-400 ml-2">@{iu.user.username}</span>
                                {iu.externalId && (
                                  <span className="text-xs text-gray-400 ml-2">
                                    → External: <span className="font-mono">{iu.externalId}</span>
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => {
                                    setSyncOpen({
                                      integrationId: integration.id,
                                      userId: iu.user.id,
                                    });
                                    // Default to current month
                                    const now = new Date();
                                    const y = now.getFullYear();
                                    const m = String(now.getMonth() + 1).padStart(2, "0");
                                    setSyncFrom(`${y}-${m}-01`);
                                    setSyncTo(`${y}-${m}-${new Date(y, now.getMonth() + 1, 0).getDate()}`);
                                  }}
                                  className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-500 transition-colors"
                                  title="Sync time entries"
                                >
                                  <ArrowRightLeft size={14} />
                                </button>
                                <button
                                  onClick={() => handleRemoveUser(integration.id, iu.user.id)}
                                  className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-colors"
                                  title="Remove user"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Create Integration Modal ─── */}
      {createOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <form
            onSubmit={handleCreate}
            className="bg-white dark:bg-gray-900 w-full max-w-lg mx-4 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
              <h3 className="text-base font-semibold">New Integration</h3>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Provider selection */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                  Provider
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {providers.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => {
                        setCreateProvider(p.key);
                        // Reset config to empty for this provider
                        const cfg: Record<string, string> = {};
                        p.configFields.forEach((f) => {
                          cfg[f.key] = f.type === "select" && f.options?.length ? f.options[0] : "";
                        });
                        setCreateConfig(cfg);
                      }}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl border text-sm font-medium transition-all ${createProvider === p.key
                          ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-600"
                          : "border-gray-200 dark:border-gray-700 hover:border-gray-300 text-gray-600 dark:text-gray-400"
                        }`}
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                        style={{ backgroundColor: PROVIDER_COLORS[p.key] || "#6366f1" }}
                      >
                        {p.label.slice(0, 2).toUpperCase()}
                      </div>
                      {p.label}
                    </button>
                  ))}
                </div>
                {selectedProvider && (
                  <p className="text-xs text-gray-400 mt-2">{selectedProvider.description}</p>
                )}
              </div>

              {/* Name */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Integration Name
                </label>
                <input
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  placeholder={selectedProvider ? `e.g. ${selectedProvider.label} — Our Company` : "Select a provider first"}
                />
              </div>

              {/* Config fields */}
              {selectedProvider?.configFields.map((field) => (
                <div key={field.key}>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    {field.label}
                    {field.required && <span className="text-red-400 ml-0.5">*</span>}
                  </label>
                  {field.type === "select" ? (
                    <select
                      value={createConfig[field.key] || ""}
                      onChange={(e) =>
                        setCreateConfig({ ...createConfig, [field.key]: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                    >
                      {field.options?.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.type === "password" ? "password" : "text"}
                      value={createConfig[field.key] || ""}
                      onChange={(e) =>
                        setCreateConfig({ ...createConfig, [field.key]: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                      placeholder={field.label}
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-200 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !createProvider || !createName}
                className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Create
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─── Sync Modal ─── */}
      {syncOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 w-full max-w-sm mx-4 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
              <h3 className="text-base font-semibold flex items-center gap-2">
                <ArrowRightLeft size={16} />
                Sync Time Entries
              </h3>
              <button
                onClick={() => setSyncOpen(null)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  From
                </label>
                <input
                  type="date"
                  value={syncFrom}
                  onChange={(e) => setSyncFrom(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  To
                </label>
                <input
                  type="date"
                  value={syncTo}
                  onChange={(e) => setSyncTo(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-200 dark:border-gray-800">
              <button
                onClick={() => setSyncOpen(null)}
                className="px-4 py-2 text-sm rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSync}
                disabled={syncing || !syncFrom || !syncTo}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {syncing ? <Loader2 size={14} className="animate-spin" /> : <ArrowRightLeft size={14} />}
                Sync
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Logs Modal ─── */}
      {logsOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 w-full max-w-2xl mx-4 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
              <h3 className="text-base font-semibold flex items-center gap-2">
                <History size={16} />
                Sync Logs
              </h3>
              <button
                onClick={() => setLogsOpen(null)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {logsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 size={20} className="animate-spin text-brand-500" />
                </div>
              ) : logs.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-8">No sync logs yet</p>
              ) : (
                <div className="space-y-2">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className={`px-3 py-2 rounded-lg border text-xs ${log.status === "success"
                          ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10"
                          : log.status === "partial"
                            ? "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10"
                            : "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10"
                        }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {log.status === "success" ? (
                          <CheckCircle2 size={12} className="text-green-500" />
                        ) : log.status === "partial" ? (
                          <AlertTriangle size={12} className="text-amber-500" />
                        ) : (
                          <XCircle size={12} className="text-red-500" />
                        )}
                        <span className="font-medium capitalize">{log.status}</span>
                        <span className="text-gray-400 ml-auto">
                          {new Date(log.createdAt).toLocaleString()}
                        </span>
                      </div>
                      {log.message && <p className="text-gray-600 dark:text-gray-400">{log.message}</p>}
                      {log.entriesSynced > 0 && (
                        <p className="text-gray-500">{log.entriesSynced} entries synced</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
