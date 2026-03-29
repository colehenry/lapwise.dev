// Shared API type definitions — canonical source of truth for API response types

export interface DriverStanding {
  position: number;
  driver_code: string | null;
  driver_slug: string | null;
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
  logo_url: string | null;
  total_points: number;
}

export interface StandingsResponse {
  year: number;
  drivers: DriverStanding[];
  constructors: ConstructorStanding[];
}

export interface DriverQualifyingStanding {
  position: number;
  driver_code: string | null;
  driver_slug: string | null;
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
  logo_url: string | null;
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
  driver_code: string | null;
  driver_slug: string | null;
  country_code: string | null;
  team_name: string;
  team_color: string | null;
  headshot_url: string | null;
  fastest_lap: boolean;
  time_seconds: number | null;
}

export interface RoundSummary {
  round: number;
  event_name: string;
  date: string;
  circuit_name: string;
  circuit_id: number;
  circuit_location?: string | null;
  circuit_country?: string | null;
  track_length_km: number | null;
  session_type: string;
  podium: PodiumDriver[];
}

export interface DriverListItem {
  driver_code: string | null;
  driver_slug: string | null;
  full_name: string;
  country_code: string | null;
  headshot_url: string | null;
  total_wins: number;
  total_races: number;
  total_podiums: number;
  total_points: number;
  current_team: string | null;
  current_team_color: string | null;
  first_season: number | null;
  latest_season: number | null;
}

export interface DriverListResponse {
  drivers: DriverListItem[];
  total: number;
}

export interface ConstructorListItem {
  team_name: string;
  team_color: string | null;
  logo_url: string | null;
  total_wins: number;
  total_races: number;
  total_podiums: number;
  total_points: number;
  first_season: number | null;
  latest_season: number | null;
}

export interface ConstructorListResponse {
  constructors: ConstructorListItem[];
  total: number;
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
  driver_code: string | null;
  driver_slug: string | null;
  full_name: string;
  country_code: string | null;
};

export type TeamInfo = {
  name: string;
  team_color: string | null;
  logo_url: string | null;
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
  driver_code: string | null;
  driver_slug: string | null;
  full_name: string;
  team_color: string | null;
  final_position: number | null;
  laps: LapData[];
};

/** Stable identifier for a driver: driver_code if available, otherwise full_name */
export const driverKey = (driver: DriverLapTimes): string =>
  driver.driver_code ?? driver.full_name;

export type RaceControlEvent = {
  session_time_seconds: number;
  lap_number: number | null;
  category: string | null;
  message: string;
  flag: string | null;
  scope: string | null;
  driver_number: number | null;
};

export type LapTimesResponse = {
  year: number;
  round: number;
  event_name: string;
  total_laps: number | null;
  drivers: DriverLapTimes[];
  track_status_events: TrackStatusEvent[];
  race_control_events: RaceControlEvent[];
};

// Lap Time Distribution types (for ridge plot chart)
export type DistributionLap = {
  lap_number: number | null;
  lap_time_seconds: number;
  compound: string | null;
};

export type DriverLapDistribution = {
  driver_code: string | null;
  driver_slug: string | null;
  full_name: string;
  team_color: string | null;
  final_position: number | null;
  laps: DistributionLap[];
};

export type LapDistributionResponse = {
  year: number;
  round: number;
  event_name: string;
  drivers: DriverLapDistribution[];
};

export const distDriverKey = (driver: DriverLapDistribution): string =>
  driver.driver_code ?? driver.full_name;

// Graph mode types (used by history graphs)
export type GraphMode = "season" | "race";
export type DataMode = "position" | "points";

// Driver profile types
export interface DriverProfile {
  driver_code: string | null;
  driver_slug: string | null;
  full_name: string;
  driver_number: number | null;
  country_code: string | null;
  headshot_url: string | null;
  total_seasons: number;
  total_races: number;
  total_championships: number;
  total_wins: number;
  total_podiums: number;
  total_points: number;
  best_finish: number | null;
  current_team: string | null;
  current_team_color: string | null;
  latest_season: number | null;
}

export interface DriverRaceHistory {
  year: number;
  round: number;
  race_name: string;
  session_type: string;
  position: number | null;
  grid_position: number | null;
  points: number | null;
  team_name: string;
  team_color: string | null;
  status: string;
  fastest_lap: boolean;
}

export interface DriverRaceHistoryResponse {
  driver_code: string | null;
  driver_slug: string | null;
  full_name: string;
  races: DriverRaceHistory[];
  available_years: number[];
}

