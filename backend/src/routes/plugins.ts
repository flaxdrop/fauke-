// @ts-nocheck
/**
 * Plugin Management API Routes
 *
 * Public endpoints:
 *   GET  /api/plugins           — List all available plugins
 *   GET  /api/plugins/:id       — Get plugin details
 *
 * Protected endpoints (require auth):
 *   POST /api/plugins/:id/test  — Test plugin connection
 *   POST /api/plugins/:id/exec  — Execute plugin action
 */

import { Router } from "express";
import { pluginRegistry } from "../plugins/registry.js";
import { authMiddleware } from "../auth.js";
import { prisma } from "../db.js";

export const pluginRouter = Router();

async function logPluginExecution(params: {
    pluginId: string;
    operation: "test" | "execute";
    action?: string;
    userId?: string;
    status: "success" | "error";
    message?: string;
    durationMs?: number;
}) {
    try {
        await prisma.pluginExecutionLog.create({
            data: {
                pluginId: params.pluginId,
                operation: params.operation,
                action: params.action,
                userId: params.userId,
                status: params.status,
                message: params.message,
                durationMs: params.durationMs,
            },
        });
    } catch (error) {
        console.error("[PluginAPI] Failed to write plugin execution log:", error);
    }
}

/**
 * GET /api/plugins
 * List all registered plugins with their metadata.
 */
pluginRouter.get("/", (_req, res) => {
    try {
        const plugins = pluginRegistry.list();
        const stats = pluginRegistry.stats();

        res.json({
            plugins,
            stats,
        });
    } catch (error: any) {
        console.error("[PluginAPI] Failed to list plugins:", error);
        res.status(500).json({ error: "Failed to list plugins" });
    }
});

/**
 * GET /api/plugins/stats
 * Get plugin registry statistics.
 */
pluginRouter.get("/stats", (_req, res) => {
    try {
        const stats = pluginRegistry.stats();
        res.json(stats);
    } catch (error: any) {
        console.error("[PluginAPI] Failed to get stats:", error);
        res.status(500).json({ error: "Failed to get stats" });
    }
});

/**
 * GET /api/plugins/logs/recent
 * Get recent plugin execution logs.
 * Requires authentication.
 */
pluginRouter.get("/logs/recent", authMiddleware, async (req, res) => {
    try {
        const limitParam = Number(req.query.limit ?? 10);
        const limit = Number.isFinite(limitParam)
            ? Math.max(1, Math.min(100, Math.floor(limitParam)))
            : 10;

        const pluginId = typeof req.query.pluginId === "string" ? req.query.pluginId : undefined;

        const logs = await prisma.pluginExecutionLog.findMany({
            where: pluginId ? { pluginId } : undefined,
            orderBy: { createdAt: "desc" },
            take: limit,
        });

        res.json({ logs });
    } catch (error: any) {
        console.error("[PluginAPI] Failed to load recent logs:", error);
        res.status(500).json({ error: "Failed to load plugin logs" });
    }
});

/**
 * GET /api/plugins/:id
 * Get detailed plugin information including config schema and available actions.
 */
pluginRouter.get("/:id", (req, res) => {
    try {
        const { id } = req.params;
        const plugin = pluginRegistry.get(id);

        if (!plugin) {
            res.status(404).json({ error: "Plugin not found" });
            return;
        }

        res.json({
            metadata: plugin.metadata,
            configSchema: plugin.getConfigSchema(),
            actions: plugin.getActions(),
        });
    } catch (error: any) {
        if (error.message?.includes("not found")) {
            res.status(404).json({ error: "Plugin not found" });
        } else if (error.message?.includes("disabled")) {
            res.status(403).json({ error: "Plugin is disabled" });
        } else {
            console.error("[PluginAPI] Failed to get plugin:", error);
            res.status(500).json({ error: "Failed to get plugin details" });
        }
    }
});

/**
 * POST /api/plugins/:id/test
 * Test plugin connection with provided config.
 * Requires authentication.
 */
pluginRouter.post("/:id/test", authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { config } = req.body;
        const userId = req.user?.userId;

        if (!config) {
            res.status(400).json({ error: "Config is required" });
            return;
        }

        const plugin = pluginRegistry.get(id);
        if (!plugin) {
            res.status(404).json({ error: "Plugin not found" });
            return;
        }

        if (!plugin.testConnection) {
            res.status(400).json({ error: "Plugin does not support connection testing" });
            return;
        }

        const startedAt = Date.now();
        const result = await plugin.testConnection({
            pluginId: id,
            config,
            userId,
        });

        await logPluginExecution({
            pluginId: id,
            operation: "test",
            userId,
            status: result.success ? "success" : "error",
            message: result.message,
            durationMs: Date.now() - startedAt,
        });

        res.json(result);
    } catch (error: any) {
        await logPluginExecution({
            pluginId: req.params.id,
            operation: "test",
            userId: req.user?.userId,
            status: "error",
            message: error.message || "Connection test failed",
        });

        console.error("[PluginAPI] Test connection failed:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Connection test failed",
        });
    }
});

/**
 * POST /api/plugins/:id/execute
 * Execute a plugin action.
 * Requires authentication.
 */
pluginRouter.post("/:id/execute", authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { action, config, params } = req.body;
        const userId = req.user?.userId;

        if (!action) {
            res.status(400).json({ error: "Action ID is required" });
            return;
        }

        if (!config) {
            res.status(400).json({ error: "Config is required" });
            return;
        }

        const plugin = pluginRegistry.get(id);
        if (!plugin) {
            res.status(404).json({ error: "Plugin not found" });
            return;
        }

        // Verify action exists
        const actions = plugin.getActions();
        const actionExists = actions.some((a) => a.id === action);
        if (!actionExists) {
            res.status(400).json({ error: `Unknown action: ${action}` });
            return;
        }

        const startedAt = Date.now();
        const result = await plugin.executeAction(
            action,
            {
                pluginId: id,
                config,
                userId,
            },
            params
        );

        await logPluginExecution({
            pluginId: id,
            operation: "execute",
            action,
            userId,
            status: result.success ? "success" : "error",
            message: result.message,
            durationMs: Date.now() - startedAt,
        });

        res.json(result);
    } catch (error: any) {
        await logPluginExecution({
            pluginId: req.params.id,
            operation: "execute",
            action: req.body?.action,
            userId: req.user?.userId,
            status: "error",
            message: error.message || "Action execution failed",
        });

        console.error("[PluginAPI] Execute action failed:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Action execution failed",
        });
    }
});

/**
 * GET /api/plugins/category/:category
 * List plugins by category.
 */
pluginRouter.get("/category/:category", (req, res) => {
    try {
        const { category } = req.params;
        const plugins = pluginRegistry.listByCategory(category as any);
        res.json({ plugins });
    } catch (error: any) {
        console.error("[PluginAPI] Failed to list plugins by category:", error);
        res.status(500).json({ error: "Failed to list plugins" });
    }
});
