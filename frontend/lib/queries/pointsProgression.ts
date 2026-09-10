import { queryOptions } from "@tanstack/react-query";
import { minutes } from "./durations";
import { getJson } from "./http";

export type ProgressionRound = {
  round: string;
  cumulative_points: number;
  position?: number | null;
  event_name: string | null;
};

export type DriverProgression = {
  driver_code: string | null;
  driver_slug: string | null;
  full_name: string;
  team_name?: string | null;
  team_color: string | null;
  final_position: number;
  progression: ProgressionRound[];
};

export const driverSeriesKey = (driver: DriverProgression) =>
  driver.driver_slug ?? driver.driver_code ?? driver.full_name;

export type ConstructorProgression = {
  team_name: string;
  team_color: string | null;
  final_position: number;
  progression: ProgressionRound[];
  all_positions?: number[][] | null;
};

export type ProgressionResponse = {
  year: number;
  type: "drivers" | "constructors";
  drivers?: DriverProgression[];
  constructors?: ConstructorProgression[];
};

export type ProgressionChartPoint = {
  round: string;
  event_name?: string | null;
  [key: string]: number | string | null | undefined;
};

export type ProgressionMode = "drivers" | "constructors";
export type ProgressionPointsType = "race" | "qualifying";

export const pointsProgressionKeys = {
  season: (
    season: number,
    mode: ProgressionMode,
    pointsType: ProgressionPointsType,
  ) => ["points-progression", season, mode, pointsType] as const,
};

/**
 * Cumulative points by round. The season chart and the Clutch band read the
 * same cache entry, so the argument and its picture come from one response.
 */
export function pointsProgressionQuery(
  season: number | null,
  mode: ProgressionMode = "drivers",
  pointsType: ProgressionPointsType = "race",
) {
  return queryOptions({
    queryKey: pointsProgressionKeys.season(season ?? 0, mode, pointsType),
    queryFn: () =>
      getJson<ProgressionResponse>(
        `/api/results/${season}/points-progression?mode=${mode}&points_type=${pointsType}`,
        "Failed to fetch points progression",
      ),
    enabled: season !== null,
    staleTime: minutes(10),
  });
}