export interface DriverSeasonHistory {
  year: number;
  championship_position: number | null;
  total_points: number;
  team_name: string;
  team_color: string | null;
}

export interface DriverSeasonHistoryResponse {
  driver_code: string | null;
  driver_slug: string | null;
  full_name: string;
  seasons: DriverSeasonHistory[];
}

// Constructor profile types
export interface ConstructorProfile {
  team_name: string;
  team_color: string | null;
  logo_url: string | null;
  total_seasons: number;
  total_races: number;
  total_championships: number;
  total_wins: number;
  total_podiums: number;
  total_points: number;
  best_finish: number | null;
  latest_season: number | null;
}

export interface ConstructorRaceHistory {
  year: number;
  round: number;
  race_name: string;
  best_position: number | null;
  total_points: number;
  driver_1_name: string | null;
  driver_1_position: number | null;
  driver_1_status: string | null;
  driver_2_name: string | null;
  driver_2_position: number | null;
  driver_2_status: string | null;
}

export interface ConstructorRaceHistoryResponse {
  team_name: string;
  races: ConstructorRaceHistory[];
  available_years: number[];
}

export interface ConstructorSeasonHistory {
  year: number;
  championship_position: number | null;
  total_points: number;
  team_color: string | null;
}

export interface ConstructorSeasonHistoryResponse {
  team_name: string;
  seasons: ConstructorSeasonHistory[];
}

// Circuit detail types
export interface CircuitRaceResult {
  year: number;
  round: number;
  race_name: string;
  winner_name: string;
  winner_code: string | null;
  winner_slug: string | null;
  team_name: string;
  team_color: string | null;
}

export interface CircuitRaceHistoryResponse {
  circuit_id: number;
  circuit_name: string;
  races: CircuitRaceResult[];
}

export interface CircuitStatDriver {
  name: string;
  code: string | null;
  slug: string | null;
  count: number;
  color: string | null;
}

export interface CircuitStatisticsResponse {
  circuit_id: number;
  circuit_name: string;
  most_wins: CircuitStatDriver[];
  most_poles: CircuitStatDriver[];
  most_fastest_laps: CircuitStatDriver[];
  constructor_wins: CircuitStatDriver[];
}

export interface LapRecordEntry {
  time_seconds: number;
  driver_name: string;
  driver_code: string | null;
  driver_slug: string | null;
  team_name: string;
  team_color: string | null;
  year: number;
}

export interface CircuitLapRecordsResponse {
  circuit_id: number;
  circuit_name: string;
  fastest_race_lap: LapRecordEntry | null;
  fastest_qualifying_lap: LapRecordEntry | null;
}

export interface RecentRacePodiumEntry {
  position: number;
  driver_name: string;
  driver_code: string | null;
  driver_slug: string | null;
  team_name: string;
  team_color: string | null;
}

export interface CircuitRecentRaceResponse {
  circuit_id: number;
  circuit_name: string;
  year: number;
  round: number;
  event_name: string;
  date: string;
  podium: RecentRacePodiumEntry[];
  fastest_lap_driver: string | null;
  fastest_lap_time: number | null;
  avg_air_temp: number | null;
  avg_track_temp: number | null;
  had_rainfall: boolean | null;
}

export interface LapTimeTrendEntry {
  year: number;
  fastest_lap_seconds: number;
  driver_name: string;
  driver_code: string | null;
  team_color: string | null;
}

export interface CircuitLapTimeTrendResponse {
  circuit_id: number;
  circuit_name: string;
  trend: LapTimeTrendEntry[];
}

export interface CircuitWeatherProfileResponse {
  circuit_id: number;
  circuit_name: string;
  races_with_weather: number;
  avg_air_temp: number | null;
  avg_track_temp: number | null;
  avg_humidity: number | null;
  avg_wind_speed: number | null;
  wet_race_count: number;
  total_races_checked: number;
}

export interface CompoundUsageEntry {
  compound: string;
  total_laps: number;
  avg_stint_length: number | null;
  percentage: number;
}

export interface CircuitTyreStatsResponse {
  circuit_id: number;
  circuit_name: string;
  races_with_data: number;
  compounds: CompoundUsageEntry[];
}

// ─── Favorites Types ──────────────────────────────────────────────

export interface FavoriteDriver {
  driver_code: string | null;
  driver_slug: string | null;
  full_name: string;
  headshot_url: string | null;
  country_code: string | null;
}

export interface FavoriteTeam {
  team_name: string;
  team_color: string | null;
  logo_url: string | null;
}

