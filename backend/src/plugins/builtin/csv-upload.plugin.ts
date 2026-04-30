import {
    IFaukePlugin,
    PluginMetadata,
    ConfigField,
    PluginAction,
    PluginContext,
    ActionResult,
} from "../types.js";

interface ParsedRow {
    date: string;
    hours: number;
    projectName: string;
    note: string | null;
}

export class CsvUploadPlugin implements IFaukePlugin {
    readonly metadata: PluginMetadata = {
        id: "csv-upload",
        name: "CSV Upload",
        version: "1.0.0",
        author: "Fauke",
        description: "Parse and validate CSV time entries before import.",
        category: "import",
        icon: "📄",
        keywords: ["csv", "import", "timesheet"],
    };

    getConfigSchema(): ConfigField[] {
        return [
            {
                key: "csvContent",
                label: "CSV Content",
                type: "textarea",
                description: "Paste CSV rows (date,hours,projectName,note)",
                required: true,
            },
            {
                key: "delimiter",
                label: "Delimiter",
                type: "text",
                default: ",",
                required: false,
            },
            {
                key: "hasHeader",
                label: "First row is header",
                type: "checkbox",
                default: true,
                required: false,
            },
        ];
    }

    getActions(): PluginAction[] {
        return [
            {
                id: "preview_import",
                name: "Preview Import",
                description: "Validate CSV and show parsed rows",
            },
            {
                id: "simulate_import",
                name: "Simulate Import",
                description: "Run import simulation without writing to DB",
            },
        ];
    }

    async testConnection(context: PluginContext): Promise<ActionResult> {
        const parsed = this.parseCsv(context.config.csvContent, {
            delimiter: String(context.config.delimiter || ","),
            hasHeader: Boolean(context.config.hasHeader ?? true),
        });

        if (!parsed.success) {
            return parsed;
        }

        return {
            success: true,
            message: `CSV looks valid (${parsed.data.rows.length} row(s))`,
            data: parsed.data,
        };
    }

    async executeAction(actionId: string, context: PluginContext): Promise<ActionResult> {
        const parsed = this.parseCsv(context.config.csvContent, {
            delimiter: String(context.config.delimiter || ","),
            hasHeader: Boolean(context.config.hasHeader ?? true),
        });

        if (!parsed.success) {
            return parsed;
        }

        if (actionId === "preview_import") {
            return {
                success: true,
                message: `Parsed ${parsed.data.rows.length} row(s) successfully`,
                data: parsed.data,
            };
        }

        if (actionId === "simulate_import") {
            return {
                success: true,
                message: `Simulation complete: ${parsed.data.rows.length} row(s) ready to import`,
                data: {
                    rowsReady: parsed.data.rows.length,
                    sample: parsed.data.rows.slice(0, 5),
                },
            };
        }

        return { success: false, message: `Unknown action: ${actionId}` };
    }

    private parseCsv(
        csvContent: unknown,
        options: { delimiter: string; hasHeader: boolean }
    ): ActionResult & { data?: { rows: ParsedRow[]; columns: string[] } } {
        if (typeof csvContent !== "string" || csvContent.trim().length === 0) {
            return { success: false, message: "csvContent is required" };
        }

        const normalizedContent = this.normalizeCsvContent(csvContent);

        const lines = normalizedContent
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => line.length > 0);

        if (lines.length === 0) {
            return { success: false, message: "CSV is empty" };
        }

        const delimiter = this.resolveDelimiter(lines[0], options.delimiter);
        const hasActualHeader = options.hasHeader && this.looksLikeHeader(lines[0], delimiter);
        const startIndex = hasActualHeader ? 1 : 0;
        const headerColumns = hasActualHeader
            ? lines[0].split(delimiter).map((column) => column.trim())
            : ["date", "hours", "projectName", "note"];

        const rows: ParsedRow[] = [];
        for (let index = startIndex; index < lines.length; index++) {
            const cols = lines[index].split(delimiter).map((column) => column.trim());

            if (cols.length < 3) {
                return {
                    success: false,
                    message: `Invalid CSV row at line ${index + 1}. Expected at least 3 columns (date,hours,projectName).`,
                };
            }

            const hours = Number(cols[1]);
            if (!Number.isFinite(hours) || hours < 0) {
                return { success: false, message: `Invalid hours value at line ${index + 1}` };
            }

            rows.push({
                date: cols[0],
                hours,
                projectName: cols[2],
                note: cols[3] || null,
            });
        }

        return {
            success: true,
            data: {
                rows,
                columns: headerColumns,
            },
        };
    }

    private normalizeCsvContent(csvContent: string): string {
        let normalized = csvContent.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

        // Some users paste CSV copied from JSON where newlines are escaped ("\\n").
        if (!normalized.includes("\n") && normalized.includes("\\n")) {
            normalized = normalized.replace(/\\r?\\n/g, "\n");
        }

        return normalized;
    }

    private resolveDelimiter(firstLine: string, configuredDelimiter: string): string {
        if (firstLine.includes(configuredDelimiter)) {
            return configuredDelimiter;
        }

        const fallbacks = [";", "\t", ","];
        for (const candidate of fallbacks) {
            if (firstLine.includes(candidate)) {
                return candidate;
            }
        }

        return configuredDelimiter;
    }

    private looksLikeHeader(firstLine: string, delimiter: string): boolean {
        const columns = firstLine.split(delimiter).map((column) => column.trim().toLowerCase());
        const knownHeaderNames = ["date", "hours", "project", "projectname", "note", "notes"];

        const headerMatches = columns.filter((column) => knownHeaderNames.includes(column)).length;
        if (headerMatches >= 2) {
            return true;
        }

        // If first row looks like data (date + numeric hours), treat as data row.
        const firstColLooksLikeDate = /^\d{4}-\d{2}-\d{2}$/.test(columns[0] || "");
        const secondColIsNumber = Number.isFinite(Number(columns[1] || ""));
        if (firstColLooksLikeDate && secondColIsNumber) {
            return false;
        }

        return optionsDefaultHeaderFallback(columns);
    }
}

function optionsDefaultHeaderFallback(columns: string[]): boolean {
    // Conservative fallback: non-numeric second column usually indicates header.
    return !Number.isFinite(Number(columns[1] || ""));
}
