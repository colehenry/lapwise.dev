import type { ArchiveCounts } from "@/lib/queries/archive";
import type { ConsoleReplay } from "@/lib/queries/consoleReplay";
import type { DailySummary } from "@/lib/queries/dailySummary";
import type { HeadlinesResponse } from "@/lib/queries/headlines";
import type {
  ChampionshipScoringInfo,
  ReplayData,
  ReplayListResponse,
  RoundSummary,
  StandingsResponse,
} from "@/lib/types";

function scoringInfo(): ChampionshipScoringInfo {
  return {
    kind: "provisional",
    short_label: "Provisional standings",
    explanation: null,
    source_url: null,
    comparison_mode: "none",
    has_discrepancy: false,
  };
}

/** Matches the hooks that derive the current season from the system clock. */
export const FIXTURE_SEASON = new Date().getFullYear();
export const FIXTURE_ROUND = 1;

export const replaySeasons = { seasons: [FIXTURE_SEASON] };

export const availableReplays: ReplayListResponse = {
  season: FIXTURE_SEASON,
  replays: [
    {
      round: FIXTURE_ROUND,
      event_name: "Test Grand Prix",
      date: "2026-03-08",
      circuit_name: "Test Circuit",
      circuit_id: 1,
      total_laps: 58,
      total_duration_seconds: 5400,
      driver_count: 20,
      compressed_size_bytes: 1024,
    },
  ],
};

export const replayData: ReplayData = {
  metadata: {
    session_id: 1,
    season: FIXTURE_SEASON,
    round: FIXTURE_ROUND,
    event_name: "Test Grand Prix",
    total_frames: 2,
    fps: 4,
    total_duration_seconds: 0.5,
    total_laps: 58,
    circuit_length_m: 5278,
  },
  track: {
    polyline: [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ],
    rotation_deg: 0,
    corners: [],
    drs_zones: [],
  },
  drivers: {
    VER: {
      color: "3671C6",
      full_name: "Max Verstappen",
      number: 1,
      headshot_url: null,
    },
  },
  frames: [
    {
      t: 0,
      lap: 10,
      d: { VER: [0, 0, 300, 8, 0, 0, 5, 10, 1, 100, 0] },
      sc: 0,
    },
    {
      t: 1,
      lap: 11,
      d: { VER: [5, 0, 305, 8, 0, 0, 6, 11, 1, 100, 0] },
      sc: 0,
    },
  ],
  race_control: [],
};

export const standings: StandingsResponse = {
  year: FIXTURE_SEASON,
  drivers: [
    {
      position: 1,
      driver_code: "VER",
      driver_slug: "max-verstappen",
      full_name: "Max Verstappen",
      country_code: "NED",
      team_name: "Red Bull Racing",
      team_color: "3671C6",
      total_points: 25,
      championship_points: 25,
      points_scored: 25,
      classification_status: "provisional",
      scoring_explanation: null,
      scoring_explanation_url: null,
      headshot_url: null,
      wins: 1,
      p2s: 0,
      p3s: 0,
      position_counts: { 1: 1 },
    },
  ],
  constructors: [
    {
      position: 1,
      team_name: "Red Bull Racing",
      constructor_slug: "red-bull",
      team_color: "3671C6",
      logo_url: null,
      total_points: 25,
      championship_points: 25,
      points_scored: 25,
      classification_status: "provisional",
      scoring_explanation: null,
      scoring_explanation_url: null,
      wins: 1,
      p2s: 0,
      p3s: 0,
      position_counts: { 1: 1 },
    },
  ],
  driver_scoring: scoringInfo(),
  constructor_scoring: scoringInfo(),
};

export const latestRound: RoundSummary = {
  round: FIXTURE_ROUND,
  event_name: "Test Grand Prix",
  date: `${FIXTURE_SEASON}-03-08`,
  circuit_name: "Test Circuit",
  circuit_id: 1,
  track_length_km: 5.278,
  session_type: "race",
  podium: [
    {
      full_name: "Max Verstappen",
      driver_code: "VER",
      driver_slug: "max-verstappen",
      country_code: "NED",
      team_name: "Red Bull Racing",
      team_color: "3671C6",
      headshot_url: null,
      fastest_lap: true,
      time_seconds: 5400.25,
    },
    {
      full_name: "Lewis Hamilton",
      driver_code: "HAM",
      driver_slug: "lewis-hamilton",
      country_code: "GBR",
      team_name: "Ferrari",
      team_color: "E8002D",
      headshot_url: null,
      fastest_lap: false,
      time_seconds: 3.857,
    },
  ],
};

export const seasonRounds: RoundSummary[] = [latestRound];

/** `/api/results/{season}` answers with the season wrapper, not a bare list. */
export const seasonRoundsResponse = {
  year: FIXTURE_SEASON,
  rounds: seasonRounds,
};

export const upcomingEvents: unknown[] = [];

export const circuits = {
  circuits: [
    {
      circuit_id: 1,
      circuit_name: "Test Circuit",
      country: "Testland",
      location: "Test City",
    },
  ],
};

