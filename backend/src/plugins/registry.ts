/**
 * Plugin Registry — manages all available Fauke plugins.
 *
 * Responsibilities:
 *   - Register plugins
 *   - Retrieve plugins by ID
 *   - List all registered plugins
 *   - Validate plugin implementations
 *   - Track enabled/disabled state
 */

import {
    IFaukePlugin,
    PluginId,
    PluginMetadata,
    RegisteredPlugin,
    PluginCategory,
} from "./types.js";

class PluginRegistry {
    private plugins: Map<PluginId, RegisteredPlugin> = new Map();

    /**
     * Register a plugin in the registry.
     * Validates the plugin implementation before registering.
     */
    register(plugin: IFaukePlugin): void {
        this.validate(plugin);

        const existing = this.plugins.get(plugin.metadata.id);
        if (existing) {
            console.warn(
                `[PluginRegistry] Plugin "${plugin.metadata.id}" already registered. Overwriting.`
            );
        }

        this.plugins.set(plugin.metadata.id, {
            plugin,
            enabled: true,
            installedAt: new Date(),
        });

        console.log(
            `[PluginRegistry] ✓ Registered plugin: ${plugin.metadata.name} (${plugin.metadata.id}@${plugin.metadata.version})`
        );
    }

    /**
     * Unregister a plugin from the registry.
     */
    unregister(pluginId: PluginId): boolean {
        const removed = this.plugins.delete(pluginId);
        if (removed) {
            console.log(`[PluginRegistry] Unregistered plugin: ${pluginId}`);
        }
        return removed;
    }

    /**
     * Get a plugin by ID.
     * Throws if plugin not found.
     */
    get(pluginId: PluginId): IFaukePlugin {
        const registered = this.plugins.get(pluginId);
        if (!registered) {
            throw new Error(`Plugin not found: ${pluginId}`);
        }
        if (!registered.enabled) {
            throw new Error(`Plugin is disabled: ${pluginId}`);
        }
        return registered.plugin;
    }

    /**
     * Get a plugin by ID (returns undefined if not found).
     */
    find(pluginId: PluginId): IFaukePlugin | undefined {
        const registered = this.plugins.get(pluginId);
        return registered?.enabled ? registered.plugin : undefined;
    }

    /**
     * Check if a plugin is registered.
     */
    has(pluginId: PluginId): boolean {
        return this.plugins.has(pluginId);
    }

    /**
     * Enable a plugin.
     */
    enable(pluginId: PluginId): void {
        const registered = this.plugins.get(pluginId);
        if (!registered) {
            throw new Error(`Plugin not found: ${pluginId}`);
        }
        registered.enabled = true;
        console.log(`[PluginRegistry] Enabled plugin: ${pluginId}`);
    }

    /**
     * Disable a plugin.
     */
    disable(pluginId: PluginId): void {
        const registered = this.plugins.get(pluginId);
        if (!registered) {
            throw new Error(`Plugin not found: ${pluginId}`);
        }
        registered.enabled = false;
        console.log(`[PluginRegistry] Disabled plugin: ${pluginId}`);
    }

    /**
     * List all registered plugins (enabled and disabled).
     */
    list(): PluginMetadata[] {
        return Array.from(this.plugins.values()).map((r) => r.plugin.metadata);
    }

    /**
     * List plugins filtered by category.
     */
    listByCategory(category: PluginCategory): PluginMetadata[] {
        return Array.from(this.plugins.values())
            .filter((r) => r.plugin.metadata.category === category)
            .map((r) => r.plugin.metadata);
    }

    /**
     * List only enabled plugins.
     */
    listEnabled(): PluginMetadata[] {
        return Array.from(this.plugins.values())
            .filter((r) => r.enabled)
            .map((r) => r.plugin.metadata);
    }

    /**
     * Get full registered plugin info (including enabled state).
     */
    getInfo(pluginId: PluginId): RegisteredPlugin | undefined {
        return this.plugins.get(pluginId);
    }

    /**
     * Validate plugin implementation.
     * Throws if the plugin doesn't conform to IFaukePlugin interface.
     */
    private validate(plugin: IFaukePlugin): void {
        if (!plugin.metadata) {
            throw new Error("Plugin missing metadata");
        }
        if (!plugin.metadata.id) {
            throw new Error("Plugin missing metadata.id");
        }
        if (!plugin.metadata.name) {
            throw new Error("Plugin missing metadata.name");
        }
        if (!plugin.metadata.version) {
            throw new Error("Plugin missing metadata.version");
        }
        if (!plugin.metadata.author) {
            throw new Error("Plugin missing metadata.author");
        }
        if (!plugin.metadata.category) {
            throw new Error("Plugin missing metadata.category");
        }
        if (typeof plugin.getConfigSchema !== "function") {
            throw new Error("Plugin missing getConfigSchema() method");
        }
        if (typeof plugin.getActions !== "function") {
            throw new Error("Plugin missing getActions() method");
        }
        if (typeof plugin.executeAction !== "function") {
            throw new Error("Plugin missing executeAction() method");
        }
    }

    /**
     * Clear all plugins (useful for testing).
     */
    clear(): void {
        this.plugins.clear();
        console.log("[PluginRegistry] Cleared all plugins");
    }

    /**
     * Get registry statistics.
     */
    stats(): {
        total: number;
        enabled: number;
        disabled: number;
        byCategory: Record<PluginCategory, number>;
    } {
        const all = Array.from(this.plugins.values());
        const enabled = all.filter((r) => r.enabled);
        const disabled = all.filter((r) => !r.enabled);

        const byCategory: Record<string, number> = {};
        for (const r of all) {
            const cat = r.plugin.metadata.category;
            byCategory[cat] = (byCategory[cat] || 0) + 1;
        }

        return {
            total: all.length,
            enabled: enabled.length,
            disabled: disabled.length,
            byCategory: byCategory as Record<PluginCategory, number>,
        };
    }
}

// Singleton instance
export const pluginRegistry = new PluginRegistry();

// Export class for testing
export { PluginRegistry };
