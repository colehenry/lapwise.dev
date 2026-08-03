import type { ReplayPreviewArtifact } from "@/lib/replayPreviewArtifact";
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

function packI16Deltas(values: number[]): Uint8Array {
  const out = new Uint8Array(values.length * 2);
  const view = new DataView(out.buffer);
  let previous = 0;
  values.forEach((value, i) => {
    view.setInt16(i * 2, value - previous, true);
    previous = value;
  });
  return out;
}

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

/** The columnar autoplay artifact served by /api/replay/preview/latest. */
export const replayPreviewArtifact: ReplayPreviewArtifact = {
  version: 1,
  metadata: replayData.metadata,
  track: replayData.track,
  drivers: replayData.drivers,
  codes: ["VER"],
  x: { VER: packI16Deltas([0, 5]) },
  y: { VER: packI16Deltas([0, 0]) },
  lap: { VER: new Uint8Array([10, 11]) },
  sc: new Uint8Array([0, 0]),
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
  date: "2026-03-08",
  circuit_name: "Test Circuit",
  circuit_id: 1,
  track_length_km: 5.278,
  session_type: "race",
  podium: [],
};

export const seasonRounds: RoundSummary[] = [latestRound];

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
