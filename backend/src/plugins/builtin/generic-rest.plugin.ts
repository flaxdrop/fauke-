/**
 * Generic REST POST Plugin
 *
 * A flexible plugin that can push time entries to any REST API endpoint.
 * Users configure the target URL, HTTP method, headers, and body template.
 *
 * Perfect for:
 *   - Custom internal APIs
 *   - Zapier/Make.com webhooks
 *   - Simple integrations without dedicated adapters
 */

import {
    ITimeSyncPlugin,
    PluginMetadata,
    ConfigField,
    PluginAction,
    PluginContext,
    ActionResult,
    TimeEntryPayload,
    SyncResult,
} from "../types.js";

export class GenericRestPlugin implements ITimeSyncPlugin {
    readonly metadata: PluginMetadata = {
        id: "generic-rest-post",
        name: "Generic REST POST",
        version: "1.0.0",
        author: "Fauke",
        description: "Push time entries to any REST API endpoint with configurable URL, headers, and body template.",
        category: "integration",
        icon: "🌐",
        keywords: ["rest", "api", "webhook", "generic", "custom"],
    };

    getConfigSchema(): ConfigField[] {
        return [
            {
                key: "url",
                label: "Target URL",
                type: "url",
                description: "The endpoint to POST time entries to",
                required: true,
            },
            {
                key: "method",
                label: "HTTP Method",
                type: "select",
                options: ["POST", "PUT", "PATCH"],
                default: "POST",
                required: true,
            },
            {
                key: "headers",
                label: "HTTP Headers (JSON)",
                type: "json",
                description: 'e.g. {"Authorization": "Bearer token", "Content-Type": "application/json"}',
                required: false,
            },
            {
                key: "bodyTemplate",
                label: "Body Template (JSON)",
                type: "json",
                description: "Use {{date}}, {{hours}}, {{projectName}}, {{note}} placeholders",
                required: false,
            },
            {
                key: "timeout",
                label: "Timeout (ms)",
                type: "number",
                default: 5000,
                required: false,
            },
        ];
    }

    getActions(): PluginAction[] {
        return [
            {
                id: "sync",
                name: "Sync Time Entries",
                description: "POST time entries to configured endpoint",
            },
            {
                id: "test",
                name: "Test Connection",
                description: "Send a test request to verify the endpoint",
            },
        ];
    }

    async testConnection(context: PluginContext): Promise<ActionResult> {
        const { url, method = "POST", headers, timeout = 5000 } = context.config;

        if (!url) {
            return { success: false, message: "URL is required" };
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            const response = await fetch(url, {
                method,
                headers: headers ? JSON.parse(JSON.stringify(headers)) : { "Content-Type": "application/json" },
                body: JSON.stringify({ test: true, message: "Fauke connection test" }),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            return {
                success: response.ok,
                message: response.ok
                    ? `Connection OK (HTTP ${response.status})`
                    : `HTTP ${response.status}: ${response.statusText}`,
            };
        } catch (error: any) {
            return {
                success: false,
                message: error.name === "AbortError" ? "Request timeout" : error.message,
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
                if (!params?.entries) {
                    return { success: false, message: "Missing entries parameter" };
                }
                const result = await this.syncTimeEntries(context, params.entries);
                return {
                    success: result.success,
                    message: result.message,
                    data: { entriesSynced: result.entriesSynced },
                };
            default:
                return { success: false, message: `Unknown action: ${actionId}` };
        }
    }

    async syncTimeEntries(
        context: PluginContext,
        entries: TimeEntryPayload[]
    ): Promise<SyncResult> {
        const { url, method = "POST", headers, bodyTemplate, timeout = 5000 } = context.config;

        if (!url) {
            return { success: false, entriesSynced: 0, message: "URL is required" };
        }

        let synced = 0;
        const failed: string[] = [];

        for (const entry of entries) {
            try {
                const body = bodyTemplate
                    ? this.applyTemplate(bodyTemplate, entry)
                    : entry;

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeout);

                const response = await fetch(url, {
                    method,
                    headers: headers ? JSON.parse(JSON.stringify(headers)) : { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                    signal: controller.signal,
                });

                clearTimeout(timeoutId);

                if (response.ok) {
                    synced++;
                } else {
                    failed.push(entry.id);
                }
            } catch (error) {
                failed.push(entry.id);
            }
        }

        return {
            success: failed.length === 0,
            entriesSynced: synced,
            message: failed.length > 0
                ? `Synced ${synced}/${entries.length} entries`
                : `Successfully synced ${synced} entries`,
            failedEntryIds: failed.length > 0 ? failed : undefined,
        };
    }

    private applyTemplate(template: any, entry: TimeEntryPayload): any {
        const str = JSON.stringify(template);
        const replaced = str
            .replace(/\{\{date\}\}/g, entry.date)
            .replace(/\{\{hours\}\}/g, String(entry.hours))
            .replace(/\{\{projectName\}\}/g, entry.projectName)
            .replace(/\{\{projectId\}\}/g, entry.projectId)
            .replace(/\{\{note\}\}/g, entry.note || "");
        return JSON.parse(replaced);
    }
}
