/**
 * AI Tool Definitions
 *
 * Tools available to the AI agent for querying F1 data,
 * inspecting the schema, and generating chart configurations.
 */

import { tool } from "ai";
import { z } from "zod";
import { executeAIParamQuery, executeAIQuery } from "./db";

/**
 * Allowlist of F1 data tables the AI can query.
 * Auth/user tables are explicitly excluded.
 */
const ALLOWED_TABLES = [
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
];

/**
 * SQL keywords that indicate a write operation — blocked for safety.
 */
const BLOCKED_SQL_PATTERNS =
  /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|GRANT|REVOKE|CREATE|EXECUTE|COPY|CALL|MERGE|VACUUM|ANALYZE)\b/i;

const SQL_COMMENT_PATTERN = /(--|\/\*|\*\/)/;
const MAX_SQL_LENGTH = 4000;

/**
 * Tables that must never be queried by the AI agent.
 */
const RESTRICTED_TABLES = [
  "users",
  "refresh_tokens",
  "email_verification_tokens",
  "password_reset_tokens",
  "login_history",
  "posts",
  "comments",
  "votes",
  "tags",
  "post_tags",
  "ai_conversations",
  "ai_messages",
];

/**
 * Returns an error message if the SQL text references a restricted table.
 */
function checkRestrictedTables(
  sql: string,
): { valid: true } | { valid: false; error: string } {
  const lower = sql.toLowerCase();
  for (const table of RESTRICTED_TABLES) {
    if (new RegExp(`\\b${table}\\b`, "i").test(lower)) {
      return {
        valid: false,
        error: `Access to table '${table}' is not permitted. Only F1 data tables are queryable.`,
      };
    }
  }
  return { valid: true };
}

function normalizeTableName(raw: string): string {
  return raw.replaceAll('"', "").split(".").pop()?.toLowerCase() ?? "";
}

export function extractReferencedTables(sql: string): string[] {
  const tables = new Set<string>();
  const tableRefPattern =
    /\b(?:FROM|JOIN)\s+("?[a-zA-Z_][\w]*"?(?:\."?[a-zA-Z_][\w]*"?)?)/gi;

  for (const match of sql.matchAll(tableRefPattern)) {
    const table = normalizeTableName(match[1]);
    if (table) {
      tables.add(table);
    }
  }

  return [...tables];
}

function checkAllowedTables(
  sql: string,
): { valid: true } | { valid: false; error: string } {
  const referencedTables = extractReferencedTables(sql);
  for (const table of referencedTables) {
    if (!ALLOWED_TABLES.includes(table)) {
      return {
        valid: false,
        error: `Access to table '${table}' is not permitted. Allowed tables: ${ALLOWED_TABLES.join(", ")}`,
      };
    }
  }
  return { valid: true };
}

function hasUnsafeStatementBoundary(sql: string): boolean {
  const withoutTrailingSemicolon = sql.replace(/;\s*$/, "");
  return withoutTrailingSemicolon.includes(";");
}

/**
 * Validates a SQL query is read-only and safe to execute.
 */
export function validateSQL(sql: string): { valid: boolean; error?: string } {
  const trimmed = sql.trim();

  if (trimmed.length > MAX_SQL_LENGTH) {
    return {
      valid: false,
      error: `Query is too long. Maximum length is ${MAX_SQL_LENGTH} characters.`,
    };
  }

  if (!trimmed.toUpperCase().startsWith("SELECT")) {
    return { valid: false, error: "Only SELECT queries are allowed." };
  }

  if (
    hasUnsafeStatementBoundary(trimmed) ||
    SQL_COMMENT_PATTERN.test(trimmed)
  ) {
    return {
      valid: false,
      error: "Query contains unsafe SQL syntax.",
    };
  }

  if (BLOCKED_SQL_PATTERNS.test(trimmed)) {
    return {
      valid: false,
      error:
        "Query contains blocked keywords. Only read-only SELECT queries are permitted.",
    };
  }

  const tableCheck = checkRestrictedTables(trimmed);
  if (!tableCheck.valid) {
    return tableCheck;
  }

  const allowlistCheck = checkAllowedTables(trimmed);
  if (!allowlistCheck.valid) {
    return allowlistCheck;
  }

  return { valid: true };
}

