/**
 * Plugin System — main entry point.
 *
 * Auto-registers all built-in plugins on import.
 */

export * from "./types.js";
export * from "./registry.js";
export * from "./adapter-bridge.js";

import { pluginRegistry } from "./registry.js";
import { adaptIntegration } from "./adapter-bridge.js";

// Import legacy adapters
import { FortnoxMockAdapter } from "../integrations/adapters/fortnox.mock.js";
import { VismaMockAdapter } from "../integrations/adapters/visma.mock.js";
import { PEAccountingMockAdapter } from "../integrations/adapters/pe-accounting.mock.js";

// Import built-in plugins
import { GenericRestPlugin } from "./builtin/generic-rest.plugin.js";
import { WebhookNotificationPlugin } from "./builtin/webhook-notification.plugin.js";

/**
 * Register all built-in plugins.
 * Called automatically on import.
 */
function registerBuiltins() {
    // Convert legacy integration adapters to plugins
    pluginRegistry.register(
        adaptIntegration(new FortnoxMockAdapter(), {
            name: "Fortnox",
            description: "Sync time entries to Fortnox cloud accounting platform. OAuth 2.0 auth, JSON REST API.",
            icon: "🇸🇪",
        })
    );

    pluginRegistry.register(
        adaptIntegration(new VismaMockAdapter(), {
            name: "Visma",
            description: "Sync time entries to Visma eEkonomi or Lön Smart. OAuth 2.0 auth, JSON REST API.",
            icon: "📊",
        })
    );

    pluginRegistry.register(
        adaptIntegration(new PEAccountingMockAdapter(), {
            name: "PE Accounting",
            description: "Sync time entries to PE Accounting. API token auth, XML REST API.",
            icon: "💼",
        })
    );

    // Register new built-in plugins
    pluginRegistry.register(new GenericRestPlugin());
    pluginRegistry.register(new WebhookNotificationPlugin());

    console.log(`[PluginSystem] Registered ${pluginRegistry.list().length} built-in plugins`);
}

// Auto-register on import
registerBuiltins();
