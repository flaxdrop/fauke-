/**
 * OAuth flow routes for Fortnox and Visma.
 *
 * Handles:
 * - POST /authorize — Get authorization URL (integration must have clientId/clientSecret)
 * - GET /callback/:provider — Handle OAuth callback (exchange code for token)
 *
 * All OAuth tokens are encrypted and stored in Integration.config.
 */

import { Router } from "express";
import type { Request, Response } from "express";
import { prisma } from "../db.js";
import { authMiddleware, adminMiddleware } from "../auth.js";
import {
    getOAuthProvider,
    buildAuthorizationUrl,
    generateOAuthState,
    OAUTH_PROVIDERS,
} from "../integrations/oauth-config.js";
import { decryptConfig, encryptConfig } from "../integrations/config-crypto.js";
import { FortnoxConfig, VismaConfig, ProviderKey } from "../integrations/types.js";

export const oauthRouter = Router();

// Store state tokens in memory (in production, use Redis or database)
// Maps state → { integrationId, provider, expiresAt }
const stateStore = new Map<string, { integrationId: string; provider: ProviderKey; expiresAt: number }>();

// Cleanup expired states every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [state, data] of stateStore.entries()) {
        if (data.expiresAt < now) {
            stateStore.delete(state);
        }
    }
}, 5 * 60 * 1000);

/**
 * POST /api/integrations/oauth/authorize
 *
 * Generates an OAuth authorization URL for the given integration.
 * The admin clicks this URL to authorize the integration.
 *
 * Body: { integrationId: string }
 * Response: { authorizationUrl: string }
 */
oauthRouter.post("/authorize", authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
    try {
        const { integrationId } = req.body;

        if (!integrationId || typeof integrationId !== "string") {
            res.status(400).json({ error: "integrationId is required" });
            return;
        }

        // Fetch the integration
        const integration = await prisma.integration.findUnique({
            where: { id: integrationId },
        });

        if (!integration) {
            res.status(404).json({ error: "Integration not found" });
            return;
        }

        // Only oauth-based providers
        const provider = integration.provider as ProviderKey;
        if (!OAUTH_PROVIDERS[provider as Extract<ProviderKey, "fortnox" | "visma">]) {
            res.status(400).json({ error: `Provider ${provider} does not support OAuth` });
            return;
        }

        // Get config (clientId, clientSecret must be set)
        const config = decryptConfig(integration.config);
        if (!("clientId" in config) || !("clientSecret" in config)) {
            res.status(400).json({ error: "clientId and clientSecret must be configured first" });
            return;
        }

        // Generate state and store it
        const state = generateOAuthState();
        stateStore.set(state, {
            integrationId,
            provider,
            expiresAt: Date.now() + 15 * 60 * 1000, // Valid for 15 minutes
        });

        // Get base URL from request (for redirect_uri)
        const baseUrl = `${req.protocol}://${req.get("host")}`;
        const oauthProvider = getOAuthProvider(provider, baseUrl);

        // Build authorization URL
        const authorizationUrl = buildAuthorizationUrl(
            provider,
            config.clientId,
            oauthProvider.redirectUri,
            state
        );

        res.json({ authorizationUrl });
    } catch (err) {
        console.error("[OAuth] /authorize error:", err);
        res.status(500).json({ error: "Failed to generate authorization URL" });
    }
});

/**
 * GET /api/integrations/oauth/callback/:provider
 *
 * OAuth provider calls this endpoint with `code` and `state`.
 * We exchange the code for an access token and store it.
 *
 * Query params: code, state, error (if authorization failed)
 * Redirects back to admin panel on success or error.
 */
