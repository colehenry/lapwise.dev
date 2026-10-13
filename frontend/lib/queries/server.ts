import {
  type DehydratedState,
  dehydrate,
  QueryClient,
} from "@tanstack/react-query";

/** Any queryOptions object; the concrete generics differ per resource. */
// biome-ignore lint/suspicious/noExplicitAny: prefetching is type-agnostic here
type PrefetchableQuery = any;

type PrefetchPlan =
  | PrefetchableQuery[]
  | ((
      client: QueryClient,
      signal: AbortSignal,
    ) => Promise<PrefetchableQuery[]>);

/**
 * Prefetches critical route data on the server and returns it for hydration
 * under the same canonical keys the client uses, so the browser renders the
 * primary content without waiting for its own request.
 *
 * A failed prefetch is not an error: the client simply fetches as before, so
 * an API hiccup degrades to the previous behavior instead of failing the page.
 */
export async function prefetchForHydration(
  plan: PrefetchPlan,
  { timeoutMs }: { timeoutMs?: number } = {},
): Promise<DehydratedState> {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const controller = new AbortController();
  const timer =
    timeoutMs === undefined
      ? undefined
      : setTimeout(() => {
          controller.abort();
          void queryClient.cancelQueries();
        }, timeoutMs);

  try {
    const queries =
      typeof plan === "function"
        ? await plan(queryClient, controller.signal)
        : plan;
    if (!controller.signal.aborted) {
      await Promise.all(
        queries.map((options) => queryClient.prefetchQuery(options)),
      );
    }
    // Only successful queries are serialized. Failed or timed-out panels can
    // fetch normally in the browser, alongside any panels that already finished.
    return dehydrate(queryClient);
  } finally {
    clearTimeout(timer);
    queryClient.clear();
  }
}
