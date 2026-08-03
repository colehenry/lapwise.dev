import { queryOptions } from "@tanstack/react-query";
import { apiHeaders, apiUrl, fetchStandings } from "@/lib/api";
import type {
  QualifyingStandingsResponse,
  StandingsResponse,
} from "@/lib/types";

/**
 * One key and one fetcher for a season's standings. The response carries both
 * official championship and on-track point semantics, so every consumer —
 * standings tables, entity colors, chart palettes — shares this cache entry
 * and derives what it needs with `select`.
 */
export const standingsKeys = {
  season: (season: number) => ["standings", season] as const,
  qualifying: (season: number) => ["qualifying-standings", season] as const,
};

/** Short enough to follow a live race weekend, long enough to deduplicate. */
const STANDINGS_STALE_TIME = 1000 * 60 * 5;

export function currentStandingsSeason(): number {
  return new Date().getFullYear();
}

export function seasonStandingsQuery(season: number) {
  return queryOptions({
    queryKey: standingsKeys.season(season),
    queryFn: () => fetchStandings(season),
    staleTime: STANDINGS_STALE_TIME,
  });
}

export function qualifyingStandingsQuery(season: number) {
  return queryOptions({
    queryKey: standingsKeys.qualifying(season),
    queryFn: async (): Promise<QualifyingStandingsResponse> => {
      const res = await fetch(
        apiUrl(`/api/results/${season}/qualifying-standings`),
        { headers: apiHeaders() },
      );
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      return res.json();
    },
    staleTime: STANDINGS_STALE_TIME,
  });
}

export type EntityColors = {
  driverColors: Map<string, string>;
  teamColors: Map<string, string>;
};

export const EMPTY_ENTITY_COLORS: EntityColors = {
  driverColors: new Map(),
  teamColors: new Map(),
};

export function selectEntityColors(data: StandingsResponse): EntityColors {
  const driverColors = new Map<string, string>();
  const teamColors = new Map<string, string>();

  for (const driver of data.drivers ?? []) {
    if (driver.driver_code && driver.team_color) {
      driverColors.set(driver.driver_code, `#${driver.team_color}`);
    }
  }

  for (const team of data.constructors ?? []) {
    if (team.team_name && team.team_color) {
      teamColors.set(team.team_name, `#${team.team_color}`);
    }
  }

  return { driverColors, teamColors };
}
