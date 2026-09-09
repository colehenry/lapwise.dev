import { tool } from "ai";
import { z } from "zod";
import { executeAIParamQuery } from "./db";
import { loadRaceDynamics } from "./race-dynamics";

export const resolveSession = tool({
  description:
    "Resolve an F1 session from a year plus either round number or event/circuit text. Returns matching session IDs and metadata.",
  inputSchema: z.object({
    year: z.number().int().min(1950).max(2100),
    session_type: z
      .enum(["race", "sprint_race", "qualifying", "sprint_qualifying"])
      .default("race"),
    round: z.number().int().min(1).max(40).optional(),
    event_hint: z.string().max(200).optional(),
  }),
  execute: async ({ year, session_type, round, event_hint }) => {
    try {
      if (round) {
        const rows = await executeAIParamQuery(
          `SELECT s.id AS session_id, s.year, s.round, s.session_type, s.event_name,
                  s.date, c.name AS circuit_name, c.location, c.country
           FROM sessions s JOIN circuits c ON s.circuit_id = c.id
           WHERE s.year = $1 AND s.round = $2 AND s.session_type = $3
           ORDER BY s.date LIMIT 5`,
          [year, round, session_type],
        );
        return { rows, count: rows.length };
      }
      if (event_hint?.trim()) {
        const rows = await executeAIParamQuery(
          `SELECT s.id AS session_id, s.year, s.round, s.session_type, s.event_name,
                  s.date, c.name AS circuit_name, c.location, c.country
           FROM sessions s JOIN circuits c ON s.circuit_id = c.id
           WHERE s.year = $1 AND s.session_type = $2
             AND (s.event_name ILIKE $3 OR c.name ILIKE $3
               OR c.location ILIKE $3 OR c.country ILIKE $3)
           ORDER BY s.date LIMIT 10`,
          [year, session_type, `%${event_hint.trim()}%`],
        );
        if (rows.length > 0) return { rows, count: rows.length };
      }
      const rows = await executeAIParamQuery(
        `SELECT s.id AS session_id, s.year, s.round, s.session_type, s.event_name,
                s.date, c.name AS circuit_name, c.location, c.country
         FROM sessions s JOIN circuits c ON s.circuit_id = c.id
         WHERE s.year = $1 AND s.session_type = $2
         ORDER BY s.round LIMIT 40`,
        [year, session_type],
      );
      return {
        rows,
        count: rows.length,
        note: "No exact event hint match; returned season discovery rows.",
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Unknown error",
        rows: [],
        count: 0,
      };
    }
  },
});

export const getRaceDynamics = tool({
  description:
    "Return deterministic race evidence for a resolved race/sprint session: classification, leader timeline, laps led, position paths, stop laps, stints, neutralizations, and race control.",
  inputSchema: z.object({
    session_id: z.number().int().positive(),
    driver_codes: z.array(z.string().max(10)).max(10).optional(),
  }),
  execute: async ({ session_id, driver_codes }) => {
    try {
      return await loadRaceDynamics(session_id, driver_codes);
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});
