export type ProgressionRound = {
  round: string;
  cumulative_points: number;
  position?: number | null;
  event_name: string | null;
};

export type DriverProgression = {
  driver_code: string | null;
  driver_slug: string | null;
  full_name: string;
  team_name?: string | null;
  team_color: string | null;
  final_position: number;
  progression: ProgressionRound[];
};

export const driverSeriesKey = (driver: DriverProgression) =>
  driver.driver_slug ?? driver.driver_code ?? driver.full_name;

export type ConstructorProgression = {
  team_name: string;
  team_color: string | null;
  final_position: number;
  progression: ProgressionRound[];
  all_positions?: number[][] | null;
};

export type ProgressionResponse = {
  year: number;
  type: "drivers" | "constructors";
  drivers?: DriverProgression[];
  constructors?: ConstructorProgression[];
};

export type ProgressionChartPoint = {
  round: string;
  event_name?: string | null;
  [key: string]: number | string | null | undefined;
};
