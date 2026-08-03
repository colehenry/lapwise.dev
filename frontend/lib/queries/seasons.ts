import { queryOptions } from "@tanstack/react-query";
import { apiHeaders, apiUrl, fetchSeasons } from "@/lib/api";
import type { RoundSummary } from "@/lib/types";
import { hours, minutes } from "./durations";

/**
 * Season and round metadata. Every route that needs the season list, the
 * latest round, or a season's rounds shares these keys, so one navigation
 * session issues one request per resource.
 */
export const seasonKeys = {
  all: () => ["seasons"] as const,
  latestRound: () => ["latest-round"] as const,
  rounds: (season: number) => ["rounds", season] as const,
  qualifyingRounds: (season: number) => ["qualifying-rounds", season] as const,
};

export type SeasonRoundsData = {
  year: number;
  rounds: RoundSummary[];
};

const METADATA_STALE_TIME = hours(1);

/** Server renders revalidate on this interval; browsers ignore `next`. */
const METADATA_REVALIDATE_SECONDS = 300;

async function getJson<T>(path: string, error: string): Promise<T> {
  const res = await fetch(apiUrl(path), {
    headers: apiHeaders(),
    next: { revalidate: METADATA_REVALIDATE_SECONDS },
  });
  if (!res.ok) throw new Error(error);
  return res.json();
}

export function seasonsQuery() {
  return queryOptions({
    queryKey: seasonKeys.all(),
    queryFn: fetchSeasons,
    staleTime: METADATA_STALE_TIME,
  });
}

export function latestSeason(seasons: number[] | undefined): number | null {
  return seasons && seasons.length > 0 ? Math.max(...seasons) : null;
}

export function latestRoundQuery() {
  return queryOptions({
    queryKey: seasonKeys.latestRound(),
    queryFn: () =>
      getJson<RoundSummary>(
        "/api/results/latest",
        "Failed to fetch latest race",
      ),
    staleTime: minutes(10),
    retry: 1,
  });
}

export type RoundsKind = "race" | "qualifying";

export function roundsQuery(season: number | null, kind: RoundsKind = "race") {
  const qualifying = kind === "qualifying";
  return queryOptions({
    queryKey: qualifying
      ? seasonKeys.qualifyingRounds(season ?? 0)
      : seasonKeys.rounds(season ?? 0),
    queryFn: () =>
      getJson<SeasonRoundsData>(
        qualifying
          ? `/api/results/${season}/qualifying`
          : `/api/results/${season}`,
        "Failed to fetch rounds",
      ),
    enabled: season !== null,
  });
}

export function seasonRoundsQuery(season: number | null) {
  return roundsQuery(season, "race");
}

export function qualifyingRoundsQuery(season: number | null) {
  return roundsQuery(season, "qualifying");
}

/** One entry per round, for selectors that list a season's races. */
export function selectUniqueRounds(data: SeasonRoundsData): RoundSummary[] {
  const seen = new Set<number>();
  return (data.rounds ?? []).filter((round) => {
    if (seen.has(round.round)) return false;
    seen.add(round.round);
    return true;
  });
}
