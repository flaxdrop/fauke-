import {
    IntegrationAdapter,
    ProviderConfig,
    PEAccountingConfig,
    SyncTimeEntry,
    SyncResult,
    TestResult,
} from "../types.js";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

function isPEConfig(c: ProviderConfig): c is PEAccountingConfig {
    return "apiToken" in c && "companyId" in c;
}

function getBaseUrl() {
    return process.env.PE_ACCOUNTING_API_BASE_URL?.trim() || "https://api.peaccounting.se";
}

function getCompanyTestPath(companyId: string) {
    const tmpl = process.env.PE_ACCOUNTING_COMPANY_TEST_PATH?.trim() || "/api/v1/company/{companyId}";
    return tmpl.replace("{companyId}", encodeURIComponent(companyId));
}

function getTimeRegistrationPath(companyId: string) {
    const tmpl = process.env.PE_ACCOUNTING_TIME_REGISTRATION_PATH?.trim() || "/api/v1/company/{companyId}/timeregistration";
    return tmpl.replace("{companyId}", encodeURIComponent(companyId));
}

function xmlEscape(value: string) {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&apos;");
}

function buildHeaders(apiToken: string): HeadersInit {
    return {
        "X-Token": apiToken,
        "Content-Type": "application/xml",
        Accept: "application/xml, application/json, text/plain",
    };
}

function mapEntryToPEXml(entry: SyncTimeEntry): string {
    const comment = entry.note ?? "";
    return [
        "<timeregistration>",
        `  <user-id>${xmlEscape(entry.externalEmployeeId)}</user-id>`,
        `  <date>${xmlEscape(entry.date)}</date>`,
        `  <hours>${entry.hours}</hours>`,
        `  <project-id>${xmlEscape(entry.projectId)}</project-id>`,
        "  <activity-id></activity-id>",
        `  <comment>${xmlEscape(comment)}</comment>`,
        "  <invoiceable>true</invoiceable>",
        "</timeregistration>",
    ].join("\n");
}

async function parseErrorMessage(response: Response): Promise<string> {
    const text = await response.text().catch(() => "");
    if (!text) return `HTTP ${response.status}`;
    try {
        const parsed = JSON.parse(text) as Record<string, unknown>;
        if (typeof parsed.error === "string") return parsed.error;
        if (typeof parsed.message === "string") return parsed.message;
    } catch {
        // non-json response is expected for xml APIs
    }
    return text;
}

export class PEAccountingAdapter implements IntegrationAdapter {
    readonly provider = "pe_accounting" as const;
    private readonly fetchImpl: FetchLike;

    constructor(fetchImpl?: FetchLike) {
        this.fetchImpl = fetchImpl ?? (globalThis.fetch as FetchLike);
    }

    async testConnection(config: ProviderConfig): Promise<TestResult> {
        if (!isPEConfig(config)) {
            return { success: false, message: "Invalid PE Accounting configuration" };
        }
        if (!config.apiToken) {
            return { success: false, message: "API Token is required" };
        }
        if (!config.companyId) {
            return { success: false, message: "Company ID is required" };
        }

        const url = `${getBaseUrl()}${getCompanyTestPath(config.companyId)}`;
        const response = await this.fetchImpl(url, {
            method: "GET",
            headers: {
                "X-Token": config.apiToken,
                Accept: "application/json, application/xml, text/plain",
            },
        });

        if (!response.ok) {
            const details = await parseErrorMessage(response);
            return {
                success: false,
                message: `PE Accounting connection failed (${response.status}): ${details}`,
            };
        }

        return {
            success: true,
            message: `Connected to PE Accounting company ${config.companyId}. API token valid.`,
        };
    }

    async syncTimeEntries(config: ProviderConfig, entries: SyncTimeEntry[]): Promise<SyncResult> {
        if (!isPEConfig(config)) {
            return { success: false, entriesSynced: 0, message: "Invalid PE Accounting configuration" };
        }
        if (!config.apiToken) {
            return { success: false, entriesSynced: 0, message: "Missing API token" };
        }
        if (!config.companyId) {
            return { success: false, entriesSynced: 0, message: "Missing company ID" };
        }
        if (entries.length === 0) {
            return { success: true, entriesSynced: 0, message: "No entries to sync" };
        }

        const endpoint = `${getBaseUrl()}${getTimeRegistrationPath(config.companyId)}`;
        const failedEntryIds: string[] = [];
        let synced = 0;

        for (const entry of entries) {
            const xmlBody = mapEntryToPEXml(entry);
            const response = await this.fetchImpl(endpoint, {
                method: "POST",
                headers: buildHeaders(config.apiToken),
                body: xmlBody,
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
                ? `Synced ${synced} entries to PE Accounting`
                : `Synced ${synced}/${entries.length} entries — ${failedEntryIds.length} failed`,
            failedEntryIds: failedEntryIds.length > 0 ? failedEntryIds : undefined,
        };
    }
}

export { mapEntryToPEXml };