oauthRouter.get("/callback/:provider", async (req: Request, res: Response) => {
    try {
        const { provider } = req.params;
        const { code, state, error: oauthError } = req.query;

        // Validate provider
        if (!OAUTH_PROVIDERS[provider as Extract<ProviderKey, "fortnox" | "visma">]) {
            res.status(400).json({ error: "Invalid OAuth provider" });
            return;
        }

        // If user denied authorization
        if (oauthError) {
            const redirectUrl = `http://localhost:5173/admin?oauth_error=${encodeURIComponent(
                (oauthError as string) || "Unknown error"
            )}`;
            res.redirect(redirectUrl);
            return;
        }

        // Validate state
        if (!state || typeof state !== "string") {
            const redirectUrl = `http://localhost:5173/admin?oauth_error=${encodeURIComponent("Missing state parameter")}`;
            res.redirect(redirectUrl);
            return;
        }

        const stateData = stateStore.get(state);
        if (!stateData) {
            const redirectUrl = `http://localhost:5173/admin?oauth_error=${encodeURIComponent("Invalid or expired state")}`;
            res.redirect(redirectUrl);
            return;
        }

        stateStore.delete(state); // Consume state

        // Validate code
        if (!code || typeof code !== "string") {
            const redirectUrl = `http://localhost:5173/admin?oauth_error=${encodeURIComponent("Missing authorization code")}`;
            res.redirect(redirectUrl);
            return;
        }

        // Fetch the integration
        const integration = await prisma.integration.findUnique({
            where: { id: stateData.integrationId },
        });

        if (!integration) {
            const redirectUrl = `http://localhost:5173/admin?oauth_error=${encodeURIComponent("Integration not found")}`;
            res.redirect(redirectUrl);
            return;
        }

        // Get config
        const config = decryptConfig(integration.config);
        if (!("clientId" in config) || !("clientSecret" in config)) {
            const redirectUrl = `http://localhost:5173/admin?oauth_error=${encodeURIComponent(
                "Client credentials not configured"
            )}`;
            res.redirect(redirectUrl);
            return;
        }

        // Exchange code for token
        const baseUrl = `${req.protocol}://${req.get("host")}`;
        const oauthProvider = getOAuthProvider(stateData.provider, baseUrl);

        const tokenResponse = await fetch(oauthProvider.tokenUrl, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                grant_type: "authorization_code",
                code,
                client_id: config.clientId,
                client_secret: config.clientSecret,
                redirect_uri: oauthProvider.redirectUri,
            }).toString(),
        });

        if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            console.error("[OAuth] Token exchange failed:", errorText);
            const redirectUrl = `http://localhost:5173/admin?oauth_error=${encodeURIComponent(
                "Token exchange failed: " + errorText
            )}`;
            res.redirect(redirectUrl);
            return;
        }

        const tokenData = (await tokenResponse.json()) as Record<string, unknown>;

        // Extract tokens
        const accessToken = tokenData.access_token as string | undefined;
        const refreshToken = tokenData.refresh_token as string | undefined;

        if (!accessToken) {
            const redirectUrl = `http://localhost:5173/admin?oauth_error=${encodeURIComponent("No access token in response")}`;
            res.redirect(redirectUrl);
            return;
        }

        // Update integration config with new tokens
        const updatedConfig =
            stateData.provider === "fortnox"
                ? ({
                    ...config,
                    accessToken,
                    refreshToken: refreshToken || (config as FortnoxConfig).refreshToken,
                } as FortnoxConfig)
                : ({
                    ...config,
                    accessToken,
                    refreshToken: refreshToken || (config as VismaConfig).refreshToken,
                } as VismaConfig);

        await prisma.integration.update({
            where: { id: stateData.integrationId },
            data: {
                config: encryptConfig(updatedConfig),
            },
        });

        console.log(`[OAuth] Successfully authorized ${stateData.provider} integration (ID: ${stateData.integrationId})`);

        // Redirect back to admin panel with success
        const redirectUrl = `http://localhost:5173/admin?oauth_success=true&provider=${stateData.provider}&integrationId=${stateData.integrationId}`;
        res.redirect(redirectUrl);
    } catch (err) {
        console.error("[OAuth] /callback error:", err);
        const redirectUrl = `http://localhost:5173/admin?oauth_error=${encodeURIComponent("An unexpected error occurred")}`;
        res.redirect(redirectUrl);
    }
});

/**
 * POST /api/integrations/oauth/refresh
 *
 * Manually refresh an access token using the refresh token.
 * Can be called before a sync to ensure the token is fresh.
 *
 * Body: { integrationId: string }
 */
oauthRouter.post("/refresh", authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
    try {
        const { integrationId } = req.body;

        if (!integrationId || typeof integrationId !== "string") {
            res.status(400).json({ error: "integrationId is required" });
            return;
        }

        const integration = await prisma.integration.findUnique({
            where: { id: integrationId },
        });

        if (!integration) {
            res.status(404).json({ error: "Integration not found" });
            return;
        }

        const provider = integration.provider as ProviderKey;
        const config = decryptConfig(integration.config);

        if (!("refreshToken" in config) || !config.refreshToken) {
            res.status(400).json({ error: "No refresh token available" });
            return;
        }

        if (!("clientId" in config) || !("clientSecret" in config)) {
            res.status(400).json({ error: "Client credentials not configured" });
            return;
        }

        // Get OAuth provider config
        const baseUrl = `${req.protocol}://${req.get("host")}`;
        const oauthProvider = getOAuthProvider(provider, baseUrl);

        // Exchange refresh token for new access token
        const tokenResponse = await fetch(oauthProvider.tokenUrl, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                grant_type: "refresh_token",
                refresh_token: config.refreshToken,
                client_id: config.clientId,
                client_secret: config.clientSecret,
            }).toString(),
        });

        if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            console.error("[OAuth] Token refresh failed:", errorText);
            res.status(400).json({ error: `Token refresh failed: ${errorText}` });
            return;
        }

        const tokenData = (await tokenResponse.json()) as Record<string, unknown>;
        const newAccessToken = tokenData.access_token as string | undefined;
        const newRefreshToken = tokenData.refresh_token as string | undefined;

        if (!newAccessToken) {
            res.status(400).json({ error: "No access token in response" });
            return;
        }

        // Update config with new tokens
        const updatedConfig =
            provider === "fortnox"
                ? ({
                    ...config,
                    accessToken: newAccessToken,
                    refreshToken: newRefreshToken || (config as FortnoxConfig).refreshToken,
                } as FortnoxConfig)
                : ({
                    ...config,
                    accessToken: newAccessToken,
                    refreshToken: newRefreshToken || (config as VismaConfig).refreshToken,
                } as VismaConfig);

        await prisma.integration.update({
            where: { id: integrationId },
            data: { config: encryptConfig(updatedConfig) },
        });

        console.log(`[OAuth] Successfully refreshed token for ${provider} integration (ID: ${integrationId})`);

        res.json({
            success: true,
            message: "Token refreshed successfully",
        });
    } catch (err) {
        console.error("[OAuth] /refresh error:", err);
        res.status(500).json({ error: "Failed to refresh token" });
    }
});
