import { apiHeaders, apiUrl } from "@/lib/api";

/**
 * The two request shapes every query module in this folder needs. Both were
 * previously hand-written per module — three copies of the throwing one, five
 * of the nullable one — which is how their headers and error handling drifted.
 *
 * Pick by what a non-2xx means for the caller: `getJson` when a failed request
 * is a query error worth surfacing, `getJsonOrNull` when absence is a valid
 * state the UI renders (a session that was never held, a tab with no data).
 */

/** Next's fetch extension; ignored by the browser, honoured when server-rendered. */
type NextFetchInit = RequestInit & { next?: { revalidate?: number } };

/** How long a server-rendered page may serve a cached list before revalidating. */
export const DEFAULT_REVALIDATE_SECONDS = 300;

type RequestOptions = {
  /** Server-render revalidate window. Omit for request-time freshness. */
  revalidate?: number;
  /** Set `"no-store"` for data that must never be reused across requests. */
  cache?: RequestCache;
};

function init({ revalidate, cache }: RequestOptions = {}): NextFetchInit {
  const base: NextFetchInit = { headers: apiHeaders() };
  if (cache) base.cache = cache;
  if (revalidate !== undefined) base.next = { revalidate };
  return base;
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
  if (!res.ok) return null;
  return res.json();
}
