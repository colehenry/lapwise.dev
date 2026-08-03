import {
  type DehydratedState,
  dehydrate,
  QueryClient,
} from "@tanstack/react-query";

/** Any queryOptions object; the concrete generics differ per resource. */
// biome-ignore lint/suspicious/noExplicitAny: prefetching is type-agnostic here
type PrefetchableQuery = any;

/**
 * Prefetches critical route data on the server and returns it for hydration
 * under the same canonical keys the client uses, so the browser renders the
 * primary content without waiting for its own request.
 *
 * A failed prefetch is not an error: the client simply fetches as before, so
 * an API hiccup degrades to the previous behavior instead of failing the page.
 */
export async function prefetchForHydration(
  queries: PrefetchableQuery[],
): Promise<DehydratedState> {
  const queryClient = new QueryClient();

  await Promise.all(
    queries.map((options) =>
      queryClient.prefetchQuery(options).catch(() => undefined),
    ),
  );

  return dehydrate(queryClient);
}
