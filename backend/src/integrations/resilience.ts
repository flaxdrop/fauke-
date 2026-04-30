type OperationType = "test" | "sync";

interface RateLimitEntry {
    timestamps: number[];
}

const rateLimitStore = new Map<string, RateLimitEntry>();

function getRateLimitConfig() {
    return {
        windowMs: Number(process.env.FAUKE_INTEGRATION_RATE_LIMIT_WINDOW_MS ?? 60_000),
        testMax: Number(process.env.FAUKE_INTEGRATION_RATE_LIMIT_TEST_MAX ?? 10),
        syncMax: Number(process.env.FAUKE_INTEGRATION_RATE_LIMIT_SYNC_MAX ?? 5),
    };
}

function getMaxRequests(operation: OperationType) {
    const cfg = getRateLimitConfig();
    return operation === "test" ? cfg.testMax : cfg.syncMax;
}

export function checkRateLimit(integrationId: string, operation: OperationType): {
    allowed: boolean;
    retryAfterMs: number;
} {
    const cfg = getRateLimitConfig();
    const now = Date.now();
    const key = `${integrationId}:${operation}`;
    const maxRequests = getMaxRequests(operation);

    const existing = rateLimitStore.get(key) ?? { timestamps: [] };
    const valid = existing.timestamps.filter((ts) => now - ts < cfg.windowMs);

    if (valid.length >= maxRequests) {
        const oldestInWindow = valid[0];
        const retryAfterMs = Math.max(0, cfg.windowMs - (now - oldestInWindow));
        rateLimitStore.set(key, { timestamps: valid });
        return { allowed: false, retryAfterMs };
    }

    valid.push(now);
    rateLimitStore.set(key, { timestamps: valid });
    return { allowed: true, retryAfterMs: 0 };
}

function wait(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableErrorMessage(message?: string) {
    if (!message) return false;
    const value = message.toLowerCase();
    return (
        value.includes("timeout") ||
        value.includes("temporar") ||
        value.includes("network") ||
        value.includes("econn") ||
        value.includes("503") ||
        value.includes("502") ||
        value.includes("429")
    );
}

export async function withRetry<T>(fn: () => Promise<T>, options?: { retries?: number; initialDelayMs?: number }) {
    const retries = options?.retries ?? Number(process.env.FAUKE_INTEGRATION_RETRY_COUNT ?? 2);
    const initialDelayMs = options?.initialDelayMs ?? Number(process.env.FAUKE_INTEGRATION_RETRY_INITIAL_DELAY_MS ?? 300);

    let attempt = 0;
    while (true) {
        try {
            return await fn();
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            const isRetryable = isRetryableErrorMessage(message);

            if (!isRetryable || attempt >= retries) {
                throw error;
            }

            const backoff = initialDelayMs * Math.pow(2, attempt);
            await wait(backoff);
            attempt += 1;
        }
    }
}
