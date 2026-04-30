import crypto from "crypto";

const ENCRYPTION_MARKER = "fauke.enc.v1";

type JsonRecord = Record<string, unknown>;

interface EncryptedEnvelope {
    __faukeEnc: string;
    iv: string;
    tag: string;
    data: string;
}

let warnedMissingKey = false;

function getEncryptionKey(): Buffer | null {
    const secret = process.env.FAUKE_CONFIG_ENCRYPTION_KEY?.trim();
    if (!secret) {
        if (!warnedMissingKey) {
            warnedMissingKey = true;
            console.warn("[Integrations] FAUKE_CONFIG_ENCRYPTION_KEY is not set. Config encryption is disabled.");
        }
        return null;
    }
    return crypto.createHash("sha256").update(secret).digest();
}

function isEncryptedEnvelope(value: unknown): value is EncryptedEnvelope {
    if (!value || typeof value !== "object") return false;
    const candidate = value as Partial<EncryptedEnvelope>;
    return (
        candidate.__faukeEnc === ENCRYPTION_MARKER &&
        typeof candidate.iv === "string" &&
        typeof candidate.tag === "string" &&
        typeof candidate.data === "string"
    );
}

export function encryptConfig(config: JsonRecord): JsonRecord {
    const key = getEncryptionKey();
    if (!key) {
        return config;
    }

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const plaintext = JSON.stringify(config);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();

    return {
        __faukeEnc: ENCRYPTION_MARKER,
        iv: iv.toString("base64"),
        tag: tag.toString("base64"),
        data: encrypted.toString("base64"),
    };
}

export function decryptConfig(config: unknown): JsonRecord {
    if (!isEncryptedEnvelope(config)) {
        return (config ?? {}) as JsonRecord;
    }

    const key = getEncryptionKey();
    if (!key) {
        throw new Error("Encrypted config found but FAUKE_CONFIG_ENCRYPTION_KEY is missing");
    }

    const iv = Buffer.from(config.iv, "base64");
    const tag = Buffer.from(config.tag, "base64");
    const payload = Buffer.from(config.data, "base64");

    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(payload), decipher.final()]).toString("utf8");

    const parsed = JSON.parse(decrypted);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Decrypted integration config has invalid format");
    }
    return parsed as JsonRecord;
}

export function maskConfig(config: JsonRecord): JsonRecord {
    const sensitiveKeys = ["clientSecret", "accessToken", "refreshToken", "apiToken", "token", "secret", "password"];
    const masked: JsonRecord = {};
    for (const [key, value] of Object.entries(config)) {
        if (sensitiveKeys.includes(key) && typeof value === "string" && value.length > 0) {
            masked[key] = `${value.slice(0, 4)}••••••••`;
        } else {
            masked[key] = value;
        }
    }
    return masked;
}

export function mergeMaskedSensitiveValues(incoming: JsonRecord, existing: JsonRecord): JsonRecord {
    const merged: JsonRecord = { ...incoming };
    for (const [key, value] of Object.entries(incoming)) {
        if (typeof value === "string" && value.includes("••••••••") && typeof existing[key] === "string") {
            merged[key] = existing[key];
        }
    }
    return merged;
}
