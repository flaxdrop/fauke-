/**
 * Fauke Plugin System — v2.0
 *
 * A plugin is a self-contained module that extends Fauke's functionality.
 * Plugins can:
 *   - Sync time entries to external systems (Fortnox, Jira, etc.)
 *   - Export data in custom formats
 *   - Import data from external sources
 *   - Transform or validate data
 *   - Send notifications or webhooks
 *
 * Each plugin declares:
 *   - Metadata (id, name, version, author, description)
 *   - Config schema (fields needed to configure the plugin)
 *   - Actions (operations the plugin can perform)
 *   - Hooks (lifecycle methods: install, uninstall, etc.)
 */

/** Plugin unique identifier (e.g. "fortnox-sync", "jira-tempo", "generic-rest") */
export type PluginId = string;

/** Semver version string */
export type Version = string;

/** Plugin category for organization */
export type PluginCategory =
    | "integration"    // Sync to external time tracking systems
    | "export"         // Export formats (CSV, PDF, Excel, etc.)
    | "import"         // Import from external sources
    | "notification"   // Slack, email, webhooks
    | "utility"        // Data transformation, validation, etc.
    | "other";

/** Field type for plugin configuration UI */
export type ConfigFieldType =
    | "text"
    | "password"
    | "email"
    | "url"
    | "number"
    | "select"
    | "multiselect"
    | "checkbox"
    | "textarea"
    | "json";

/** Configuration field schema */
export interface ConfigField {
    key: string;
    label: string;
    type: ConfigFieldType;
    description?: string;
    required: boolean;
    default?: any;
    options?: string[];  // For select/multiselect
    validation?: {
        pattern?: string;   // Regex pattern
        min?: number;
        max?: number;
        minLength?: number;
        maxLength?: number;
    };
    sensitive?: boolean;  // Should be encrypted at rest
}

/** Plugin metadata */
export interface PluginMetadata {
    id: PluginId;
    name: string;
    version: Version;
    author: string;
    description: string;
    category: PluginCategory;
    homepage?: string;
    repository?: string;
    license?: string;
    keywords?: string[];
    icon?: string;  // Emoji or URL
}

/** Plugin configuration (stored in DB per plugin instance) */
export type PluginConfig = Record<string, any>;

/** Action that a plugin can perform */
export interface PluginAction {
    id: string;
    name: string;
    description: string;
    /** Parameters the action accepts */
    params?: ConfigField[];
}

/** Result of executing a plugin action */
export interface ActionResult {
    success: boolean;
    message?: string;
    data?: any;
    errors?: Array<{ field?: string; message: string }>;
}

/** Context passed to plugin methods */
export interface PluginContext {
    pluginId: PluginId;
    config: PluginConfig;
    userId?: string;
    /** Custom metadata or state */
    meta?: Record<string, any>;
}

/** Time entry payload for sync actions */
export interface TimeEntryPayload {
    id: string;
    date: string;          // YYYY-MM-DD
    hours: number;
    projectId: string;
    projectName: string;
    note: string | null;
    userId: string;
    externalEmployeeId?: string;  // Optional mapping to external system
}

/** Sync result for time entry operations */
export interface SyncResult {
    success: boolean;
    entriesSynced: number;
    message?: string;
    failedEntryIds?: string[];
}

/**
 * Main plugin interface — every plugin must implement this.
 */
export interface IFaukePlugin {
    /** Plugin metadata (read-only) */
    readonly metadata: PluginMetadata;

    /** Configuration fields this plugin needs */
    getConfigSchema(): ConfigField[];

    /** Actions this plugin can perform */
    getActions(): PluginAction[];

    /** Test if the plugin configuration is valid (e.g. API connection) */
    testConnection?(context: PluginContext): Promise<ActionResult>;

    /** Execute a named action */
    executeAction(
        actionId: string,
        context: PluginContext,
        params?: any
    ): Promise<ActionResult>;

    /** Lifecycle: called when plugin is installed/enabled */
    onInstall?(context: PluginContext): Promise<void>;

    /** Lifecycle: called when plugin is uninstalled/disabled */
    onUninstall?(context: PluginContext): Promise<void>;

    /** Lifecycle: called when config is updated */
    onConfigUpdate?(context: PluginContext, oldConfig: PluginConfig): Promise<void>;
}

/**
 * Helper type for time-sync plugins (most common case).
 * Provides a simpler interface for plugins that just sync time entries.
 */
export interface ITimeSyncPlugin extends IFaukePlugin {
    /** Sync time entries to external system */
    syncTimeEntries(
        context: PluginContext,
        entries: TimeEntryPayload[]
    ): Promise<SyncResult>;
}

/** Plugin registry entry */
export interface RegisteredPlugin {
    plugin: IFaukePlugin;
    enabled: boolean;
    installedAt: Date;
}
