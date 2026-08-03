import { HydrationBoundary } from "@tanstack/react-query";
import { seasonRoundsQuery, seasonsQuery } from "@/lib/queries/seasons";
import { prefetchForHydration } from "@/lib/queries/server";
import { seasonStandingsQuery } from "@/lib/queries/standings";
import SeasonPageClient from "./SeasonPageClient";

/** Standings and the round list are the page's primary content, so they are
 * fetched on the server and hydrated under the same query keys. */
export default async function SeasonPage({
  params,
}: {
  params: Promise<{ season: string }>;
}) {
  const { season } = await params;
  const seasonYear = Number(season);
  const state = await prefetchForHydration(
    Number.isFinite(seasonYear)
      ? [
          seasonStandingsQuery(seasonYear),
          seasonRoundsQuery(seasonYear),
          seasonsQuery(),
        ]
      : [seasonsQuery()],
  );

  return (
    <HydrationBoundary state={state}>
      <SeasonPageClient />
    </HydrationBoundary>
  );
}
