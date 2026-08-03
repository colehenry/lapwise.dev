import { queryOptions } from "@tanstack/react-query";
import {
  fetchAvailableReplays,
  fetchReplayData,
  fetchReplaySeasons,
  fetchReplayTrackGeometry,
} from "@/lib/api";

/**
 * Replay resources. The frame blob is several megabytes, so home and the
 * replay route must address it with one key: a visitor who loads the home
 * preview and then opens the replay downloads it once.
 */
export const replayKeys = {
  seasons: () => ["replay-seasons"] as const,
  available: (season: number) => ["replay-available", season] as const,
  data: (season: number, round: number) => ["replay", season, round] as const,
  track: (circuitId: number) => ["replay-track", circuitId] as const,
};

const LISTING_STALE_TIME = 5 * 60 * 1000;

export function replaySeasonsQuery() {
  return queryOptions({
    queryKey: replayKeys.seasons(),
    queryFn: fetchReplaySeasons,
    staleTime: LISTING_STALE_TIME,
  });
}

export function availableReplaysQuery(season: number | null) {
  return queryOptions({
    queryKey: replayKeys.available(season ?? 0),
    queryFn: () => fetchAvailableReplays(season as number),
    enabled: season !== null,
    staleTime: LISTING_STALE_TIME,
  });
}

export function replayDataQuery(season: number | null, round: number | null) {
  return queryOptions({
    queryKey: replayKeys.data(season ?? 0, round ?? 0),
    queryFn: () => fetchReplayData(season as number, round as number),
    enabled: season !== null && round !== null,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 30 * 60 * 1000,
  });
}

export function replayTrackQuery(circuitId: number) {
  return queryOptions({
    queryKey: replayKeys.track(circuitId),
    queryFn: () => fetchReplayTrackGeometry(circuitId),
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });
}
