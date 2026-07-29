"use client";

import { useQuery } from "@tanstack/react-query";
import { apiHeaders, apiUrl } from "@/lib/api";
import type {
  LapTimesResponse,
  ReplayTrackResponse,
  RoundSummary,
  SeasonRoundsResponse,
  SessionResultsResponse,
  StandingsResponse,
} from "@/lib/types";

const HOUR = 1000 * 60 * 60;

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(apiUrl(path), { headers: apiHeaders() });
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  return res.json();
}

/** The newest classified result. Cheap, so it loads with the page. */
export function useLatestRound() {
  return useQuery<RoundSummary>({
    queryKey: ["home", "latest"],
    queryFn: () => getJson<RoundSummary>("/api/results/latest"),
    staleTime: 10 * 60 * 1000,
  });
}

export function useSeasonRounds(season: number | undefined) {
  return useQuery<SeasonRoundsResponse>({
    queryKey: ["home", "season", season],
    queryFn: () => getJson<SeasonRoundsResponse>(`/api/results/${season}`),
    enabled: typeof season === "number",
    staleTime: HOUR,
  });
}

export function useStandings(season: number | undefined) {
  return useQuery<StandingsResponse>({
    queryKey: ["home", "standings", season],
    queryFn: () =>
      getJson<StandingsResponse>(`/api/results/${season}/standings`),
    enabled: typeof season === "number",
    staleTime: HOUR,
  });
}

/**
 * Results are published before telemetry is ingested, so the newest round often
 * has no lap data for several days. Walk back from the latest round until a
 * round with laps turns up, and report which one the hero ended up replaying.
 */
export function useReplayableRace(
  season: number | undefined,
  latestRound: number | undefined,
) {
  return useQuery<{ round: number; lapTimes: LapTimesResponse } | null>({
    queryKey: ["home", "replayable", season, latestRound],
    enabled: typeof season === "number" && typeof latestRound === "number",
    staleTime: HOUR,
    queryFn: async () => {
      const start = latestRound as number;
      const floor = Math.max(1, start - 4);
      for (let round = start; round >= floor; round--) {
        try {
          const lapTimes = await getJson<LapTimesResponse>(
            `/api/results/${season}/${round}/lap-times`,
          );
          if (lapTimes.drivers?.some((d) => d.laps?.length)) {
            return { round, lapTimes };
          }
        } catch {
          // 404 here is expected while ingest catches up; keep walking back.
        }
      }
      return null;
    },
  });
}

/** Full classification for one round — grid slots, points and fastest lap. */
export function useRoundResults(
  season: number | undefined,
  round: number | undefined,
) {
  return useQuery<SessionResultsResponse>({
    queryKey: ["home", "round", season, round],
    queryFn: () =>
      getJson<SessionResultsResponse>(`/api/results/${season}/${round}`),
    enabled: typeof season === "number" && typeof round === "number",
    staleTime: HOUR,
  });
}

export function useTrackGeometry(circuitId: number | null | undefined) {
  return useQuery<ReplayTrackResponse>({
    queryKey: ["home", "track", circuitId],
    queryFn: () =>
      getJson<ReplayTrackResponse>(`/api/replay/track/${circuitId}`),
    enabled: typeof circuitId === "number",
    staleTime: HOUR * 24,
  });
}

export type UpcomingEvent = {
  event_name: string;
  event_type: string;
  event_date: string;
  location: string;
  country: string;
  round_number: number | null;
  circuit_id: number | null;
  circuit_name: string | null;
};

export function useUpcoming() {
  return useQuery<UpcomingEvent[]>({
    queryKey: ["home", "upcoming"],
    queryFn: () => getJson<UpcomingEvent[]>("/api/events/upcoming?limit=5"),
    staleTime: HOUR,
  });
}
