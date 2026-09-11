"use client";

import { useQuery } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { useDailyGamePlayer } from "@/hooks/useDailyGamePlayer";
import type { ConsoleReplay } from "@/lib/queries/consoleReplay";
import { consoleReplayQuery } from "@/lib/queries/consoleReplay";
import { dailyGamesSummaryQuery } from "@/lib/queries/dailyGames";
import { headlinesQuery } from "@/lib/queries/headlines";
import { replayTrackQuery } from "@/lib/queries/replay";
import { latestRoundQuery } from "@/lib/queries/seasons";
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
  if (query.isError) return "error";
  if (query.isPending) return "loading";
  return hasContent ? "ready" : "empty";
}

/**
 * Every query the console needs, and the two things derived from them: which
 * season is current, and which round actually has lap data to replay.
 */
export function useHomeConsole(): HomeConsoleData {
  const playerId = useDailyGamePlayer();
  const latest = useQuery(latestRoundQuery());
  const season = latest.data ? Number(latest.data.date.slice(0, 4)) : null;
  const latestRound = latest.data?.round ?? null;

  const replay = useQuery(consoleReplayQuery(season, latestRound));
  const replayRound = replay.data?.round ?? null;

  /* Falls back to the latest round's circuit only once the replay has settled
     without one, so a resolving walk-back does not fetch two circuits. */
  const circuitId = replay.isPending
    ? undefined
    : (replay.data?.replay.circuit_id ?? latest.data?.circuit_id);
  const track = useQuery({
    ...replayTrackQuery(circuitId ?? 0),
    enabled: circuitId != null,
  });

  const classification = useRoundClassification(season, latestRound);
  const dailyGames = useDailyGames(playerId);
  const headlines = useHeadlines(season);

  return {
    season,
    latest: latest.data,
    latestState: resolve(latest, latest.data != null),
    replayRound,
    walkedBack: replayRound != null && replayRound !== latestRound,
    replay: replay.data?.replay,
    replayState: resolve(replay, replay.data != null),
    retryReplay: () => {
      void replay.refetch();
    },
    track: track.data,
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
