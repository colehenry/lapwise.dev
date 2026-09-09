import { executeAIParamQuery } from "./db";
import {
  calculateRaceDynamics,
  type RaceDynamicsEvidence,
} from "./race-dynamics-calculation";

export const RACE_RESULTS_SQL = `
  SELECT sr.position, sr.grid_position, sr.points, sr.status, sr.time_seconds,
         sr.fastest_lap, d.id AS driver_id, d.full_name, d.driver_code,
         d.slug AS driver_slug, t.name AS team_name
  FROM session_results sr
  JOIN drivers d ON sr.driver_id = d.id
  JOIN teams t ON sr.team_id = t.id
  WHERE sr.session_id = $1
  ORDER BY sr.position NULLS LAST
  LIMIT 30
`;

export const RACE_LAPS_SQL = `
  SELECT l.lap_number, l.position, l.compound, l.stint, l.lap_time_seconds,
         l.is_accurate, l.deleted, l.pit_in_time_seconds,
         l.pit_out_time_seconds, l.track_status, d.id AS driver_id,
         d.full_name, d.driver_code
  FROM laps l
  JOIN drivers d ON l.driver_id = d.id
  WHERE l.session_id = $1
  ORDER BY l.lap_number, l.position NULLS LAST
  LIMIT 2000
`;

export const RACE_CONTROL_SQL = `
  SELECT lap_number, category, message, status, driver_number
  FROM race_control_messages
  WHERE session_id = $1
    AND (
      message ILIKE '%SAFETY CAR%' OR message ILIKE '%VSC%'
      OR message ILIKE '%PENALTY%' OR message ILIKE '%INVESTIGATION%'
      OR message ILIKE '%INCIDENT%' OR message ILIKE '%DRS%'
      OR message ILIKE '%RETIRED%' OR message ILIKE '%STOPPED%'
    )
  ORDER BY session_time_seconds
  LIMIT 40
`;

export async function loadRaceDynamics(
  sessionId: number,
  driverCodes?: string[],
): Promise<RaceDynamicsEvidence> {
  const [results, laps, raceControl] = await Promise.all([
    executeAIParamQuery(RACE_RESULTS_SQL, [sessionId]),
    executeAIParamQuery(RACE_LAPS_SQL, [sessionId]),
    executeAIParamQuery(RACE_CONTROL_SQL, [sessionId]),
  ]);
  return calculateRaceDynamics({
    sessionId,
    results,
    laps,
    raceControl,
    driverCodes,
  });
}
