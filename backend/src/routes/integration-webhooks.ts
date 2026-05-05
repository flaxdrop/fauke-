import { Router } from "express";
import type { Request, Response } from "express";
import crypto from "node:crypto";
import { prisma } from "../db.js";
import { getAdapter } from "../integrations/registry.js";
import type { ProviderConfig, ProviderKey, SyncResult, SyncTimeEntry } from "../integrations/types.js";
import { decryptConfig } from "../integrations/config-crypto.js";
import { checkRateLimit, withRetry } from "../integrations/resilience.js";

export const integrationWebhookRouter = Router();

interface WebhookSyncBody {
    userId?: string;
    externalEmployeeId?: string;
    from?: string;
    to?: string;
    event?: string;
}

function timingSafeSecretMatch(providedSecret: string, expectedSecret: string): boolean {
    const provided = Buffer.from(providedSecret, "utf8");
    const expected = Buffer.from(expectedSecret, "utf8");

    if (provided.length !== expected.length) {
        return false;
    }

    return crypto.timingSafeEqual(provided, expected);
}

function parseDateRange(from?: string, to?: string): { fromDate: Date; toDate: Date } | null {
    if ((from && !to) || (!from && to)) {
        return null;
    }

    if (!from && !to) {
        const now = new Date();
        const startOfToday = new Date(now);
        startOfToday.setHours(0, 0, 0, 0);

        const endOfToday = new Date(now);
        endOfToday.setHours(23, 59, 59, 999);

        return { fromDate: startOfToday, toDate: endOfToday };
    }

    const fromDate = new Date(from!);
    const toDate = new Date(to!);

    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
        return null;
    }

    if (fromDate > toDate) {
        return null;
    }

    return { fromDate, toDate };
}

async function syncSingleUser(params: {
    integrationId: string;
    provider: ProviderKey;
    userId: string;
    externalEmployeeId: string;
    config: Record<string, unknown>;
    fromDate: Date;
    toDate: Date;
    event?: string;
}): Promise<SyncResult> {
    const entries = await prisma.timeEntry.findMany({
        where: {
            userId: params.userId,
            date: {
                gte: params.fromDate,
                lte: params.toDate,
            },
        },
        include: { project: true },
        orderBy: { date: "asc" },
    });

    const syncEntries: SyncTimeEntry[] = entries.map((entry: typeof entries[number]) => ({
        date: new Date(entry.date).toISOString().split("T")[0],
        hours: Number(entry.hours),
        projectName: entry.project.name,
        projectId: entry.projectId,
        note: entry.note,
        externalEmployeeId: params.externalEmployeeId,
    }));

    const adapter = getAdapter(params.provider);
    const result = await withRetry(() =>
        adapter.syncTimeEntries(params.config as unknown as ProviderConfig, syncEntries)
    );

    await prisma.syncLog.create({
        data: {
            integrationId: params.integrationId,
            userId: params.userId,
            status: result.success ? "success" : result.entriesSynced > 0 ? "partial" : "error",
            message: params.event
                ? `Webhook (${params.event}): ${result.message ?? "completed"}`
                : `Webhook sync: ${result.message ?? "completed"}`,
            entriesSynced: result.entriesSynced,
        },
    });

    return result;
}

integrationWebhookRouter.post("/:integrationId/sync", async (req: Request, res: Response) => {
    try {
        const configuredSecret = process.env.FAUKE_WEBHOOK_SECRET;
        if (!configuredSecret) {
            res.status(503).json({ error: "Webhook receiver is not configured" });
            return;
        }

        const providedSecret = req.header("x-fauke-webhook-secret") ?? "";
        if (!timingSafeSecretMatch(providedSecret, configuredSecret)) {
            res.status(401).json({ error: "Invalid webhook secret" });
            return;
        }

        const integrationId = req.params.integrationId;
        const body = (req.body ?? {}) as WebhookSyncBody;

        const dateRange = parseDateRange(body.from, body.to);
        if (!dateRange) {
            res.status(400).json({ error: "Invalid date range. Provide both from/to in valid ISO date format." });
            return;
        }

        const integration = await prisma.integration.findUnique({
            where: { id: integrationId },
            include: {
                users: true,
            },
        });

        if (!integration || !integration.enabled) {
            res.status(404).json({ error: "Enabled integration not found" });
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

        let targetAssignments = (integration as any).users.filter(
            (assignment: any) => Boolean(assignment.externalId)
        );

        if (body.userId) {
            targetAssignments = targetAssignments.filter(
                (assignment: typeof targetAssignments[number]) => assignment.userId === body.userId
            );
        }

        if (body.externalEmployeeId) {
            targetAssignments = targetAssignments.filter(
                (assignment: typeof targetAssignments[number]) =>
                    assignment.externalId === body.externalEmployeeId
            );
        }

        if (targetAssignments.length === 0) {
            res.status(400).json({
                error: "No eligible user assignments found for webhook sync",
            });
            return;
        }

        const decryptedConfig = decryptConfig(integration.config);

        const perUserResults = [] as Array<{ userId: string; success: boolean; entriesSynced: number; message?: string }>;

        for (const assignment of targetAssignments) {
            const result = await syncSingleUser({
                integrationId: integration.id,
                provider: integration.provider as ProviderKey,
                userId: assignment.userId,
                externalEmployeeId: assignment.externalId!,
                config: decryptedConfig,
                fromDate: dateRange.fromDate,
                toDate: dateRange.toDate,
                event: body.event,
            });

            perUserResults.push({
                userId: assignment.userId,
                success: result.success,
                entriesSynced: result.entriesSynced,
                message: result.message,
            });
        }

        const totalEntriesSynced = perUserResults.reduce((sum, item) => sum + item.entriesSynced, 0);

        res.json({
            success: perUserResults.every((item) => item.success),
            integrationId: integration.id,
            usersProcessed: perUserResults.length,
            totalEntriesSynced,
            from: dateRange.fromDate.toISOString(),
            to: dateRange.toDate.toISOString(),
            results: perUserResults,
        });
    } catch (err) {
        console.error("Webhook sync failed:", err);
        res.status(500).json({ error: "Webhook sync failed" });
    }
});
