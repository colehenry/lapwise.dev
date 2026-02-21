// Shared API type definitions — canonical source of truth for API response types

export interface DriverStanding {
  position: number;
  driver_code: string;
  full_name: string;
  country_code: string | null;
  team_name: string;
  team_color: string | null;
  total_points: number;
  headshot_url: string | null;
}

export interface ConstructorStanding {
  position: number;
  team_name: string;
  team_color: string | null;
  total_points: number;
}

export interface StandingsResponse {
  year: number;
  drivers: DriverStanding[];
  constructors: ConstructorStanding[];
}

export interface DriverQualifyingStanding {
  position: number;
  driver_code: string;
  full_name: string;
  country_code: string | null;
  team_name: string;
  team_color: string | null;
  total_qualifying_points: number;
  headshot_url: string | null;
  poles: number;
  p2s: number;
  p3s: number;
}

export interface ConstructorQualifyingStanding {
  position: number;
  team_name: string;
  team_color: string | null;
  total_qualifying_points: number;
  poles: number;
  p2s: number;
  p3s: number;
}

export interface QualifyingStandingsResponse {
  year: number;
  drivers: DriverQualifyingStanding[];
  constructors: ConstructorQualifyingStanding[];
}

export interface PodiumDriver {
  full_name: string;
  driver_code: string;
  country_code: string | null;
  team_name: string;
  team_color: string | null;
  headshot_url: string | null;
  fastest_lap: boolean;
}

export interface RoundSummary {
  round: number;
  event_name: string;
  date: string;
  circuit_name: string;
  circuit_id: number;
  track_length_km: number | null;
  session_type: string;
  podium: PodiumDriver[];
}

export interface CircuitInfo {
  id: number;
  name: string;
  location: string;
  country: string;
  track_length_km: number | null;
  latitude: number | null;
  longitude: number | null;
  total_races: number;
  first_year: number;
  most_recent_year: number;
}

export type DriverInfo = {
  driver_number: number | null;
  driver_code: string;
  full_name: string;
  country_code: string | null;
};

export type TeamInfo = {
  name: string;
  team_color: string | null;
};

// Session-level circuit (subset of CircuitInfo, used by session results)
export type SessionCircuitInfo = {
  id: number;
  name: string;
  location: string;
  country: string;
  track_length_km: number | null;
  track_map_url: string | null;
};

// Session result detail (race/quali/sprint result row)
export type SessionResultDetail = {
  position: number | null;
  status: string;
  headshot_url: string | null;
  driver: DriverInfo;
  team: TeamInfo;
  grid_position: number | null;
  points: number | null;
  laps_completed: number | null;
  time_seconds: number | null;
  fastest_lap: boolean;
  q1_time_seconds: number | null;
  q2_time_seconds: number | null;
  q3_time_seconds: number | null;
};

// Session info (race weekend session metadata)
export type SessionInfo = {
  id: number;
  year: number;
  round: number;
  session_type: string;
  event_name: string;
  date: string;
  circuit: SessionCircuitInfo;
  highlights_video_id?: string | null;
};

// Full session results response
export type SessionResultsResponse = {
  session: SessionInfo;
  results: SessionResultDetail[];
};

// Lap data types (used by chart components)
export type LapData = {
  lap_number: number;
  lap_time_seconds: number | null;
  compound: string | null;
  tyre_life: number | null;
  stint: number | null;
  track_status: string | null;
  sector1_time_seconds: number | null;
  sector2_time_seconds: number | null;
  sector3_time_seconds: number | null;
  pit_in_time_seconds: number | null;
  pit_out_time_seconds: number | null;
  pit_duration_seconds: number | null;
  position: number | null;
  speed_st: number | null;
  speed_i1: number | null;
  speed_i2: number | null;
  speed_fl: number | null;
  fresh_tyre: boolean | null;
  is_personal_best: boolean | null;
  deleted: boolean | null;
};

export type TrackStatusEvent = {
  session_time_seconds: number;
  status: string;
  message: string | null;
};

export type DriverLapTimes = {
  driver_code: string;
  full_name: string;
  team_color: string | null;
  final_position: number | null;
  laps: LapData[];
};

export type LapTimesResponse = {
  year: number;
  round: number;
  event_name: string;
  total_laps: number | null;
  drivers: DriverLapTimes[];
  track_status_events: TrackStatusEvent[];
};

// Graph mode types (used by history graphs)
export type GraphMode = "season" | "race";
export type DataMode = "position" | "points";
