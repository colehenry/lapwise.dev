import { apiHeaders, apiUrl } from "@/lib/api";

/**
 * Pick by whether absence is valid: `getJson` when a failed request
 * is a query error worth surfacing, `getJsonOrNull` when absence is a valid
 * state the UI renders. Only 404 means absence; outages and access failures
 * must reach the query's error state.
 */

/** Next's fetch extension; ignored by the browser, honoured when server-rendered. */
type NextFetchInit = RequestInit & { next?: { revalidate?: number } };

/** How long a server-rendered page may serve a cached list before revalidating. */
export const DEFAULT_REVALIDATE_SECONDS = 300;

export type RequestOptions = {
  /** Server-render revalidate window. Omit for request-time freshness. */
  revalidate?: number;
  /** Set `"no-store"` for data that must never be reused across requests. */
  cache?: RequestCache;
  /** Shared server prefetch deadline; omitted for ordinary browser requests. */
  signal?: AbortSignal;
};

function init({
  revalidate,
  cache,
  signal,
}: RequestOptions = {}): NextFetchInit {
  const base: NextFetchInit = { headers: apiHeaders() };
  if (cache) base.cache = cache;
  if (signal) base.signal = signal;
  if (revalidate !== undefined) base.next = { revalidate };
  return base;
}

/** A missing resource is handled by the caller; other HTTP failures are errors. */
export function assertResponseOk(response: Response): void {
  if (!response.ok) {
    throw new Error(`Request failed (HTTP ${response.status})`);
  }
}

export async function getJson<T>(
  path: string,
  error: string,
  options?: RequestOptions,
): Promise<T> {
  const res = await fetch(apiUrl(path), init(options));
  if (!res.ok) throw new Error(error);
  return res.json();
}

export async function getJsonOrNull<T>(
  path: string,
  options?: RequestOptions,
): Promise<T | null> {
  const res = await fetch(apiUrl(path), init(options));
  if (res.status === 404) return null;
  assertResponseOk(res);
  return res.json();
}