/** Lap starts are the clock, so two of the four lap times are deliberately
 *  null: a payload that summed lap times would truncate this car at lap one. */
export const consoleReplay: ConsoleReplay = {
  event_name: "Fixture Grand Prix",
  circuit_id: 16,
  circuit_name: "Fixture Park",
  date: `${FIXTURE_SEASON}-09-06`,
  total_laps: 4,
  t0: 100,
  t_end: 500,
  lead_changes: 1,
  fastest_lap: { driver_code: "VER", seconds: 90.5, lap: 3 },
  skips: [[220, 300]],
  status: [{ from: 210, to: 300, code: "red", label: "Red flag" }],
  cars: [
    {
      driver_code: "VER",
      full_name: "Max Verstappen",
      team_name: "Red Bull Racing",
      team_color: "3671C6",
      headshot_url: null,
      final_position: 1,
      start: [100, 200, 300, 400],
      end: 500,
      laps: [
        {
          t: 100,
          c: "M",
          age: 1,
          s: [30, 35, 35],
          v: [300, 290, 320, 310],
          pos: 1,
          pit: 0,
          pb: 0,
        },
        {
          t: null,
          c: "M",
          age: 2,
          s: [null, null, null],
          v: [null, null, null, null],
          pos: 1,
          pit: 0,
          pb: 0,
        },
        {
          t: 90.5,
          c: "S",
          age: 1,
          s: [28, 32, 30.5],
          v: [305, 295, 325, 315],
          pos: 1,
          pit: 1,
          pb: 1,
        },
        {
          t: null,
          c: "S",
          age: 2,
          s: [null, null, null],
          v: [null, null, null, null],
          pos: 1,
          pit: 0,
          pb: 0,
        },
      ],
    },
    {
      driver_code: "HAM",
      full_name: "Lewis Hamilton",
      team_name: "Ferrari",
      team_color: "E8002D",
      headshot_url: null,
      final_position: 2,
      start: [102, 204, 306, 408],
      end: 505,
      laps: [
        {
          t: 102,
          c: "M",
          age: 1,
          s: [31, 35, 36],
          v: [298, 288, 318, 308],
          pos: 2,
          pit: 0,
          pb: 0,
        },
        {
          t: 102,
          c: "M",
          age: 2,
          s: [31, 35, 36],
          v: [298, 288, 318, 308],
          pos: 2,
          pit: 0,
          pb: 0,
        },
        {
          t: 102,
          c: "S",
          age: 1,
          s: [31, 35, 36],
          v: [298, 288, 318, 308],
          pos: 2,
          pit: 1,
          pb: 0,
        },
        {
          t: 97,
          c: "S",
          age: 2,
          s: [30, 34, 33],
          v: [299, 289, 319, 309],
          pos: 2,
          pit: 0,
          pb: 0,
        },
      ],
    },
  ],
  feed: [
    {
      t: 150,
      lap: 1,
      kind: "pit",
      text: "HAM pits from P2",
      driver_code: "HAM",
    },
    { t: 210, lap: 2, kind: "red", text: "Red flag", driver_code: null },
    { t: 320, lap: 3, kind: "lead", text: "VER leads", driver_code: "VER" },
    {
      t: 410,
      lap: 4,
      kind: "fast",
      text: "VER sets the fastest lap",
      driver_code: "VER",
    },
  ],
};

export const dailySummary: DailySummary = {
  number: 5,
  published_on: `${FIXTURE_SEASON}-09-08`,
  max_guesses: 12,
  rows: 3,
  columns: 3,
  play_count: null,
  perfect_rate: null,
  has_played: null,
  streak: null,
  last_seven: null,
};

export const archiveCounts: ArchiveCounts = {
  drivers: 806,
  constructors: 203,
  circuits: 74,
  races: 1162,
  first_season: 1950,
};

export const headlines: HeadlinesResponse = {
  season: FIXTURE_SEASON,
  round: 1,
  headlines: [
    {
      id: "championship.driver_gap",
      category: "championship",
      kicker: "The gap",
      text: "Verstappen leads Hamilton by 24 points",
      tokens: [
        { start: 0, end: 10, kind: "driver", code: "VER" },
        { start: 17, end: 25, kind: "driver", code: "HAM" },
      ],
      weight: 0.7,
      valid_until: { kind: "next_race", date: null },
      href: "/results",
    },
    {
      id: "streak.wins",
      category: "streak",
      kicker: "Streak",
      text: "Three wins in a row",
      tokens: [],
      weight: 0.6,
      valid_until: { kind: "next_race", date: null },
      href: null,
    },
    {
      id: "records.laps",
      category: "records",
      kicker: "Record",
      text: "Fastest lap of the weekend",
      tokens: [],
      weight: 0.5,
      valid_until: { kind: "season_end", date: null },
      href: null,
    },
    {
      id: "next_race.up_next",
      category: "next_race",
      kicker: "Next",
      text: "Fixture Grand Prix · in 3 days",
      tokens: [],
      weight: 1,
      valid_until: { kind: "next_race", date: null },
      href: "/results",
    },
  ],
};
