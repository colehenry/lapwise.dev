/**
 * Auth Utilities
 *
 * In-memory access token storage and authenticated fetch wrapper.
 * Refresh token is stored in an httpOnly cookie (managed by the backend).
 */

import { apiHeaders, apiUrl } from "@/lib/api";

// In-memory token — NOT persisted to localStorage (security best practice)
let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function clearAccessToken(): void {
  accessToken = null;
}

/**
 * Whether a token refresh is currently in-flight.
 * If multiple requests get 401 simultaneously, only one refresh fires.
 */
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  try {
    const res = await fetch(apiUrl("/auth/refresh"), {
      method: "POST",
      credentials: "include", // sends the httpOnly refresh cookie
    });
    if (!res.ok) {
      clearAccessToken();
      return null;
    }
    const data = await res.json();
    setAccessToken(data.access_token);
    return data.access_token;
  } catch {
    clearAccessToken();
    return null;
  }
}

/**
 * Attempt to refresh, deduplicating concurrent calls.
 */
export async function silentRefresh(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = refreshAccessToken().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

/**
 * Fetch wrapper that adds Bearer auth and handles 401 auto-refresh.
 */
export async function fetchWithAuth(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(apiHeaders());
  const providedHeaders = new Headers(options.headers);
  for (const [key, value] of providedHeaders.entries()) {
    headers.set(key, value);
  }

  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });

  // If 401 and we had a token, try refreshing once
  if (res.status === 401 && accessToken) {
    const newToken = await silentRefresh();
    if (newToken) {
      headers.set("Authorization", `Bearer ${newToken}`);
      return fetch(url, {
        ...options,
        headers,
        credentials: "include",
      });
    }
  }

  return res;
}
