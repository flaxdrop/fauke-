/**
 * Admin routes for managing integrations.
 *
 * All routes are protected by authMiddleware + adminMiddleware (mounted in index.ts).
 */

import { Router } from "express";
import type { Request, Response } from "express";
import { prisma } from "../db.js";
import { getAdapter, PROVIDERS, getConfigFields } from "../integrations/registry.js";
import { ProviderKey, ProviderConfig, SyncTimeEntry } from "../integrations/types.js";
import {
  decryptConfig,
  encryptConfig,
  maskConfig,
  mergeMaskedSensitiveValues,
} from "../integrations/config-crypto.js";
import { checkRateLimit, withRetry } from "../integrations/resilience.js";

export const integrationRouter = Router();

// ─── Providers metadata (what the admin UI uses to render forms) ───
integrationRouter.get("/providers", (_req: Request, res: Response) => {
  const providers = PROVIDERS.map((p) => ({
    ...p,
    configFields: getConfigFields(p.key),
  }));
  res.json(providers);
});

// ─── List all integrations ───
integrationRouter.get("/", async (_req: Request, res: Response) => {
  try {
    const integrations = await prisma.integration.findMany({
      include: {
        users: {
          include: {
            user: { select: { id: true, displayName: true, username: true } },
          },
        },
        _count: { select: { syncLogs: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    // Strip sensitive config values for the listing
    const safe = integrations.map((i: typeof integrations[number]) => ({
      ...i,
      config: maskConfig(decryptConfig(i.config)),
      users: i.users.map((ui: typeof i.users[number]) => ({
        id: ui.id,
        externalId: ui.externalId,
        user: ui.user,
      })),
    }));

    res.json(safe);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch integrations" });
  }
});

// ─── Get single integration (full config for editing) ───
integrationRouter.get("/:id", async (req: Request<{ id: string }>, res: Response) => {
  try {
    const integration = await prisma.integration.findUnique({
      where: { id: req.params.id },
      include: {
        users: {
          include: {
            user: { select: { id: true, displayName: true, username: true } },
          },
        },
      },
    });

    if (!integration) {
      res.status(404).json({ error: "Integration not found" });
      return;
    }

    res.json({
      ...integration,
      config: maskConfig(decryptConfig(integration.config)),
      users: (integration as any).users.map((ui: any) => ({
        id: ui.id,
        externalId: ui.externalId,
        user: ui.user,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch integration" });
  }
});

// ─── Create integration ───
integrationRouter.post("/", async (req: Request, res: Response) => {
  try {
    const { provider, name, config } = req.body;

    if (!provider || !name || !config) {
      res.status(400).json({ error: "Provider, name, and config are required" });
      return;
    }

    if (!PROVIDERS.find((p) => p.key === provider)) {
      res.status(400).json({ error: `Unknown provider: ${provider}` });
      return;
    }

    const encryptedConfig = encryptConfig(config as Record<string, unknown>);

    const integration = await prisma.integration.create({
      data: { provider, name, config: encryptedConfig as any },
    });

    res.status(201).json({
      ...integration,
      config: maskConfig(config as Record<string, unknown>),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create integration" });
  }
});

// ─── Update integration ───
integrationRouter.put("/:id", async (req: Request<{ id: string }>, res: Response) => {
  try {
    const { name, config, enabled } = req.body;

    const existing = await prisma.integration.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: "Integration not found" });
      return;
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (config !== undefined) {
      const existingConfig = decryptConfig(existing.config);
      const mergedConfig = mergeMaskedSensitiveValues(
        config as Record<string, unknown>,
        existingConfig
      );
      data.config = encryptConfig(mergedConfig);
    }
    if (enabled !== undefined) data.enabled = enabled;

    const updated = await prisma.integration.update({
      where: { id: req.params.id },
      data,
    });

    res.json({
      ...updated,
      config: maskConfig(decryptConfig(updated.config)),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update integration" });
  }
});

// ─── Delete integration ───
integrationRouter.delete("/:id", async (req: Request<{ id: string }>, res: Response) => {
  try {
    const existing = await prisma.integration.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: "Integration not found" });
      return;
    }

    await prisma.integration.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete integration" });
  }
});

// ─── Test connection ───
integrationRouter.post("/:id/test", async (req: Request<{ id: string }>, res: Response) => {
  try {
    const integration = await prisma.integration.findUnique({ where: { id: req.params.id } });
    if (!integration) {
      res.status(404).json({ error: "Integration not found" });
      return;
    }

    const limit = checkRateLimit(integration.id, "test");
    if (!limit.allowed) {
      res.status(429).json({
        error: "Rate limit exceeded for integration test",
        retryAfterSeconds: Math.ceil(limit.retryAfterMs / 1000),
      });
      return;
    }

    const adapter = getAdapter(integration.provider as ProviderKey);
    const decryptedConfig = decryptConfig(integration.config);
    const result = await withRetry(() =>
      adapter.testConnection(decryptedConfig as unknown as ProviderConfig)
    );

    // Log the test
    await prisma.syncLog.create({
      data: {
        integrationId: integration.id,
        status: result.success ? "success" : "error",
        message: `Connection test: ${result.message}`,
      },
    });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to test connection" });
  }
});

// ─── Assign users to integration ───
integrationRouter.post("/:id/users", async (req: Request<{ id: string }>, res: Response) => {
  try {
    const { userId, externalId } = req.body;

    if (!userId) {
      res.status(400).json({ error: "userId is required" });
      return;
    }

    const integration = await prisma.integration.findUnique({ where: { id: req.params.id } });
    if (!integration) {
      res.status(404).json({ error: "Integration not found" });
      return;
    }

    const assignment = await prisma.userIntegration.upsert({
      where: {
        userId_integrationId: { userId, integrationId: req.params.id },
      },
      create: {
        userId,
        integrationId: req.params.id,
        externalId: externalId || null,
      },
      update: {
        externalId: externalId || null,
      },
      include: {
        user: { select: { id: true, displayName: true, username: true } },
      },
    });

    res.json({
      id: assignment.id,
      externalId: assignment.externalId,
      user: (assignment as any).user,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to assign user" });
  }
});

// ─── Remove user from integration ───
integrationRouter.delete("/:id/users/:userId", async (req: Request<{ id: string; userId: string }>, res: Response) => {
  try {
    await prisma.userIntegration.delete({
      where: {
        userId_integrationId: {
          userId: req.params.userId,
          integrationId: req.params.id,
        },
      },
    });
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to remove user assignment" });
  }
});

// ─── Sync time entries for a specific user ───
integrationRouter.post("/:id/sync", async (req: Request<{ id: string }>, res: Response) => {
  try {
    const { userId, from, to } = req.body;

    if (!userId || !from || !to) {
      res.status(400).json({ error: "userId, from, and to dates are required" });
      return;
    }

    const integration = await prisma.integration.findUnique({ where: { id: req.params.id } });
    if (!integration) {
      res.status(404).json({ error: "Integration not found" });
      return;
    }

    const limit = checkRateLimit(integration.id, "sync");
    if (!limit.allowed) {
      res.status(429).json({
        error: "Rate limit exceeded for integration sync",
        retryAfterSeconds: Math.ceil(limit.retryAfterMs / 1000),
      });
      return;
    }

    // Get the user's external ID for this integration
    const userIntegration = await prisma.userIntegration.findUnique({
      where: {
        userId_integrationId: { userId, integrationId: req.params.id },
      },
    });
    if (!userIntegration) {
      res.status(400).json({ error: "User is not assigned to this integration" });
      return;
    }
    if (!userIntegration.externalId) {
      res.status(400).json({ error: "User has no external ID configured for this integration" });
      return;
    }

    // Fetch time entries
    const entries = await prisma.timeEntry.findMany({
      where: {
        userId,
        date: {
          gte: new Date(from),
          lte: new Date(to),
        },
      },
      include: { project: true },
      orderBy: { date: "asc" },
    });

    // Map to sync format
    const syncEntries: SyncTimeEntry[] = entries.map((e: typeof entries[number]) => ({
      date: new Date(e.date).toISOString().split("T")[0],
      hours: Number(e.hours),
      projectName: e.project.name,
      projectId: e.projectId,
      note: e.note,
      externalEmployeeId: userIntegration.externalId!,
    }));

    // Execute sync
    const adapter = getAdapter(integration.provider as ProviderKey);
    const decryptedConfig = decryptConfig(integration.config);
    const result = await withRetry(() =>
      adapter.syncTimeEntries(
        decryptedConfig as unknown as ProviderConfig,
        syncEntries
      )
    );

    // Log result
    await prisma.syncLog.create({
      data: {
        integrationId: integration.id,
        userId,
        status: result.success ? "success" : result.entriesSynced > 0 ? "partial" : "error",
        message: result.message || null,
        entriesSynced: result.entriesSynced,
      },
    });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to sync entries" });
  }
});

// ─── Get sync logs for an integration ───
integrationRouter.get("/:id/logs", async (req: Request<{ id: string }>, res: Response) => {
  try {
    const logs = await prisma.syncLog.findMany({
      where: { integrationId: req.params.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json(logs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch sync logs" });
  }
});

// ─── Get schedule config for an integration ───
integrationRouter.get("/:id/schedule", async (req: Request<{ id: string }>, res: Response) => {
  try {
    const integration = await prisma.integration.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        autoSyncEnabled: true,
        autoSyncTime: true,
        lastSyncAt: true,
      },
    });

    if (!integration) {
      res.status(404).json({ error: "Integration not found" });
      return;
    }

    res.json(integration);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch schedule" });
  }
});

// ─── Update schedule config for an integration ───
integrationRouter.put("/:id/schedule", async (req: Request<{ id: string }>, res: Response) => {
  try {
    const { autoSyncEnabled, autoSyncTime } = req.body;

    const integration = await prisma.integration.findUnique({
      where: { id: req.params.id },
    });
    if (!integration) {
      res.status(404).json({ error: "Integration not found" });
      return;
    }

    // Validate autoSyncTime format if provided
    if (autoSyncTime && !/^\d{2}:\d{2}$/.test(autoSyncTime)) {
      res.status(400).json({
        error: "Invalid autoSyncTime format. Use HH:mm (e.g., '02:00')",
      });
      return;
    }

    const updated = await prisma.integration.update({
      where: { id: req.params.id },
      data: {
        autoSyncEnabled: autoSyncEnabled !== undefined ? autoSyncEnabled : integration.autoSyncEnabled,
        autoSyncTime: autoSyncTime || integration.autoSyncTime,
      },
      select: {
        id: true,
        autoSyncEnabled: true,
        autoSyncTime: true,
        lastSyncAt: true,
      },
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update schedule" });
  }
});

