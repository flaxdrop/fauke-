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

export class JiraTempoPlugin implements ITimeSyncPlugin {
    readonly metadata: PluginMetadata = {
        id: "jira-tempo",
        name: "Jira Tempo",
        version: "1.0.0",
        author: "Fauke",
        description: "Sync time entries to Jira + Tempo using API token auth.",
        category: "integration",
        icon: "🧩",
        keywords: ["jira", "tempo", "worklog", "atlassian"],
    };

    getConfigSchema(): ConfigField[] {
        return [
            {
                key: "baseUrl",
                label: "Jira Base URL",
                type: "url",
                description: "Example: https://your-org.atlassian.net",
                required: true,
            },
            {
                key: "email",
                label: "Atlassian Account Email",
                type: "email",
                required: true,
            },
            {
                key: "apiToken",
                label: "Atlassian API Token",
                type: "password",
                required: true,
                sensitive: true,
            },
            {
                key: "issueKey",
                label: "Default Issue Key",
                type: "text",
                description: "Example: FAUKE-123",
                required: true,
            },
            {
                key: "dryRun",
                label: "Dry run (do not send)",
                type: "checkbox",
                default: true,
                required: false,
            },
        ];
    }

    getActions(): PluginAction[] {
        return [
            {
                id: "test",
                name: "Test Connection",
                description: "Verify Jira credentials by fetching current user",
            },
            {
                id: "sync_worklogs",
                name: "Sync Worklogs",
                description: "Push provided time entries to Jira issue as worklogs",
            },
        ];
    }

    async testConnection(context: PluginContext): Promise<ActionResult> {
        const { baseUrl, email, apiToken, dryRun } = context.config;

        if (!baseUrl || !email || !apiToken) {
            return { success: false, message: "baseUrl, email, and apiToken are required" };
        }

        if (dryRun) {
            return {
                success: true,
                message: "Dry run enabled: credentials format accepted",
            };
        }

        try {
            const auth = Buffer.from(`${email}:${apiToken}`).toString("base64");
            const response = await fetch(`${String(baseUrl).replace(/\/$/, "")}/rest/api/3/myself`, {
                method: "GET",
                headers: {
                    Authorization: `Basic ${auth}`,
                    Accept: "application/json",
                },
            });

            if (!response.ok) {
                return {
                    success: false,
                    message: `Jira auth failed (HTTP ${response.status})`,
                };
            }

            const data = (await response.json()) as { displayName?: string; accountId?: string };
            return {
                success: true,
                message: `Connected as ${data.displayName || data.accountId || "unknown user"}`,
            };
        } catch (error: unknown) {
            return {
                success: false,
                message: error instanceof Error ? error.message : "Failed to reach Jira API",
            };
        }
    }

    async executeAction(actionId: string, context: PluginContext, params?: unknown): Promise<ActionResult> {
        if (actionId === "test") {
            return this.testConnection(context);
        }

        if (actionId !== "sync_worklogs") {
            return { success: false, message: `Unknown action: ${actionId}` };
        }

        const entries = (params as { entries?: TimeEntryPayload[] } | undefined)?.entries ?? [];
        const syncResult = await this.syncTimeEntries(context, entries);

        return {
            success: syncResult.success,
            message: syncResult.message,
            data: {
                entriesSynced: syncResult.entriesSynced,
                failedEntryIds: syncResult.failedEntryIds,
            },
        };
    }

    async syncTimeEntries(context: PluginContext, entries: TimeEntryPayload[]): Promise<SyncResult> {
        const { baseUrl, email, apiToken, issueKey, dryRun } = context.config;

        if (!baseUrl || !email || !apiToken || !issueKey) {
            return {
                success: false,
                entriesSynced: 0,
                message: "baseUrl, email, apiToken, and issueKey are required",
            };
        }

        if (!entries.length) {
            return {
                success: true,
                entriesSynced: 0,
                message: "No entries provided (sync_worklogs expects params.entries)",
            };
        }

        if (dryRun) {
            return {
                success: true,
                entriesSynced: entries.length,
                message: `Dry run: ${entries.length} worklog(s) prepared for ${issueKey}`,
            };
        }

        const auth = Buffer.from(`${email}:${apiToken}`).toString("base64");
        const jiraBase = String(baseUrl).replace(/\/$/, "");

        let synced = 0;
        const failedEntryIds: string[] = [];

        for (const entry of entries) {
            try {
                const seconds = Math.max(60, Math.round(entry.hours * 3600));
                const started = `${entry.date}T09:00:00.000+0000`;

                const response = await fetch(`${jiraBase}/rest/api/3/issue/${issueKey}/worklog`, {
                    method: "POST",
                    headers: {
                        Authorization: `Basic ${auth}`,
                        Accept: "application/json",
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        timeSpentSeconds: seconds,
                        started,
                        comment: entry.note || `Synced from Fauke (${entry.projectName})`,
                    }),
                });

                if (response.ok) {
                    synced++;
                } else {
                    failedEntryIds.push(entry.id);
                }
            } catch {
                failedEntryIds.push(entry.id);
            }
        }

        return {
            success: failedEntryIds.length === 0,
            entriesSynced: synced,
            message:
                failedEntryIds.length > 0
                    ? `Synced ${synced}/${entries.length} worklog(s)`
                    : `Synced ${synced} worklog(s)`,
            failedEntryIds: failedEntryIds.length > 0 ? failedEntryIds : undefined,
        };
    }
}
