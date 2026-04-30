import jwt from "jsonwebtoken";
import type { AuthPayload } from "./auth.js";

const MAGIC_LINK_SECRET = process.env.MAGIC_LINK_SECRET || process.env.JWT_SECRET || "fauke-dev-secret-change-in-production";
const MAGIC_LINK_EXPIRES_IN = "15m";

export interface MagicLinkPayload extends AuthPayload {
    purpose: "magic-link";
}

export function getAppBaseUrl(): string {
    return process.env.FAUKE_APP_BASE_URL?.trim() || "http://localhost:5174";
}

export function createMagicLinkToken(user: AuthPayload): string {
    const payload: MagicLinkPayload = {
        ...user,
        purpose: "magic-link",
    };

    return jwt.sign(payload, MAGIC_LINK_SECRET, { expiresIn: MAGIC_LINK_EXPIRES_IN });
}

export function verifyMagicLinkToken(token: string): AuthPayload {
    const payload = jwt.verify(token, MAGIC_LINK_SECRET) as MagicLinkPayload;

    if (payload.purpose !== "magic-link") {
        throw new Error("Invalid magic link token");
    }

    return {
        userId: payload.userId,
        username: payload.username,
        role: payload.role,
    };
}

export function buildMagicLinkUrl(token: string): string {
    const baseUrl = getAppBaseUrl();
    return `${baseUrl}/?magicToken=${encodeURIComponent(token)}`;
}
