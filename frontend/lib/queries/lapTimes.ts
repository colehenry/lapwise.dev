import { queryOptions } from "@tanstack/react-query";
import { apiHeaders, apiUrl } from "@/lib/api";
import type { LapTimesResponse } from "@/lib/types";

export type LapSession =
  | { kind: "race" }
  | { kind: "sprint" }
  | { kind: "practice"; practiceNumber: 1 | 2 | 3 };

export type LapTimesParams = {
  season: number;
  round: number;
  session: LapSession;
};

/**
 * Lap times are the largest public response on a race weekend — roughly 480
 * KiB decoded for a modern race. The key names the exact endpoint, so every
 * chart on a page shares one request instead of one per chart.
 */
export const lapTimeKeys = {
  session: ({ season, round, session }: LapTimesParams) =>
    [
      "lap-times",
      season,
      round,
      session.kind,
      session.kind === "practice" ? session.practiceNumber : null,
    ] as const,
};

export function lapSessionPath(
  season: number,
  round: number,
  session: LapSession,
): string {
  if (session.kind === "sprint") {
    return `/api/results/${season}/${round}/sprint/lap-times`;
  }
  if (session.kind === "practice") {
    return `/api/results/${season}/${round}/practice/${session.practiceNumber}/lap-times`;
  }
  return `/api/results/${season}/${round}/lap-times`;
}

export function raceSession(isSprint = false): LapSession {
  return isSprint ? { kind: "sprint" } : { kind: "race" };
}

export function practiceSession(practiceNumber: 1 | 2 | 3): LapSession {
  return { kind: "practice", practiceNumber };
}

export function lapTimesQuery(params: LapTimesParams) {
  return queryOptions({
    queryKey: lapTimeKeys.session(params),
    queryFn: async (): Promise<LapTimesResponse | null> => {
      const res = await fetch(
        apiUrl(lapSessionPath(params.season, params.round, params.session)),
        { cache: "no-store", headers: apiHeaders() },
      );
      if (!res.ok) return null;
      return res.json();
    },
  });
}
