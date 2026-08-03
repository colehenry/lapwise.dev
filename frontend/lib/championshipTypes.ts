export interface DriverStanding {
  position: number | null;
  driver_code: string | null;
  driver_slug: string | null;
  full_name: string;
  country_code: string | null;
  team_name: string;
  team_color: string | null;
  total_points: number;
  championship_points: number | null;
  points_scored: number;
  classification_status: ClassificationStatus;
  scoring_explanation: string | null;
  scoring_explanation_url: string | null;
  headshot_url: string | null;
  wins: number;
  p2s: number;
  p3s: number;
  position_counts: Record<string, number>;
}

export interface ConstructorStanding {
  position: number | null;
  team_name: string;
  constructor_slug: string | null;
  team_color: string | null;
  logo_url: string | null;
  total_points: number;
  championship_points: number | null;
  points_scored: number;
  classification_status: ClassificationStatus;
  scoring_explanation: string | null;
  scoring_explanation_url: string | null;
  wins: number;
  p2s: number;
  p3s: number;
  position_counts: Record<string, number>;
}

export type ClassificationStatus =
  | "classified"
  | "provisional"
  | "excluded"
  | "disqualified"
  | "not_classified";

export interface ChampionshipScoringInfo {
  kind: string;
  short_label: string | null;
  explanation: string | null;
  source_url: string | null;
  comparison_mode: "comparison" | "note_only" | "none";
  has_discrepancy: boolean;
}

export interface StandingsResponse {
  year: number;
  drivers: DriverStanding[];
  constructors: ConstructorStanding[];
  driver_scoring: ChampionshipScoringInfo;
  constructor_scoring: ChampionshipScoringInfo;
}
