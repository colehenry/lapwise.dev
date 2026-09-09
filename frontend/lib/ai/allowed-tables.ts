/** Read-only F1 relations exposed to Clutch's SQL validator. */
export const ALLOWED_AI_TABLES = [
  "drivers",
  "teams",
  "circuits",
  "sessions",
  "session_results",
  "laps",
  "weather_data",
  "track_status",
  "race_control_messages",
  "v_driver_standings",
  "v_constructor_standings",
] as const;
