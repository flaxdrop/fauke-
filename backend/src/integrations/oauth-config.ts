/**
 * OAuth 2.0 provider configuration.
 *
 * Maps provider keys to their OAuth endpoints, scopes, and common parameters.
 * Used by the OAuth routes to generate authorization URLs and exchange codes for tokens.
 */

import { ProviderKey } from "./types.js";

export interface OAuthProvider {
    key: ProviderKey;
    label: string;
    authorizationUrl: string;
    tokenUrl: string;
    redirectUri: string; // Will be set from env or inferred at runtime
    scopes: string[];
    scopeSeparator?: string; // Default: space
}

/**
 * OAuth provider configurations.
 * These are mock/standard URIs — real providers will have specific endpoints.
 */
export const OAUTH_PROVIDERS: Record<Extract<ProviderKey, "fortnox" | "visma">, OAuthProvider> = {
    fortnox: {
        key: "fortnox",
        label: "Fortnox",
        // Real Fortnox oauth endpoints in production
        authorizationUrl: "https://apps.fortnox.se/oauth-v2/authorize",
        tokenUrl: "https://apps.fortnox.se/oauth-v2/token",
        redirectUri: "", // Set at runtime
        scopes: ["timereports:read", "timereports:write", "employees:read"],
    },
    visma: {
        key: "visma",
        label: "Visma",
        // Real Visma oauth endpoints in production
        authorizationUrl: "https://api.visma.com/oauth2/authorize",
        tokenUrl: "https://api.visma.com/oauth2/token",
        redirectUri: "", // Set at runtime
        scopes: ["timereports:read", "timereports:write"],
        scopeSeparator: " ",
    },
};

/**
 * Generate a random state string for CSRF protection.
 * Used in OAuth authorization flow.
 */
export function generateOAuthState(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

/**
 * Get the OAuth provider config for a given provider key.
 * Throws if provider is not OAuth-based.
 */
export function getOAuthProvider(provider: ProviderKey, baseUrl: string): OAuthProvider {
    const config = OAUTH_PROVIDERS[provider as Extract<ProviderKey, "fortnox" | "visma">];
    if (!config) {
        throw new Error(`OAuth not supported for provider: ${provider}. Only fortnox and visma support OAuth.`);
    }
    return {
        ...config,
        redirectUri: `${baseUrl}/api/integrations/oauth/callback/${provider}`,
    };
}

/**
 * Format scopes for an OAuth authorization URL.
 * By default, scopes are space-separated (OAuth 2.0 standard),
 * but some providers might use different separators.
 */
export function formatScopes(provider: ProviderKey, scopes: string[]): string {
    const config = OAUTH_PROVIDERS[provider as Extract<ProviderKey, "fortnox" | "visma">];
    if (!config) return scopes.join(" ");
    const separator = config.scopeSeparator || " ";
    return scopes.join(separator);
}

/**
 * Build an OAuth authorization URL for redirecting the user.
 * Includes client_id, redirect_uri, scope, and state for CSRF protection.
 */
export function buildAuthorizationUrl(
    provider: ProviderKey,
    clientId: string,
    redirectUri: string,
    state: string,
    additionalParams?: Record<string, string>
): string {
    const config = OAUTH_PROVIDERS[provider as Extract<ProviderKey, "fortnox" | "visma">];
    if (!config) throw new Error(`OAuth not supported for provider: ${provider}`);

    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: formatScopes(provider, config.scopes),
        state,
        ...additionalParams,
    });

    return `${config.authorizationUrl}?${params.toString()}`;
}
