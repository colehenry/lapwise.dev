import { queryOptions } from "@tanstack/react-query";
import { hours } from "./durations";
import { getJsonOrNull } from "./http";

/** A non-green stretch of the session, on the replay clock. */
export type ConsoleStatusWindow = {
  from: number;
  to: number;
  code: string;
  label: string | null;
};

/** One lap. Keys are short because a payload carries a thousand of them. */
export type ConsoleLap = {
  /** Lap time in seconds; null where the record has none. */
  t: number | null;
  /** Compound initial. */
  c: string;
  /** Tyre life. */
  age: number | null;
  /** The three sector times. */
  s: (number | null)[];
  /** The four ingested speed traps: i1, i2, finish line, straight. */
  v: (number | null)[];
  pos: number | null;
  pit: number;
  pb: number;
};

export type ConsoleCar = {
  driver_code: string | null;
  full_name: string;
  team_name: string | null;
  team_color: string | null;
  headshot_url: string | null;
  final_position: number | null;
  /** `lap_start_time_seconds` per lap. This is the clock. */
  start: number[];
  end: number;
  laps: ConsoleLap[];
};

export type ConsoleFeedEvent = {
  t: number;
  lap: number;
  kind: string;
  text: string;
  driver_code: string | null;
};

export type ConsoleFastestLap = {
  driver_code: string | null;
  seconds: number;
  lap: number | null;
};

export type ConsoleReplay = {
  event_name: string;
  circuit_id: number;
  circuit_name: string;
  date: string;
  total_laps: number;
  t0: number;
  t_end: number;
  lead_changes: number;
  fastest_lap: ConsoleFastestLap | null;
  /** Windows in which no car starts a lap. Playback jumps them. */
  skips: number[][];
  status: ConsoleStatusWindow[];
  cars: ConsoleCar[];
  feed: ConsoleFeedEvent[];
};

/** Which round the walk-back settled on, and its replay. */
export type ConsoleReplayResult = {
  round: number;
  replay: ConsoleReplay;
};

export const consoleKeys = {
  replay: (season: number, latestRound: number) =>
    ["console-replay", season, latestRound] as const,
};

/** How far back the walk-back looks for a round that has lap data. */
export const WALK_BACK_ROUNDS = 4;

/** A finished race never changes. */
const REPLAY_STALE_TIME = hours(6);

/**
 * Results publish before telemetry, so the newest round often has no laps for
 * several days. Walk back from `latestRound` until a round answers, and report
 * which one it was. A 404 is the expected answer while ingest catches up.
 */
export function consoleReplayQuery(
  season: number | null,
  latestRound: number | null,
) {
  return queryOptions({
    queryKey: consoleKeys.replay(season ?? 0, latestRound ?? 0),
    queryFn: async (): Promise<ConsoleReplayResult | null> => {
      const start = latestRound as number;
      const floor = Math.max(1, start - WALK_BACK_ROUNDS);
      for (let round = start; round >= floor; round--) {
        const replay = await getJsonOrNull<ConsoleReplay>(
          `/api/replay/console/${season}/${round}`,
        );
        if (replay?.cars?.length) return { round, replay };
      }
      return null;
    },
    enabled: season !== null && latestRound !== null,
    staleTime: REPLAY_STALE_TIME,
    gcTime: REPLAY_STALE_TIME,
    retry: false,
  });
}
