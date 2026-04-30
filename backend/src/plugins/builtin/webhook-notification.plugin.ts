/**
 * Webhook Notification Plugin
 *
 * Sends notifications to a webhook URL when time entries are created,
 * updated, or synced. Useful for:
 *   - Slack notifications
 *   - Discord alerts
 *   - Email triggers via Zapier/Make
 *   - Custom monitoring dashboards
 */

import {
    IFaukePlugin,
    PluginMetadata,
    ConfigField,
    PluginAction,
    PluginContext,
    ActionResult,
} from "../types.js";

export class WebhookNotificationPlugin implements IFaukePlugin {
    readonly metadata: PluginMetadata = {
        id: "webhook-notification",
        name: "Webhook Notifications",
        version: "1.0.0",
        author: "Fauke",
        description: "Send notifications to Slack, Discord, or any webhook URL when time entries are synced.",
        category: "notification",
        icon: "🔔",
        keywords: ["webhook", "notification", "slack", "discord", "alert"],
    };

    getConfigSchema(): ConfigField[] {
        return [
            {
                key: "webhookUrl",
                label: "Webhook URL",
                type: "url",
                description: "The webhook endpoint (Slack, Discord, Zapier, etc.)",
                required: true,
                sensitive: true,
            },
            {
                key: "format",
                label: "Format",
                type: "select",
                options: ["slack", "discord", "generic"],
                default: "generic",
                description: "Payload format to use",
                required: true,
            },
            {
                key: "events",
                label: "Events to notify on",
                type: "multiselect",
                options: ["sync_success", "sync_failed", "entry_created"],
                default: ["sync_success", "sync_failed"],
                description: "Which events should trigger notifications",
                required: true,
            },
            {
                key: "username",
                label: "Bot Username",
                type: "text",
                default: "Fauke Bot",
                description: "Display name for the bot (Slack/Discord)",
                required: false,
            },
        ];
    }

    getActions(): PluginAction[] {
        return [
            {
                id: "test",
                name: "Test Notification",
                description: "Send a test message to verify the webhook",
            },
            {
                id: "notify_sync",
                name: "Notify Sync Result",
                description: "Send a notification about a sync operation",
                params: [
                    {
                        key: "success",
                        label: "Success",
                        type: "checkbox",
                        required: true,
                    },
                    {
                        key: "entriesSynced",
                        label: "Entries Synced",
                        type: "number",
                        required: true,
                    },
                    {
                        key: "message",
                        label: "Message",
                        type: "text",
                        required: false,
                    },
                ],
            },
        ];
    }

    async testConnection(context: PluginContext): Promise<ActionResult> {
        const { webhookUrl, format = "generic", username = "Fauke Bot" } = context.config;

        if (!webhookUrl) {
            return { success: false, message: "Webhook URL is required" };
        }

        try {
            const payload = this.buildPayload(
                format,
                {
                    title: "🧪 Test Notification",
                    message: "Fauke webhook connection test successful!",
                    color: "good",
                },
                username
            );

            const response = await fetch(webhookUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            return {
                success: response.ok,
                message: response.ok
                    ? "Test notification sent successfully"
                    : `Failed to send notification (HTTP ${response.status})`,
            };
        } catch (error: any) {
            return {
                success: false,
                message: `Failed to send notification: ${error.message}`,
            };
        }
    }

    async executeAction(
        actionId: string,
        context: PluginContext,
        params?: any
    ): Promise<ActionResult> {
        const { webhookUrl, format = "generic", username = "Fauke Bot", events = [] } = context.config;

        switch (actionId) {
            case "test":
                return this.testConnection(context);

            case "notify_sync": {
                const { success, entriesSynced, message } = params || {};
                const eventType = success ? "sync_success" : "sync_failed";

                // Check if this event is enabled
                if (!events.includes(eventType)) {
                    return {
                        success: true,
                        message: `Event ${eventType} is not enabled, skipping notification`,
                    };
                }

                const payload = this.buildPayload(
                    format,
                    {
                        title: success ? "✅ Sync Successful" : "❌ Sync Failed",
                        message: message || `${entriesSynced} time entries synced`,
                        color: success ? "good" : "danger",
                    },
                    username
                );

                try {
                    const response = await fetch(webhookUrl, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload),
                    });

                    return {
                        success: response.ok,
                        message: response.ok ? "Notification sent" : "Failed to send notification",
                    };
                } catch (error: any) {
                    return {
                        success: false,
                        message: `Failed to send notification: ${error.message}`,
                    };
                }
            }

            default:
                return { success: false, message: `Unknown action: ${actionId}` };
        }
    }

    private buildPayload(
        format: string,
        data: { title: string; message: string; color: string },
        username: string
    ): any {
        switch (format) {
            case "slack":
                return {
                    username,
                    attachments: [
                        {
                            title: data.title,
                            text: data.message,
                            color: data.color,
                        },
                    ],
                };

            case "discord":
                return {
                    username,
                    embeds: [
                        {
                            title: data.title,
                            description: data.message,
                            color: data.color === "good" ? 0x00ff00 : 0xff0000,
                        },
                    ],
                };

            case "generic":
            default:
                return {
                    title: data.title,
                    message: data.message,
                    timestamp: new Date().toISOString(),
                };
        }
    }
}
