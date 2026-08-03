import { queryOptions } from "@tanstack/react-query";
import { apiHeaders, apiUrl } from "@/lib/api";
import type {
  DriverRaceHistoryResponse,
  DriverSuperlativesResponse,
} from "@/lib/types";

export type QualifyingSectorRow = {
  driver_code: string | null;
  full_name: string;
  team_color: string | null;
  headshot_url: string | null;
  best_sector1: number | null;
  best_sector2: number | null;
  best_sector3: number | null;
  best_lap_time: number | null;
  q_session: string;
};

export type QualifyingSectorsResponse = {
  year: number;
  round: number;
  event_name: string;
  sectors: QualifyingSectorRow[];
};

/**
 * Per-entity resources that more than one panel reads. Sharing the fetcher —
 * not only the key — keeps the request shape identical between consumers.
 */
export const entityKeys = {
  driverSuperlatives: (driverCode: string, includeSprint: boolean) =>
    ["driver-superlatives", driverCode, includeSprint] as const,
  driverRaceHistory: (driverCode: string) =>
    ["driver-race-history", driverCode, "all"] as const,
  qualifyingSectors: (season: number, round: number) =>
    ["qualifying-sectors", season, round] as const,
};

async function getJson<T>(
  path: string,
  error: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(apiUrl(path), { headers: apiHeaders(), ...init });
  if (!res.ok) throw new Error(error);
  return res.json();
}

export function driverSuperlativesQuery(
  driverCode: string,
  includeSprint: boolean,
) {
  return queryOptions({
    queryKey: entityKeys.driverSuperlatives(driverCode, includeSprint),
    queryFn: () =>
      getJson<DriverSuperlativesResponse>(
        `/api/drivers/${driverCode}/superlatives${
          includeSprint ? "" : "?include_sprint=false"
        }`,
        "Failed to fetch superlatives",
      ),
  });
}

export function driverRaceHistoryQuery(driverCode: string) {
  return queryOptions({
    queryKey: entityKeys.driverRaceHistory(driverCode),
    queryFn: () =>
      getJson<DriverRaceHistoryResponse>(
        `/api/drivers/${driverCode}/race-history?all=true`,
        "Failed to fetch race history",
      ),
  });
}

export function qualifyingSectorsQuery(season: number, round: number) {
  return queryOptions({
    queryKey: entityKeys.qualifyingSectors(season, round),
    queryFn: async (): Promise<QualifyingSectorsResponse | null> => {
      const res = await fetch(
        apiUrl(`/api/results/${season}/${round}/qualifying/sectors`),
        { cache: "no-store", headers: apiHeaders() },
      );
      if (!res.ok) return null;
      return res.json();
    },
  });
}
