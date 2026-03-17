// @ts-nocheck
import { useState, useEffect } from "react";
import { Plugin, PluginMetadata, PluginStats, PluginConfigField, ActionResult, PluginExecutionLog } from "../types";
import * as api from "../api";
import { Loader2, Search, Plug, CheckCircle2, XCircle, Play, TestTube, X } from "lucide-react";

interface PluginBrowserProps {
    showToast: (message: string, type: "success" | "error") => void;
}

const categoryColors: Record<string, string> = {
    integration: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    export: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    import: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
    notification: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
    utility: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
    other: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
};

export default function PluginBrowser({ showToast }: PluginBrowserProps) {
    const [plugins, setPlugins] = useState<PluginMetadata[]>([]);
    const [recentLogs, setRecentLogs] = useState<PluginExecutionLog[]>([]);
    const [stats, setStats] = useState<PluginStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [logsLoading, setLogsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<string>("all");
    const [selectedPlugin, setSelectedPlugin] = useState<Plugin | null>(null);
    const [pluginLoading, setPluginLoading] = useState(false);

    useEffect(() => {
        loadPlugins();
        loadRecentLogs();
    }, []);

    const loadPlugins = async () => {
        setLoading(true);
        try {
            const data = await api.getPlugins();
            setPlugins(data.plugins);
            setStats(data.stats);
        } catch (error: any) {
            showToast(error.message || "Failed to load plugins", "error");
        } finally {
            setLoading(false);
        }
    };

    const openPluginDetails = async (pluginId: string) => {
        setPluginLoading(true);
        try {
            const plugin = await api.getPlugin(pluginId);
            setSelectedPlugin(plugin);
        } catch (error: any) {
            showToast(error.message || "Failed to load plugin details", "error");
        } finally {
            setPluginLoading(false);
        }
    };

    const loadRecentLogs = async () => {
        setLogsLoading(true);
        try {
            const data = await api.getRecentPluginLogs(10);
            setRecentLogs(data.logs);
        } catch {
            setRecentLogs([]);
        } finally {
            setLogsLoading(false);
        }
    };

    const filteredPlugins = plugins.filter((p) => {
        const matchesSearch =
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.keywords?.some((k) => k.toLowerCase().includes(searchQuery.toLowerCase()));

        const matchesCategory = selectedCategory === "all" || p.category === selectedCategory;

        return matchesSearch && matchesCategory;
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header & Stats */}
            <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Plug className="w-7 h-7" />
                    Plugins
                </h2>
                {stats && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {stats.total} plugins available • {stats.enabled} enabled
                    </p>
                )}
            </div>

            {/* Search & Filter */}
            <div className="flex gap-4">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search plugins..."
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                </div>
                <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                    <option value="all">All Categories</option>
                    <option value="integration">Integration</option>
                    <option value="export">Export</option>
                    <option value="import">Import</option>
                    <option value="notification">Notification</option>
                    <option value="utility">Utility</option>
                    <option value="other">Other</option>
                </select>
            </div>

            {/* Plugin Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredPlugins.map((plugin) => (
                    <button
                        key={plugin.id}
                        onClick={() => openPluginDetails(plugin.id)}
                        className="text-left p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-indigo-500 dark:hover:border-indigo-400 transition-colors bg-white dark:bg-gray-800"
                    >
                        <div className="flex items-start gap-3">
                            <div className="text-3xl">{plugin.icon || "🔌"}</div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                                    {plugin.name}
                                </h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                    v{plugin.version} • {plugin.author}
                                </p>
                                <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 line-clamp-2">
                                    {plugin.description}
                                </p>
                                <div className="mt-3">
                                    <span className={`text-xs px-2 py-1 rounded-full ${categoryColors[plugin.category]}`}>
                                        {plugin.category}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </button>
                ))}
            </div>

            {filteredPlugins.length === 0 && (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    No plugins found matching your criteria.
                </div>
            )}

            {/* Recent Activity */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Recent Plugin Activity</h3>
                </div>
                <div className="p-4">
                    {logsLoading ? (
                        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Loading activity...
                        </div>
                    ) : recentLogs.length === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400">No plugin activity yet.</p>
                    ) : (
                        <div className="space-y-2">
                            {recentLogs.map((log) => {
                                const pluginName = plugins.find((p) => p.id === log.pluginId)?.name || log.pluginId;
                                return (
                                    <div
                                        key={log.id}
                                        className="flex items-center justify-between gap-3 text-sm border border-gray-100 dark:border-gray-700 rounded-md px-3 py-2"
                                    >
                                        <div className="min-w-0">
                                            <div className="font-medium text-gray-900 dark:text-white truncate">
                                                {pluginName}
                                            </div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                                {log.operation}
                                                {log.action ? `:${log.action}` : ""}
                                                {log.message ? ` • ${log.message}` : ""}
                                            </div>
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            <span
                                                className={`text-xs px-2 py-0.5 rounded-full ${log.status === "success"
                                                    ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300"
                                                    : "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300"
                                                    }`}
                                            >
                                                {log.status}
                                            </span>
                                            <div className="text-[11px] text-gray-400 mt-1">
                                                {log.durationMs != null ? `${log.durationMs} ms` : "-"}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Plugin Detail Modal */}
            {selectedPlugin && (
                <PluginDetailModal
                    plugin={selectedPlugin}
                    onClose={() => setSelectedPlugin(null)}
                    showToast={showToast}
                    loading={pluginLoading}
                    onLogUpdated={loadRecentLogs}
                />
            )}
        </div>
    );
}

interface PluginDetailModalProps {
    plugin: Plugin;
    onClose: () => void;
    showToast: (message: string, type: "success" | "error") => void;
    loading: boolean;
    onLogUpdated: () => void;
}

function PluginDetailModal({ plugin, onClose, showToast, loading, onLogUpdated }: PluginDetailModalProps) {
    const [config, setConfig] = useState<Record<string, any>>({});
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<ActionResult | null>(null);
    const [executing, setExecuting] = useState(false);
    const [selectedAction, setSelectedAction] = useState<string>("");

    const handleConfigChange = (key: string, value: any) => {
        setConfig((prev) => ({ ...prev, [key]: value }));
    };

    const handleTest = async () => {
        setTesting(true);
        setTestResult(null);
        try {
            const result = await api.testPlugin(plugin.metadata.id, config);
            setTestResult(result);
            onLogUpdated();
            if (result.success) {
                showToast("Connection test successful!", "success");
            } else {
                showToast(result.message || "Connection test failed", "error");
            }
        } catch (error: any) {
            showToast(error.message || "Test failed", "error");
        } finally {
            setTesting(false);
        }
    };

    const handleExecute = async () => {
        if (!selectedAction) return;
        setExecuting(true);
        try {
            const result = await api.executePluginAction(plugin.metadata.id, selectedAction, config);
            onLogUpdated();
            if (result.success) {
                showToast(result.message || "Action executed successfully!", "success");
            } else {
                showToast(result.message || "Action execution failed", "error");
            }
        } catch (error: any) {
            showToast(error.message || "Execution failed", "error");
        } finally {
            setExecuting(false);
        }
    };

    if (loading) {
        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-8">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto" />
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                            <div className="text-5xl">{plugin.metadata.icon || "🔌"}</div>
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                                    {plugin.metadata.name}
                                </h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                    v{plugin.metadata.version} • {plugin.metadata.author}
                                </p>
                                <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
                                    {plugin.metadata.description}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Configuration */}
                    {plugin.configSchema.length > 0 && (
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                                Configuration
                            </h3>
                            <div className="space-y-4">
                                {plugin.configSchema.map((field) => (
                                    <ConfigFieldInput
                                        key={field.key}
                                        field={field}
                                        value={config[field.key] || field.default || ""}
                                        onChange={(value) => handleConfigChange(field.key, value)}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Test Connection */}
                    <div>
                        <button
                            onClick={handleTest}
                            disabled={testing}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {testing ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <TestTube className="w-4 h-4" />
                            )}
                            Test Connection
                        </button>
                        {testResult && (
                            <div
                                className={`mt-3 p-3 rounded-lg flex items-start gap-2 ${testResult.success
                                    ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300"
                                    : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300"
                                    }`}
                            >
                                {testResult.success ? (
                                    <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                ) : (
                                    <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                )}
                                <span className="text-sm">{testResult.message}</span>
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    {plugin.actions.length > 0 && (
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                                Available Actions
                            </h3>
                            <div className="space-y-3">
                                {plugin.actions.map((action) => (
                                    <div
                                        key={action.id}
                                        className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h4 className="font-medium text-gray-900 dark:text-white">
                                                    {action.name}
                                                </h4>
                                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                                    {action.description}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    setSelectedAction(action.id);
                                                    handleExecute();
                                                }}
                                                disabled={executing}
                                                className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
                                            >
                                                {executing && selectedAction === action.id ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <Play className="w-4 h-4" />
                                                )}
                                                Run
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

interface ConfigFieldInputProps {
    field: PluginConfigField;
    value: any;
    onChange: (value: any) => void;
}

function ConfigFieldInput({ field, value, onChange }: ConfigFieldInputProps) {
    const inputClass =
        "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white";

    switch (field.type) {
        case "textarea":
            return (
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {field.label}
                        {field.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    {field.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{field.description}</p>
                    )}
                    <textarea
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        required={field.required}
                        rows={4}
                        className={inputClass}
                    />
                </div>
            );

        case "select":
            return (
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {field.label}
                        {field.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    {field.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{field.description}</p>
                    )}
                    <select
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        required={field.required}
                        className={inputClass}
                    >
                        <option value="">Select...</option>
                        {field.options?.map((opt) => (
                            <option key={opt} value={opt}>
                                {opt}
                            </option>
                        ))}
                    </select>
                </div>
            );

        case "checkbox":
            return (
                <div>
                    <label className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={!!value}
                            onChange={(e) => onChange(e.target.checked)}
                            className="w-4 h-4 text-indigo-600 border-gray-300 rounded"
                        />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {field.label}
                        </span>
                    </label>
                    {field.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">
                            {field.description}
                        </p>
                    )}
                </div>
            );

        case "number":
            return (
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {field.label}
                        {field.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    {field.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{field.description}</p>
                    )}
                    <input
                        type="number"
                        value={value}
                        onChange={(e) => onChange(Number(e.target.value))}
                        required={field.required}
                        className={inputClass}
                    />
                </div>
            );

        default:
            return (
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {field.label}
                        {field.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    {field.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{field.description}</p>
                    )}
                    <input
                        type={field.type === "password" ? "password" : field.type === "email" ? "email" : field.type === "url" ? "url" : "text"}
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        required={field.required}
                        className={inputClass}
                    />
                </div>
            );
    }
}
