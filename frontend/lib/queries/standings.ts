import { queryOptions } from "@tanstack/react-query";
import { fetchStandings } from "@/lib/api";
import type {
  QualifyingStandingsResponse,
  StandingsResponse,
} from "@/lib/types";
import { minutes } from "./durations";
import { getJson } from "./http";

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
const STANDINGS_STALE_TIME = minutes(5);

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
    queryFn: () =>
      getJson<QualifyingStandingsResponse>(
        `/api/results/${season}/qualifying-standings`,
        "Failed to fetch qualifying standings",
      ),
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

/**
 * Entities are keyed by both slug and legacy code/name. Profile routes
 * canonicalize to slugs and the AI analyst links that way, while older callers
 * still hold codes and team names.
 */
export function selectEntityColors(data: StandingsResponse): EntityColors {
  const driverColors = new Map<string, string>();
  const teamColors = new Map<string, string>();

  for (const driver of data.drivers ?? []) {
    if (!driver.team_color) continue;
    const color = `#${driver.team_color}`;

    if (driver.driver_code) driverColors.set(driver.driver_code, color);
    if (driver.driver_slug) driverColors.set(driver.driver_slug, color);
    if (driver.full_name) driverColors.set(driver.full_name, color);
  }

  for (const team of data.constructors ?? []) {
    if (!team.team_color) continue;
    const color = `#${team.team_color}`;

    if (team.team_name) teamColors.set(team.team_name, color);
    if (team.constructor_slug) teamColors.set(team.constructor_slug, color);
  }

  return { driverColors, teamColors };
}
