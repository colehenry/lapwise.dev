import { executeAIParamQuery } from "./db";
import {
  calculateRaceStrategyEvidence,
  type RaceStrategyEvidence,
} from "./race-strategy-calculation";

export const RACE_STRATEGY_LAPS_SQL = `
  SELECT l.lap_number, l.position, l.compound, l.tyre_life, l.stint,
         l.lap_time_seconds, l.lap_start_time_seconds, l.is_accurate,
         l.deleted, l.pit_in_time_seconds, l.pit_out_time_seconds,
         l.track_status, d.id AS driver_id, d.full_name, d.driver_code,
         sr.team_id, t.name AS team_name
  FROM laps l
  JOIN drivers d ON l.driver_id = d.id
  JOIN session_results sr
    ON sr.session_id = l.session_id AND sr.driver_id = l.driver_id
  JOIN teams t ON t.id = sr.team_id
  WHERE l.session_id = $1
  ORDER BY l.lap_number, l.position NULLS LAST
  LIMIT 2000
`;

export async function loadRaceStrategyEvidence(
  sessionId: number,
): Promise<RaceStrategyEvidence> {
  const laps = await executeAIParamQuery(RACE_STRATEGY_LAPS_SQL, [sessionId]);
  return calculateRaceStrategyEvidence({ sessionId, laps });
}
