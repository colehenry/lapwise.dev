import { HydrationBoundary } from "@tanstack/react-query";
import { circuitsQuery } from "@/lib/queries/archive";
import { seasonsQuery } from "@/lib/queries/seasons";
import { prefetchForHydration } from "@/lib/queries/server";
import CircuitsArchive from "./CircuitsArchive";

/** The listing is the page's primary content, so it is fetched on the server
 * and hydrated under the same query keys the client uses. */
export const revalidate = 300;

export default async function CircuitsPage() {
  const state = await prefetchForHydration([circuitsQuery(), seasonsQuery()]);

  return (
    <HydrationBoundary state={state}>
      <CircuitsArchive />
    </HydrationBoundary>
  );
}
