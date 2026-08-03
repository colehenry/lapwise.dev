import { queryOptions } from "@tanstack/react-query";
import { fetchStandings } from "@/lib/api";
import type { StandingsResponse } from "@/lib/types";

/**
 * One key and one fetcher for a season's standings. The response carries both
 * official championship and on-track point semantics, so every consumer —
 * standings tables, entity colors, chart palettes — shares this cache entry
 * and derives what it needs with `select`.
 */
export const standingsKeys = {
  season: (season: number) => ["standings", season] as const,
};

export function currentStandingsSeason(): number {
  return new Date().getFullYear();
}

export function seasonStandingsQuery(season: number) {
  return queryOptions({
    queryKey: standingsKeys.season(season),
    queryFn: () => fetchStandings(season),
    staleTime: 1000 * 60 * 60,
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
