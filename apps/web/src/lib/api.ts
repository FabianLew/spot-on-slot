import { createApiClient, type ApiSchemas } from "@spot-on-slot/api-client";

// The access token lives only in memory (never in storage); the refresh cookie restores it after a reload.
let accessToken: string | null = null;
let refreshing: Promise<boolean> | null = null;
const sessionEndedListeners = new Set<() => void>();

export function setAccessToken(token: ApiSchemas["AccessTokenResponse"] | null) {
  accessToken = token?.accessToken ?? null;
}

/** Called when a refresh is rejected, e.g. the session was revoked on another device. */
export function onSessionEnded(listener: () => void) {
  sessionEndedListeners.add(listener);
  return () => {
    sessionEndedListeners.delete(listener);
  };
}

/**
 * Exchanges the refresh cookie for a new access token. Calls share one request: the refresh token
 * rotates, so a second request with the same cookie would look like token reuse and end the session.
 * Network failures are rethrown, so callers can tell "offline" from "signed out".
 */
export function refreshSession(): Promise<boolean> {
  refreshing ??= (async () => {
    const { data, response } = await api.POST("/api/v1/auth/refresh");
    if (response.ok && data) {
      setAccessToken(data);
      return true;
    }
    setAccessToken(null);
    sessionEndedListeners.forEach((listener) => listener());
    return false;
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

export const api = createApiClient({
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080",
  getLocale: () => (typeof document !== "undefined" ? document.documentElement.lang || undefined : undefined),
  getAccessToken: () => accessToken,
  onUnauthorized: () => refreshSession().catch(() => false),
});
