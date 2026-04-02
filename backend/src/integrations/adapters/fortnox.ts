import {
    IntegrationAdapter,
    ProviderConfig,
    FortnoxConfig,
    SyncTimeEntry,
    SyncResult,
    TestResult,
} from "../types.js";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

function isFortnoxConfig(c: ProviderConfig): c is FortnoxConfig {
    return "clientId" in c && "clientSecret" in c && !("companyId" in c) && !("targetApi" in c);
}

function getBaseUrl() {
    return process.env.FORTNOX_API_BASE_URL?.trim() || "https://api.fortnox.se";
}

function buildHeaders(token: string): HeadersInit {
    return {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
    };
}

function mapEntryToFortnoxPayload(entry: SyncTimeEntry) {
    return {
        EmployeeId: entry.externalEmployeeId,
        Date: entry.date,
        Hours: entry.hours,
        ProjectId: entry.projectId,
        CostCenter: "",
        ActivityCode: "",
        Description: entry.note ?? undefined,
    };
}

async function parseErrorMessage(response: Response): Promise<string> {
    const text = await response.text().catch(() => "");
    if (!text) return `HTTP ${response.status}`;
    try {
        const parsed = JSON.parse(text) as Record<string, unknown>;
        if (typeof parsed.error === "string") return parsed.error;
        if (typeof parsed.message === "string") return parsed.message;
    } catch {
        // ignore json parse failure
    }
    return text;
}

export class FortnoxAdapter implements IntegrationAdapter {
    readonly provider = "fortnox" as const;
    private readonly fetchImpl: FetchLike;

    constructor(fetchImpl?: FetchLike) {
        this.fetchImpl = fetchImpl ?? (globalThis.fetch as FetchLike);
    }

    async testConnection(config: ProviderConfig): Promise<TestResult> {
        if (!isFortnoxConfig(config)) {
            return { success: false, message: "Invalid Fortnox configuration" };
        }
        if (!config.clientId || !config.clientSecret) {
            return { success: false, message: "Client ID and Client Secret are required" };
        }
        if (!config.accessToken) {
            return { success: false, message: "No access token — user needs to re-authorize with Fortnox" };
        }

        const baseUrl = getBaseUrl();
        const url = `${baseUrl}/3/companyinformation`;

        const response = await this.fetchImpl(url, {
            method: "GET",
            headers: buildHeaders(config.accessToken),
        });

        if (!response.ok) {
            const details = await parseErrorMessage(response);
            return {
                success: false,
                message: `Fortnox connection failed (${response.status}): ${details}`,
            };
        }

        return {
            success: true,
            message: "Connected to Fortnox. Access token is valid.",
        };
    }

    async syncTimeEntries(config: ProviderConfig, entries: SyncTimeEntry[]): Promise<SyncResult> {
        if (!isFortnoxConfig(config)) {
            return { success: false, entriesSynced: 0, message: "Invalid Fortnox configuration" };
        }
        if (!config.accessToken) {
            return { success: false, entriesSynced: 0, message: "Missing access token" };
        }
        if (entries.length === 0) {
            return { success: true, entriesSynced: 0, message: "No entries to sync" };
        }

        const baseUrl = getBaseUrl();
        const endpoint = `${baseUrl}/3/timereportings`;

        const failedEntryIds: string[] = [];
        let synced = 0;

        for (const entry of entries) {
            const payload = mapEntryToFortnoxPayload(entry);
            const response = await this.fetchImpl(endpoint, {
                method: "POST",
                headers: buildHeaders(config.accessToken),
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                failedEntryIds.push(entry.projectId);
                continue;
            }

            synced += 1;
        }

        const allOk = failedEntryIds.length === 0;
        return {
            success: allOk,
            entriesSynced: synced,
            message: allOk
                ? `Synced ${synced} entries to Fortnox`
                : `Synced ${synced}/${entries.length} entries — ${failedEntryIds.length} failed`,
            failedEntryIds: failedEntryIds.length > 0 ? failedEntryIds : undefined,
        };
    }
}

export { mapEntryToFortnoxPayload };