export interface FavoriteCircuit {
  circuit_id: number;
  name: string;
  location: string;
  country: string;
}

// ─── Auth Types ────────────────────────────────────────────────────

export interface UserProfile {
  id: number;
  email: string;
  username: string;
  role: string;
  email_verified: boolean;
  is_active: boolean;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
  favorite_driver: FavoriteDriver | null;
  favorite_team: FavoriteTeam | null;
  favorite_circuit: FavoriteCircuit | null;
}

export interface UserPublicProfile {
  id: number;
  username: string;
  role: string;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
  favorite_driver: FavoriteDriver | null;
  favorite_team: FavoriteTeam | null;
  favorite_circuit: FavoriteCircuit | null;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: UserProfile;
}

export interface TokenRefreshResponse {
  access_token: string;
  token_type: string;
}

// ─── Admin Types ────────────────────────────────────────────────────

export interface AdminActivity {
  id: number;
  user_id: number | null;
  username: string | null;
  ip_address: string;
  user_agent: string | null;
  success: boolean;
  created_at: string;
}

export interface AdminDashboardStats {
  user_count: number;
  post_count: number;
  recent_activity: AdminActivity[];
}

export interface AdminUserListResponse {
  users: UserProfile[];
  total: number;
  page: number;
  size: number;
}

export interface DiscussionTag {
  id: number;
  name: string;
  slug: string;
  color: string;
  category: string | null;
}

export interface DiscussionAuthor {
  id: number;
  username: string;
  avatar_url: string | null;
  role: string;
}

export interface PostListItem {
  id: number;
  title: string;
  body: string;
  post_type: string;
  is_pinned: boolean;
  is_locked: boolean;
  vote_count: number;
  comment_count: number;
  author: DiscussionAuthor;
  tags: DiscussionTag[];
  user_voted: boolean;
  created_at: string;
}

export interface PostListResponse {
  posts: PostListItem[];
  next_cursor: string | null;
}

export interface PostResponse extends PostListItem {
  body: string;
  updated_at: string;
}

export interface CommentResponse {
  id: number;
  post_id: number;
  parent_comment_id: number | null;
  body: string;
  vote_count: number;
  author: DiscussionAuthor;
  user_voted: boolean;
  replies: CommentResponse[];
  created_at: string;
  updated_at: string;
}

export interface CommentListResponse {
  comments: CommentResponse[];
  next_cursor: string | null;
}

// ─── Replay Types ─────────────────────────────────────────────

export interface ReplayListItem {
  round: number;
  event_name: string;
  date: string;
  circuit_name: string;
  circuit_id: number;
  total_laps: number;
  total_duration_seconds: number;
  driver_count: number;
  compressed_size_bytes: number;
}

export interface ReplayListResponse {
  season: number;
  replays: ReplayListItem[];
}

export interface ReplaySeasonsResponse {
  seasons: number[];
}

/** Driver data per frame: [x, y, speed, gear, drs, compound_idx, tyre_life, lap, position] */
export type ReplayDriverFrame = [
  number, // x
  number, // y
  number, // speed
  number, // gear
  number, // drs (0 or 1)
  number, // compound_idx (0=SOFT, 1=MED, 2=HARD, 3=INTER, 4=WET)
  number, // tyre_life
  number, // lap
  number, // position
];

export interface ReplayFrame {
  t: number;
  lap: number;
  d: Record<string, ReplayDriverFrame>;
  sc: number; // 0=none, 1=SC, 2=VSC
  w?: ReplayWeather;
}

export interface ReplayWeather {
  air_temp: number;
  track_temp: number;
  humidity: number;
  wind_speed: number;
  rainfall: boolean;
}

export interface ReplayDriverInfo {
  color: string;
  full_name: string;
  number: number;
  headshot_url: string | null;
}

export interface ReplayRaceControlMessage {
  t: number;
  category: string | null;
  message: string;
  driver_number: number | null;
}

export interface ReplayMetadata {
  session_id: number;
  season: number;
  round: number;
  event_name: string;
  total_frames: number;
  fps: number;
  total_duration_seconds: number;
  total_laps: number;
}

export interface ReplayTrack {
  polyline: [number, number][];
  rotation_deg: number;
}

export interface ReplayData {
  metadata: ReplayMetadata;
  track: ReplayTrack;
  drivers: Record<string, ReplayDriverInfo>;
  frames: ReplayFrame[];
  race_control: ReplayRaceControlMessage[];
}
