import { useState, useEffect, useCallback } from "react";
import * as api from "../api";

/**
 * Hook for OAuth authorization flows.
 * Handles authorization URL fetching, window management, and callback detection.
 */
export function useOAuth(onSuccess?: (provider: string, integrationId: string) => void) {
    const [authorizing, setAuthorizing] = useState<string | null>(null);
    const [oauthError, setOAuthError] = useState<string | null>(null);
    const [oauthSuccess, setOAuthSuccess] = useState<{ provider: string; integrationId: string } | null>(null);

    // Check for OAuth callback from URL parameters
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const error = params.get("oauth_error");
        const success = params.get("oauth_success");
        const provider = params.get("provider");
        const integrationId = params.get("integrationId");

        if (error) {
            setOAuthError(decodeURIComponent(error));
            // Clear query params
            window.history.replaceState({}, document.title, window.location.pathname);
        }

        if (success === "true" && provider && integrationId) {
            setOAuthSuccess({ provider, integrationId });
            onSuccess?.(provider, integrationId);
            // Clear query params
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }, [onSuccess]);

    const authorize = useCallback(
        async (integrationId: string) => {
            setAuthorizing(integrationId);
            setOAuthError(null);
            try {
                const { authorizationUrl } = await api.getOAuthAuthorizationUrl(integrationId);
                // Open in new window
                const width = 500;
                const height = 600;
                const left = window.screenX + (window.outerWidth - width) / 2;
                const top = window.screenY + (window.outerHeight - height) / 2;
                window.open(
                    authorizationUrl,
                    "fauke-oauth",
                    `width=${width},height=${height},left=${left},top=${top}`
                );
            } catch (err) {
                const message = err instanceof Error ? err.message : "Failed to authorize";
                setOAuthError(message);
            } finally {
                setAuthorizing(null);
            }
        },
        []
    );

    const clearMessages = useCallback(() => {
        setOAuthError(null);
        setOAuthSuccess(null);
    }, []);

    return {
        authorizing,
        oauthError,
        oauthSuccess,
        authorize,
        clearMessages,
    };
}
