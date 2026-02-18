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
