/**
 * Integration Auto-Sync Scheduler
 *
 * Runs scheduled syncs for integrations with autoSyncEnabled=true.
 * Checks every hour to see if any integration is due for sync based on its autoSyncTime.
 */

import { prisma } from "../db.js";
import { getAdapter } from "./registry.js";
import { ProviderKey, ProviderConfig, SyncTimeEntry } from "./types.js";
import { decryptConfig } from "./config-crypto.js";
import { withRetry } from "./resilience.js";

interface ScheduledSyncJob {
    integrationId: string;
    integrationName: string;
    usersToSync: number;
    success: boolean;
    message: string;
    duration: number;
}

/**
 * Check if current time matches the target time (HH:mm format).
 * Returns true if current hour:minute matches the target time (within a 5-minute window).
 */
function isTimeToSync(targetTime: string): boolean {
    const now = new Date();
    const currentHour = now.getHours().toString().padStart(2, "0");
    const currentMinute = now.getMinutes().toString().padStart(2, "0");
    const currentTime = `${currentHour}:${currentMinute}`;

    // Allow a 5-minute window for the sync to kick in
    const targetDate = new Date();
    const [targetHour, targetMinute] = targetTime.split(":").map(Number);
    targetDate.setHours(targetHour, targetMinute, 0, 0);

    const timeDiffMs = Math.abs(now.getTime() - targetDate.getTime());
    return timeDiffMs < 5 * 60 * 1000; // 5 minutes
}

/**
 * Run sync for a single user in an integration.
 * Syncs time entries from the last 7 days.
 */
async function syncUserEntries(
    integrationId: string,
    userId: string,
    externalId: string,
    provider: string,
    decryptedConfig: Record<string, unknown>
): Promise<{ success: boolean; message: string }> {
    try {
        // Fetch entries from last 7 days
        const to = new Date();
        const from = new Date();
        from.setDate(from.getDate() - 7);

        const entries = await prisma.timeEntry.findMany({
            where: {
                userId,
                date: {
                    gte: from,
                    lte: to,
                },
            },
            include: { project: true },
            orderBy: { date: "asc" },
        });

        if (entries.length === 0) {
            return { success: true, message: "No entries to sync" };
        }

        const syncEntries: SyncTimeEntry[] = entries.map((e: typeof entries[number]) => ({
            date: new Date(e.date).toISOString().split("T")[0],
            hours: Number(e.hours),
            projectName: e.project.name,
            projectId: e.projectId,
            note: e.note,
            externalEmployeeId: externalId,
        }));

        // Execute sync via adapter
        const adapter = getAdapter(provider as ProviderKey);
        const result = await withRetry(() =>
            adapter.syncTimeEntries(decryptedConfig as unknown as ProviderConfig, syncEntries)
        );

        // Log result to SyncLog
        await prisma.syncLog.create({
            data: {
                integrationId,
                userId,
                status: result.success ? "success" : result.entriesSynced > 0 ? "partial" : "error",
                message: result.message || null,
                entriesSynced: result.entriesSynced,
            },
        });

        return {
            success: result.success,
            message: `${result.entriesSynced} entries synced`,
        };
    } catch (err) {
        console.error(`Auto-sync error for user ${userId} in integration ${integrationId}:`, err);
        return {
            success: false,
            message: err instanceof Error ? err.message : "Unknown error",
        };
    }
}

/**
 * Execute scheduled syncs for all enabled integrations.
 * Returns a list of completed jobs.
 */
export async function executeScheduledSyncs(): Promise<ScheduledSyncJob[]> {
    const jobs: ScheduledSyncJob[] = [];

    try {
        // Fetch all enabled autoSync integrations
        const integrations = await prisma.integration.findMany({
            where: {
                autoSyncEnabled: true,
                enabled: true,
            },
            include: {
                users: {
                    include: {
                        user: true,
                    },
                },
            },
        });

        for (const integration of integrations) {
            // Check if it's time to sync this integration
            if (!integration.autoSyncTime || !isTimeToSync(integration.autoSyncTime)) {
                continue;
            }

            const startTime = Date.now();
            let syncedCount = 0;
            let errorCount = 0;

            // Decrypt config once per integration
            const decryptedConfig = decryptConfig(integration.config);

            // Sync for each assigned user
            for (const userIntegration of integration.users) {
                if (!userIntegration.externalId) {
                    console.warn(
                        `Skipping user ${userIntegration.userId} in integration ${integration.id}: no external ID configured`
                    );
                    continue;
                }

                const result = await syncUserEntries(
                    integration.id,
                    userIntegration.userId,
                    userIntegration.externalId,
                    integration.provider,
                    decryptedConfig
                );

                if (result.success) {
                    syncedCount++;
                } else {
                    errorCount++;
                }
            }

            const duration = Date.now() - startTime;

            // Update lastSyncAt
            await prisma.integration.update({
                where: { id: integration.id },
                data: { lastSyncAt: new Date() },
            });

            jobs.push({
                integrationId: integration.id,
                integrationName: integration.name,
                usersToSync: integration.users.length,
                success: errorCount === 0,
                message: `Synced ${syncedCount}/${integration.users.length} users in ${duration}ms`,
                duration,
            });

            console.log(
                `[AutoSync] Completed sync for ${integration.name}: ${syncedCount}/${integration.users.length} success`
            );
        }
    } catch (err) {
        console.error("[AutoSync] Error during scheduled sync execution:", err);
    }

    return jobs;
}

/**
 * Start the auto-sync scheduler.
 * Checks every hour (or more frequently) for integrations that need to sync.
 */
export function startAutoSyncScheduler(): void {
    // Check every hour if any integrations need syncing
    const SCHEDULER_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

    setInterval(async () => {
        console.log("[AutoSync] Checking for scheduled syncs...");
        const jobs = await executeScheduledSyncs();

        if (jobs.length > 0) {
            console.log(
                `[AutoSync] Completed ${jobs.length} sync job(s):`,
                jobs.map((j) => j.integrationName)
            );
        }
    }, SCHEDULER_INTERVAL_MS);

    console.log("[AutoSync] Scheduler started (checks every 60 minutes)");
}
