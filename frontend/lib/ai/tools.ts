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
];

/**
 * SQL keywords that indicate a write operation — blocked for safety.
 */
const BLOCKED_SQL_PATTERNS =
  /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|GRANT|REVOKE|CREATE|EXECUTE)\b/i;

/**
 * Validates a SQL query is read-only and safe to execute.
 */
function validateSQL(sql: string): { valid: boolean; error?: string } {
  const trimmed = sql.trim();

  if (!trimmed.toUpperCase().startsWith("SELECT")) {
    return { valid: false, error: "Only SELECT queries are allowed." };
  }

  if (BLOCKED_SQL_PATTERNS.test(trimmed)) {
    return {
      valid: false,
      error:
        "Query contains blocked keywords. Only read-only SELECT queries are permitted.",
    };
  }

  const lowerSQL = trimmed.toLowerCase();
  const restrictedTables = [
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

  for (const table of restrictedTables) {
    const tablePattern = new RegExp(`\\b${table}\\b`, "i");
    if (tablePattern.test(lowerSQL)) {
      return {
        valid: false,
        error: `Access to table '${table}' is not permitted. Only F1 data tables are queryable.`,
      };
    }
  }

  return { valid: true };
}

/**
 * Injects a LIMIT clause if none is present.
 */
function ensureLimit(sql: string, maxRows = 500): string {
  if (/\bLIMIT\b/i.test(sql)) {
    return sql;
  }
  const cleaned = sql.replace(/;\s*$/, "");
  return `${cleaned} LIMIT ${maxRows}`;
}

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

    if (where_clause && BLOCKED_SQL_PATTERNS.test(where_clause)) {
      return { error: "WHERE clause contains blocked keywords." };
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
    "Generate a chart configuration for visualizing F1 data. Returns a JSON object that the frontend renders as a Recharts component. Use this when a visual representation would enhance the answer (trends, comparisons, distributions).",
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
        "Key(s) in data objects for the y-axis (supports multiple series)",
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
        colors: colors || [],
      },
    };
  },
});
