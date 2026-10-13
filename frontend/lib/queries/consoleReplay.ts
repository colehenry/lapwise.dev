import { queryOptions } from "@tanstack/react-query";
import type { ReplayTrackResponse, RoundSummary } from "@/lib/types";
import { hours, minutes } from "./durations";
import { getJson, getJsonOrNull, type RequestOptions } from "./http";

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
  track: ReplayTrackResponse | null;
};

/** The backend owns replay selection; the browser fetches only this reference. */
export type ConsoleReplayReference = {
  season: number;
  round: number;
  revision: string;
};

export type ConsoleAvailability = {
  season: number | null;
  latest: RoundSummary | null;
  replay: ConsoleReplayReference | null;
};

const CONSOLE_RESPONSE_VERSION = 3;
const DISCOVERY_STALE_TIME = minutes(1);
const REPLAY_STALE_TIME = hours(6);

export const consoleKeys = {
  availability: ["console-availability"] as const,
  replay: (reference: ConsoleReplayReference | null) =>
    ["console-replay", CONSOLE_RESPONSE_VERSION, reference] as const,
};

export function consoleAvailabilityQuery(options?: RequestOptions) {
  return queryOptions({
    queryKey: consoleKeys.availability,
    queryFn: () =>
      getJson<ConsoleAvailability>(
        "/api/replay/console/availability",
        "Could not check replay availability",
        options,
      ),
    staleTime: DISCOVERY_STALE_TIME,
    refetchInterval: DISCOVERY_STALE_TIME,
    refetchOnWindowFocus: true,
    retry: false,
  });
}

/** Completed payloads stay cached; missing outlines recheck while visible. */
export function consoleReplayQuery(
  reference: ConsoleReplayReference | null,
  options?: RequestOptions,
) {
  return queryOptions({
    queryKey: consoleKeys.replay(reference),
    queryFn: () =>
      getJsonOrNull<ConsoleReplay>(
        `/api/replay/console/${reference?.season}/${reference?.round}/v${CONSOLE_RESPONSE_VERSION}?revision=${reference?.revision}`,
        options,
      ),
    enabled: reference !== null,
    staleTime: (query) =>
      query.state.data?.track ? REPLAY_STALE_TIME : DISCOVERY_STALE_TIME,
    refetchInterval: (query) =>
      query.state.data?.track ? false : DISCOVERY_STALE_TIME,
    refetchOnWindowFocus: true,
    gcTime: REPLAY_STALE_TIME,
    retry: false,
  });
}
