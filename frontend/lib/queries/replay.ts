import { queryOptions } from "@tanstack/react-query";
import {
  fetchAvailableReplays,
  fetchLatestReplayPreview,
  fetchReplayData,
  fetchReplaySeasons,
  fetchReplayTrackGeometry,
} from "@/lib/api";
import { hours, minutes } from "./durations";

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
  latestPreview: () => ["replay-preview-latest"] as const,
};

const LISTING_STALE_TIME = minutes(5);

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
    gcTime: minutes(30),
  });
}

/**
 * The home autoplay artifact. One request resolves the latest race and its
 * frames, so home does not chain seasons -> available -> data.
 */
export function latestReplayPreviewQuery() {
  return queryOptions({
    queryKey: replayKeys.latestPreview(),
    queryFn: fetchLatestReplayPreview,
    staleTime: hours(1),
    gcTime: minutes(30),
    retry: false,
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
