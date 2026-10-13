"use client";

import { useQuery } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { useDailyGamePlayer } from "@/hooks/useDailyGamePlayer";
import type { ConsoleReplay } from "@/lib/queries/consoleReplay";
import {
  consoleAvailabilityQuery,
  consoleReplayQuery,
} from "@/lib/queries/consoleReplay";
import { dailyGamesSummaryQuery } from "@/lib/queries/dailyGames";
import { headlinesQuery } from "@/lib/queries/headlines";
import { replayTrackQuery } from "@/lib/queries/replay";
import { roundSessionQuery } from "@/lib/queries/sessions";
import type { ReplayTrackResponse, RoundSummary } from "@/lib/types";

/** What a panel does with what it has: draw it, say it is empty, or retry. */
export type PanelState = "loading" | "ready" | "empty" | "error";

export type HomeConsoleData = {
  season: number | null;
  latest: RoundSummary | undefined;
  latestState: PanelState;
  /** The round that has lap data, which may be older than the latest result. */
  replayRound: number | null;
  /** True when the newest result has no telemetry yet. */
  walkedBack: boolean;
  replay: ConsoleReplay | undefined;
  replayState: PanelState;
  retryReplay: () => void;
  track: ReplayTrackResponse | null | undefined;
  classification: ReturnType<typeof useRoundClassification>;
  dailyGames: ReturnType<typeof useDailyGames>;
  headlines: ReturnType<typeof useHeadlines>;
};

function useRoundClassification(season: number | null, round: number | null) {
  const query = useQuery({
    ...roundSessionQuery(season ?? 0, round ?? 0, "race"),
    enabled: season !== null && round !== null,
  });
  return { data: query.data, state: resolve(query, query.data != null) };
}

function useDailyGames(playerId: string) {
  const query = useQuery(dailyGamesSummaryQuery(playerId));
  return { data: query.data, state: resolve(query, query.data != null) };
}

function useHeadlines(season: number | null) {
  const query = useQuery(headlinesQuery(season));
  return {
    data: query.data,
    state: resolve(query, (query.data?.headlines.length ?? 0) > 0),
  };
}

type QueryLike = { isPending: boolean; isError: boolean; fetchStatus: string };

function resolve(query: QueryLike, hasContent: boolean): PanelState {
  if (hasContent) return "ready";
  if (query.isError) return "error";
  if (query.isPending && query.fetchStatus !== "idle") return "loading";
  return "empty";
}

/**
 * Every query the console needs, and the two things derived from them: which
 * season is current, and which round actually has lap data to replay.
 */
export function useHomeConsole(): HomeConsoleData {
  const playerId = useDailyGamePlayer();
  const availability = useQuery(consoleAvailabilityQuery());
  const latest = availability.data?.latest ?? undefined;
  const season = availability.data?.season ?? null;
  const latestRound = latest?.round ?? null;
  const reference = availability.data?.replay ?? null;
  const replay = useQuery(consoleReplayQuery(reference));
  const replayRound = reference?.round ?? null;

  // Only an outline-only state needs the standalone endpoint. A playable
  // console carries its geometry, including when it walks back to an older race.
  const outlineCircuitId = latest?.circuit_id;
  const outline = useQuery({
    ...replayTrackQuery(outlineCircuitId ?? 0),
    enabled:
      availability.isSuccess && reference === null && outlineCircuitId != null,
  });

  const classification = useRoundClassification(season, latestRound);
  const dailyGames = useDailyGames(playerId);
  const headlines = useHeadlines(season);

  return {
    season,
    latest,
    latestState: resolve(availability, latest != null),
    replayRound,
    walkedBack: replayRound != null && replayRound !== latestRound,
    replay: replay.data ?? undefined,
    replayState:
      availability.data == null
        ? resolve(availability, false)
        : reference === null && outline.isError
          ? "error"
          : resolve(replay, replay.data != null),
    retryReplay: () => {
      void availability.refetch();
      if (reference) void replay.refetch();
      else if (outlineCircuitId != null) void outline.refetch();
    },
    track: replay.data ? replay.data.track : outline.data,
    classification,
    dailyGames,
    headlines,
  };
}

/** Below `md` the console is replaced rather than reflowed. */
const COMPACT_QUERY = "(max-width: 767px)";

function subscribeToWidth(onChange: () => void) {
  const query = window.matchMedia(COMPACT_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function useCompactViewport(): boolean {
  return useSyncExternalStore(
    subscribeToWidth,
    () => window.matchMedia(COMPACT_QUERY).matches,
    () => false,
  );
}
