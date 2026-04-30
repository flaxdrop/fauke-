/**
 * Adapter Bridge — converts legacy IntegrationAdapters to IFaukePlugin format.
 *
 * This allows us to use existing Fortnox/Visma/PE Accounting adapters
 * in the new plugin system without rewriting them.
 *
 * Usage:
 *   const fortnoxPlugin = adaptIntegration(new FortnoxMockAdapter(), metadata);
 *   pluginRegistry.register(fortnoxPlugin);
 */

import {
    IFaukePlugin,
    ITimeSyncPlugin,
    PluginMetadata,
    ConfigField,
    PluginAction,
    PluginContext,
    ActionResult,
    TimeEntryPayload,
    SyncResult,
} from "./types.js";
import {
    IntegrationAdapter,
    ProviderConfig,
    SyncTimeEntry,
} from "../integrations/types.js";
import { getConfigFields } from "../integrations/registry.js";

/**
 * Convert IntegrationAdapter to IFaukePlugin.
 */
export function adaptIntegration(
    adapter: IntegrationAdapter,
    customMetadata?: Partial<PluginMetadata>
): ITimeSyncPlugin {
    const provider = adapter.provider;

    // Default metadata based on provider
    const defaultMetadata: PluginMetadata = {
        id: `${provider}-sync`,
        name: providerNames[provider] || provider,
        version: "1.0.0",
        author: "Fauke",
        description: `Sync time entries to ${providerNames[provider] || provider}`,
        category: "integration",
        icon: providerIcons[provider] || "🔗",
        ...customMetadata,
    };

    return new IntegrationPluginAdapter(adapter, defaultMetadata);
}

/** Human-readable provider names */
const providerNames: Record<string, string> = {
    fortnox: "Fortnox",
    visma: "Visma",
    pe_accounting: "PE Accounting",
};

/** Provider icons */
const providerIcons: Record<string, string> = {
    fortnox: "🇸🇪",
    visma: "📊",
    pe_accounting: "💼",
};

/**
 * Internal adapter class that bridges IntegrationAdapter → IFaukePlugin
 */
class IntegrationPluginAdapter implements ITimeSyncPlugin {
    readonly metadata: PluginMetadata;

    constructor(
        private adapter: IntegrationAdapter,
        metadata: PluginMetadata
    ) {
        this.metadata = metadata;
    }

    getConfigSchema(): ConfigField[] {
        // Convert legacy config fields to new format
        const legacyFields = getConfigFields(this.adapter.provider);
        return legacyFields.map((field) => ({
            key: field.key,
            label: field.label,
            type: field.type === "select" ? "select" : field.type === "password" ? "password" : "text",
            required: field.required,
            options: field.options,
            sensitive: field.type === "password",
        }));
    }

    getActions(): PluginAction[] {
        return [
            {
                id: "sync",
                name: "Sync Time Entries",
                description: "Push time entries to external system",
                params: [
                    {
                        key: "entries",
                        label: "Time Entries",
                        type: "json",
                        required: true,
                    },
                ],
            },
            {
                id: "test",
                name: "Test Connection",
                description: "Verify credentials and connectivity",
            },
        ];
    }

    async testConnection(context: PluginContext): Promise<ActionResult> {
        try {
            const result = await this.adapter.testConnection(context.config as ProviderConfig);
            return {
                success: result.success,
                message: result.message,
            };
        } catch (error: any) {
            return {
                success: false,
                message: error.message || "Connection test failed",
            };
        }
    }

    async executeAction(
        actionId: string,
        context: PluginContext,
        params?: any
    ): Promise<ActionResult> {
        switch (actionId) {
            case "test":
                return this.testConnection(context);

            case "sync":
                if (!params?.entries || !Array.isArray(params.entries)) {
                    return {
                        success: false,
                        message: "Missing or invalid 'entries' parameter",
                    };
                }
                const syncResult = await this.syncTimeEntries(context, params.entries);
                return {
                    success: syncResult.success,
                    message: syncResult.message,
                    data: {
                        entriesSynced: syncResult.entriesSynced,
                        failedEntryIds: syncResult.failedEntryIds,
                    },
                };

            default:
                return {
                    success: false,
                    message: `Unknown action: ${actionId}`,
                };
        }
    }

    async syncTimeEntries(
        context: PluginContext,
        entries: TimeEntryPayload[]
    ): Promise<SyncResult> {
        // Convert TimeEntryPayload[] → SyncTimeEntry[]
        const legacyEntries: SyncTimeEntry[] = entries.map((e) => ({
            date: e.date,
            hours: e.hours,
            projectName: e.projectName,
            projectId: e.projectId,
            note: e.note,
            externalEmployeeId: e.externalEmployeeId || "",
        }));

        try {
            const result = await this.adapter.syncTimeEntries(
                context.config as ProviderConfig,
                legacyEntries
            );
            return result;
        } catch (error: any) {
            return {
                success: false,
                entriesSynced: 0,
                message: error.message || "Sync failed",
            };
        }
    }
}
