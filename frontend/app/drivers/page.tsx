import { HydrationBoundary } from "@tanstack/react-query";
import { driversQuery } from "@/lib/queries/archive";
import { seasonsQuery } from "@/lib/queries/seasons";
import { prefetchForHydration } from "@/lib/queries/server";
import DriversArchive from "./DriversArchive";

/** The listing is the page's primary content, so it is fetched on the server
 * and hydrated under the same query keys the client uses. */
export const revalidate = 300;

export default async function DriversPage() {
  const state = await prefetchForHydration([
    driversQuery(true),
    seasonsQuery(),
  ]);

  return (
    <HydrationBoundary state={state}>
      <DriversArchive />
    </HydrationBoundary>
  );
}