/**
 * Caps query output even when the generated SQL already has a LIMIT.
 */
export function ensureLimit(sql: string, maxRows = 500): string {
  const cleaned = sql.replace(/;\s*$/, "");
  return `SELECT * FROM (${cleaned}) AS ai_limited_query LIMIT ${maxRows}`;
}

export function validateWhereClause(
  whereClause: string,
): { valid: true } | { valid: false; error: string } {
  if (
    whereClause.length > 1000 ||
    whereClause.includes(";") ||
    SQL_COMMENT_PATTERN.test(whereClause)
  ) {
    return { valid: false, error: "WHERE clause contains unsafe SQL syntax." };
  }

  if (
    BLOCKED_SQL_PATTERNS.test(whereClause) ||
    /\bUNION\b/i.test(whereClause)
  ) {
    return { valid: false, error: "WHERE clause contains blocked keywords." };
  }

  const tableCheck = checkRestrictedTables(whereClause);
  if (!tableCheck.valid) {
    return tableCheck;
  }

  const allowlistCheck = checkAllowedTables(whereClause);
  if (!allowlistCheck.valid) {
    return allowlistCheck;
  }

  return { valid: true };
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function compressNumberRanges(numbers: number[]): string[] {
  if (numbers.length === 0) {
    return [];
  }

  const ranges: string[] = [];
  let start = numbers[0];
  let previous = numbers[0];

  for (const number of numbers.slice(1)) {
    if (number === previous + 1) {
      previous = number;
      continue;
    }
    ranges.push(start === previous ? `L${start}` : `L${start}-${previous}`);
    start = number;
    previous = number;
  }

  ranges.push(start === previous ? `L${start}` : `L${start}-${previous}`);
  return ranges;
}

function compressDriverSegments(
  lapDriverPairs: Array<{ lapNumber: number; driverCode: string }>,
): string[] {
  if (lapDriverPairs.length === 0) {
    return [];
  }

  const segments: string[] = [];
  let start = lapDriverPairs[0].lapNumber;
  let end = lapDriverPairs[0].lapNumber;
  let driverCode = lapDriverPairs[0].driverCode;

  for (const pair of lapDriverPairs.slice(1)) {
    if (pair.driverCode === driverCode && pair.lapNumber === end + 1) {
      end = pair.lapNumber;
      continue;
    }

    segments.push(
      `${start === end ? `L${start}` : `L${start}-${end}`} ${driverCode}`,
    );
    start = pair.lapNumber;
    end = pair.lapNumber;
    driverCode = pair.driverCode;
  }

  segments.push(
    `${start === end ? `L${start}` : `L${start}-${end}`} ${driverCode}`,
  );
  return segments;
}

export const resolveSession = tool({
  description:
    "Resolve an F1 session from a year plus either round number or event/circuit text. Prefer this before race-specific analysis. Returns matching session_id, event, circuit, date, round, and session_type rows.",
  inputSchema: z.object({
    year: z.number().int().min(1950).max(2100).describe("Season year"),
    session_type: z
      .enum(["race", "sprint_race", "qualifying", "sprint_qualifying"])
      .default("race")
      .describe("Session type to resolve"),
    round: z.number().int().min(1).max(30).optional().describe("Round number"),
    event_hint: z
      .string()
      .optional()
      .describe("Grand Prix, circuit, city, or country text from the user"),
  }),
  execute: async ({ year, session_type, round, event_hint }) => {
    try {
      if (round) {
        const rows = await executeAIParamQuery(
          `SELECT s.id AS session_id, s.year, s.round, s.session_type, s.event_name,
                  s.date, c.name AS circuit_name, c.location, c.country
           FROM sessions s
           JOIN circuits c ON s.circuit_id = c.id
           WHERE s.year = $1 AND s.round = $2 AND s.session_type = $3
           ORDER BY s.date
           LIMIT 5`,
          [year, round, session_type],
        );
        return { rows, count: rows.length };
      }

      if (event_hint?.trim()) {
        const pattern = `%${event_hint.trim()}%`;
        const rows = await executeAIParamQuery(
          `SELECT s.id AS session_id, s.year, s.round, s.session_type, s.event_name,
                  s.date, c.name AS circuit_name, c.location, c.country
           FROM sessions s
           JOIN circuits c ON s.circuit_id = c.id
           WHERE s.year = $1
             AND s.session_type = $2
             AND (
               s.event_name ILIKE $3
               OR c.name ILIKE $3
               OR c.location ILIKE $3
               OR c.country ILIKE $3
             )
           ORDER BY s.date
           LIMIT 10`,
          [year, session_type, pattern],
        );

        if (rows.length > 0) {
          return { rows, count: rows.length };
        }
      }

      const discoveryRows = await executeAIParamQuery(
        `SELECT s.id AS session_id, s.year, s.round, s.session_type, s.event_name,
                s.date, c.name AS circuit_name, c.location, c.country
         FROM sessions s
         JOIN circuits c ON s.circuit_id = c.id
         WHERE s.year = $1 AND s.session_type = $2
         ORDER BY s.round
         LIMIT 40`,
        [year, session_type],
      );

      return {
        rows: discoveryRows,
        count: discoveryRows.length,
        note: "No exact event hint match; returned season discovery rows.",
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return { error: message, rows: [], count: 0 };
    }
  },
});

export const getRaceDynamics = tool({
  description:
    "Return a compact, deterministic race evidence pack for a resolved race/sprint session: final results, leader timeline, laps led, top-finisher position paths, pit stops, neutralized laps, and notable race-control messages. Use before narrative claims like dominated, led from pole to flag, recovered, or benefited from SC/VSC.",
  inputSchema: z.object({
    session_id: z.number().int().positive().describe("Resolved session ID"),
    driver_codes: z
      .array(z.string())
      .optional()
      .describe("Optional driver codes to emphasize in position paths"),
  }),
  execute: async ({ session_id, driver_codes }) => {
    try {
      const results = await executeAIParamQuery(
        `SELECT sr.position, sr.grid_position, sr.points, sr.status, sr.time_seconds,
                sr.fastest_lap, d.id AS driver_id, d.full_name, d.driver_code,
                t.name AS team_name
         FROM session_results sr
         JOIN drivers d ON sr.driver_id = d.id
         JOIN teams t ON sr.team_id = t.id
         WHERE sr.session_id = $1
         ORDER BY sr.position NULLS LAST
         LIMIT 30`,
        [session_id],
      );

      const laps = await executeAIParamQuery(
        `SELECT l.lap_number, l.position, l.compound, l.stint,
                l.pit_in_time_seconds, l.pit_out_time_seconds, l.pit_duration_seconds,
                l.track_status, d.id AS driver_id, d.full_name, d.driver_code
         FROM laps l
         JOIN drivers d ON l.driver_id = d.id
         WHERE l.session_id = $1
         ORDER BY l.lap_number, l.position NULLS LAST
         LIMIT 2000`,
        [session_id],
      );

      const raceControlRows = await executeAIParamQuery(
        `SELECT lap_number, category, message, status, driver_number
         FROM race_control_messages
         WHERE session_id = $1
           AND (
             message ILIKE '%SAFETY CAR%'
             OR message ILIKE '%VSC%'
             OR message ILIKE '%PENALTY%'
             OR message ILIKE '%INVESTIGATION%'
             OR message ILIKE '%INCIDENT%'
             OR message ILIKE '%DRS%'
             OR message ILIKE '%RETIRED%'
             OR message ILIKE '%STOPPED%'
           )
         ORDER BY session_time_seconds
         LIMIT 40`,
        [session_id],
      );

      const resultByDriver = new Map<number, Record<string, unknown>>();
      const driverCodeById = new Map<number, string>();
      const driverNameById = new Map<number, string>();

      for (const row of results) {
        const driverId = asNumber(row.driver_id);
        if (driverId === null) {
          continue;
        }
        resultByDriver.set(driverId, row);
        driverCodeById.set(
          driverId,
          asString(row.driver_code) || asString(row.full_name) || `${driverId}`,
        );
        driverNameById.set(
          driverId,
          asString(row.full_name) || asString(row.driver_code) || `${driverId}`,
        );
      }

      const leaderByLap: Array<{ lapNumber: number; driverCode: string }> = [];
      const lapsLed = new Map<string, number>();
      const lapsByDriver = new Map<number, Record<string, unknown>[]>();
      const statusLaps = new Map<string, Set<number>>();

      for (const row of laps) {
        const driverId = asNumber(row.driver_id);
        const lapNumber = asNumber(row.lap_number);
        const position = asNumber(row.position);
        if (driverId === null || lapNumber === null) {
          continue;
        }

        const driverCode =
          asString(row.driver_code) ||
          driverCodeById.get(driverId) ||
          `${driverId}`;
        driverCodeById.set(driverId, driverCode);
        driverNameById.set(
          driverId,
          asString(row.full_name) || driverNameById.get(driverId) || driverCode,
        );
        lapsByDriver.set(driverId, [
          ...(lapsByDriver.get(driverId) || []),
          row,
        ]);

        if (position === 1) {
          leaderByLap.push({ lapNumber, driverCode });
          lapsLed.set(driverCode, (lapsLed.get(driverCode) || 0) + 1);
        }

        const trackStatus = asString(row.track_status);
        if (trackStatus) {
          for (const status of trackStatus) {
            if (!["4", "5", "6", "7"].includes(status)) {
              continue;
            }
            const existing = statusLaps.get(status) || new Set<number>();
            existing.add(lapNumber);
            statusLaps.set(status, existing);
          }
        }
      }

      const requestedCodes = new Set(
        (driver_codes || []).map((code) => code.toUpperCase()),
      );
      const topFinishers = results
        .filter((row) => {
          const position = asNumber(row.position);
          const code = asString(row.driver_code)?.toUpperCase();
          return (
            (position !== null && position <= 10) ||
            (code ? requestedCodes.has(code) : false)
          );
        })
        .map((row) => asNumber(row.driver_id))
        .filter((driverId): driverId is number => driverId !== null);

      const positionPaths = topFinishers.map((driverId) => {
        const driverLaps = lapsByDriver.get(driverId) || [];
        const positions = driverLaps
          .map((lap) => asNumber(lap.position))
          .filter((position): position is number => position !== null);
        const result = resultByDriver.get(driverId);
        const firstP1Lap =
          asNumber(
            driverLaps.find((lap) => asNumber(lap.position) === 1)?.lap_number,
          ) ?? null;
        return {
          driverCode: driverCodeById.get(driverId),
          driverName: driverNameById.get(driverId),
          grid: result ? asNumber(result.grid_position) : null,
          lap1:
            asNumber(
              driverLaps.find((lap) => asNumber(lap.lap_number) === 1)
                ?.position,
            ) ?? null,
          best: positions.length > 0 ? Math.min(...positions) : null,
          worst: positions.length > 0 ? Math.max(...positions) : null,
          finish: result ? asNumber(result.position) : null,
          lapsLed: lapsLed.get(driverCodeById.get(driverId) || "") || 0,
          firstP1Lap,
        };
      });

      const neutralizedLaps = {
        safetyCar: compressNumberRanges(
          [...(statusLaps.get("4") || new Set<number>())].sort((a, b) => a - b),
        ),
        virtualSafetyCar: compressNumberRanges(
          [...(statusLaps.get("6") || new Set<number>())].sort((a, b) => a - b),
        ),
        redFlag: compressNumberRanges(
          [...(statusLaps.get("5") || new Set<number>())].sort((a, b) => a - b),
        ),
      };

      const scVscLaps = new Set<number>([
        ...(statusLaps.get("4") || new Set<number>()),
        ...(statusLaps.get("6") || new Set<number>()),
      ]);
      const pitStops = topFinishers.flatMap((driverId) => {
        const stops: Array<Record<string, unknown>> = [];
        let pendingPitIn: Record<string, unknown> | null = null;

        for (const lap of lapsByDriver.get(driverId) || []) {
          const pitIn = asNumber(lap.pit_in_time_seconds);
          const pitOut = asNumber(lap.pit_out_time_seconds);

          if (pitIn !== null) {
            pendingPitIn = lap;
            if (pitOut === null) {
              continue;
            }
          }

          if (pitOut === null) {
            continue;
          }

          const inLap =
            asNumber(pendingPitIn?.lap_number) ?? asNumber(lap.lap_number);
          const outLap = asNumber(lap.lap_number);
          const pitInTime = asNumber(pendingPitIn?.pit_in_time_seconds);
          const durationSeconds =
            pitInTime !== null
              ? pitOut - pitInTime
              : asNumber(lap.pit_duration_seconds);
          const lapRange =
            inLap !== null && outLap !== null && inLap !== outLap
              ? `L${inLap}-L${outLap}`
              : inLap !== null
                ? `L${inLap}`
                : outLap !== null
                  ? `L${outLap}`
                  : null;
          const underScOrVsc =
            inLap !== null && outLap !== null
              ? Array.from(
                  { length: Math.abs(outLap - inLap) + 1 },
                  (_, index) => Math.min(inLap, outLap) + index,
                ).some((pitLap) => scVscLaps.has(pitLap))
              : false;

          stops.push({
            driverCode: driverCodeById.get(driverId),
            lapRange,
            inLap,
            outLap,
            compound: asString(lap.compound),
            durationSeconds,
            underScOrVsc,
          });
          pendingPitIn = null;
        }

        return stops;
      });

      return {
        sessionId: session_id,
        finalResults: results.slice(0, 10),
        leaderTimeline: compressDriverSegments(leaderByLap),
        lapsLed: Object.fromEntries(
          [...lapsLed.entries()].sort((a, b) => b[1] - a[1]),
        ),
        neutralizedLaps,
        positionPaths,
        pitStops,
        raceControl: raceControlRows,
        evidenceRules: [
          "Led from pole to flag requires grid P1, lap 1 P1, every leader timeline segment matching the winner, and finish P1.",
          "Dominance requires lap-position, pace/gap, or laps-led evidence; final margin alone is insufficient.",
          "SC/VSC benefit requires pit or position evidence overlapping neutralized laps.",
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return { error: message };
    }
  },
});

export const runSQLQuery = tool({
  description:
    "Execute a read-only SQL query against the F1 database. Returns JSON array of row objects. Use this to fetch data for answering user questions. Only SELECT queries on F1 data tables are allowed.",
  inputSchema: z.object({
    sql: z.string().describe("The SQL SELECT query to execute"),
  }),
  execute: async ({ sql }) => {
    const validation = validateSQL(sql);
    if (!validation.valid) {
      return { error: validation.error, rows: [], count: 0 };
    }

    const safeSql = ensureLimit(sql);

    try {
      const rows = await executeAIQuery(safeSql);
      return {
        rows,
        count: rows.length,
        columns: rows.length > 0 ? Object.keys(rows[0]) : [],
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown database error";
      return { error: message, rows: [], count: 0 };
    }
  },
});

export const getTableSchema = tool({
  description:
    "Get the column names, types, and constraints for a specific F1 data table. Use this when you need to understand a table's structure before writing a query.",
  inputSchema: z.object({
    table_name: z
      .string()
      .describe("The table to describe (e.g., 'drivers', 'sessions', 'laps')"),
  }),
  execute: async ({ table_name }) => {
    if (!ALLOWED_TABLES.includes(table_name.toLowerCase())) {
      return {
        error: `Table '${table_name}' is not accessible. Allowed tables: ${ALLOWED_TABLES.join(", ")}`,
      };
    }

    try {
      const rows = await executeAIParamQuery(
        `SELECT column_name, data_type, is_nullable, column_default
				 FROM information_schema.columns
				 WHERE table_name = $1
				 ORDER BY ordinal_position`,
        [table_name],
      );

      return { table: table_name, columns: rows };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return { error: message };
    }
  },
});

export const getSampleData = tool({
  description:
    "Get 5 example rows from an F1 data table, optionally filtered. Use this to understand what the data looks like before writing complex queries.",
  inputSchema: z.object({
    table_name: z.string().describe("The table to sample from"),
    where_clause: z
      .string()
      .optional()
      .describe(
        'Optional WHERE clause (without the WHERE keyword), e.g., "year = 2024"',
      ),
  }),
  execute: async ({ table_name, where_clause }) => {
    if (!ALLOWED_TABLES.includes(table_name.toLowerCase())) {
      return {
        error: `Table '${table_name}' is not accessible. Allowed tables: ${ALLOWED_TABLES.join(", ")}`,
      };
    }

    if (where_clause) {
      const whereCheck = validateWhereClause(where_clause);
      if (!whereCheck.valid) {
        return { error: whereCheck.error };
      }
    }

    try {
      const whereStr = where_clause ? `WHERE ${where_clause}` : "";
      const rows = await executeAIQuery(
        `SELECT * FROM ${table_name} ${whereStr} LIMIT 5`,
      );

      return { table: table_name, sample_rows: rows, count: rows.length };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return { error: message };
    }
  },
});

export const generateChart = tool({
  description:
    "Generate a chart configuration for visualizing F1 data. Returns a JSON object that the frontend renders as a Recharts component. Use this when a visual representation would enhance the answer (trends, comparisons, distributions). IMPORTANT: y_keys must be the exact keys present in the data objects. Use series_labels to provide human-readable display names shown in the legend (e.g. y_keys: ['norris_pts', 'piastri_pts'], series_labels: ['Norris', 'Piastri']).",
  inputSchema: z.object({
    chart_type: z
      .enum(["bar", "line", "scatter", "pie", "stacked_bar"])
      .describe("The type of chart to generate"),
    title: z.string().describe("Chart title"),
    x_label: z.string().describe("X-axis label"),
    y_label: z.string().describe("Y-axis label"),
    data: z
      .array(z.record(z.string(), z.unknown()))
      .describe("Array of data objects for the chart"),
    x_key: z.string().describe("Key in data objects for the x-axis"),
    y_keys: z
      .array(z.string())
      .describe(
        "Key(s) in data objects for the y-axis — must match exact keys in the data objects",
      ),
    series_labels: z
      .array(z.string())
      .optional()
      .describe(
        "Human-readable display names for each y_key series shown in the legend (e.g. ['Norris', 'Piastri'] instead of ['norris_pts', 'piastri_pts']). Must be same length as y_keys.",
      ),
    colors: z
      .array(z.string())
      .optional()
      .describe(
        "Optional hex colors for each series (e.g., ['#e10600', '#0600ef'])",
      ),
  }),
  execute: async ({
    chart_type,
    title,
    x_label,
    y_label,
    data,
    x_key,
    y_keys,
    series_labels,
    colors,
  }) => {
    return {
      type: "chart" as const,
      config: {
        chartType: chart_type,
        title,
        xLabel: x_label,
        yLabel: y_label,
        data,
        xKey: x_key,
        yKeys: y_keys,
        seriesLabels: series_labels,
        colors: colors || [],
      },
    };
  },
});
