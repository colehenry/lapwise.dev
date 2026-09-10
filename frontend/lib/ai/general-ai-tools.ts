import { tool } from "ai";
import { z } from "zod";
import { executeAIQuery } from "./db";
import { ensureLimit, validateSQL } from "./sql-safety";

const MAX_AGENT_SQL_ROWS = 100;
const MAX_AGENT_SQL_CHARS = 24_000;
const MAX_AGENT_SQL_COLUMNS = 30;
const MAX_AGENT_SQL_CELL_CHARS = 500;

function compactSQLRows(
  rows: Record<string, unknown>[],
): Record<string, unknown>[] {
  const compactRows: Record<string, unknown>[] = [];
  let usedCharacters = 2;
  for (const row of rows) {
    const compactRow = Object.fromEntries(
      Object.entries(row)
        .slice(0, MAX_AGENT_SQL_COLUMNS)
        .map(([key, value]) => {
          if (
            typeof value !== "string" ||
            value.length <= MAX_AGENT_SQL_CELL_CHARS
          ) {
            return [key, value];
          }
          return [key, `${value.slice(0, MAX_AGENT_SQL_CELL_CHARS)}…`];
        }),
    );
    const rowCharacters = JSON.stringify(compactRow).length + 1;
    if (usedCharacters + rowCharacters > MAX_AGENT_SQL_CHARS) break;
    compactRows.push(compactRow);
    usedCharacters += rowCharacters;
  }
  return compactRows;
}

export const runSQLQuery = tool({
  description:
    "Execute a read-only SQL query against approved F1 relations. Prefer typed analysis tools when one fits.",
  inputSchema: z.object({ sql: z.string().max(4000) }),
  execute: async ({ sql }) => {
    const validation = validateSQL(sql);
    if (!validation.valid) {
      return { error: validation.error, rows: [], count: 0 };
    }
    try {
      const queryRows = await executeAIQuery(
        ensureLimit(sql, MAX_AGENT_SQL_ROWS),
      );
      const rows = compactSQLRows(queryRows);
      return {
        rows,
        count: rows.length,
        truncated: rows.length < queryRows.length,
        columns: rows.length > 0 ? Object.keys(rows[0]) : [],
      };
    } catch (error) {
      return {
        error:
          error instanceof Error ? error.message : "Unknown database error",
        rows: [],
        count: 0,
      };
    }
  },
});

export const generateChart = tool({
  description:
    "Return a frontend chart configuration. Keys must match the supplied data exactly. Use series_colors for line/stack series and category_colors for entity bars or pie slices when colors are known.",
  inputSchema: z.object({
    chart_type: z.enum(["bar", "line", "scatter", "pie", "stacked_bar"]),
    title: z.string(),
    x_label: z.string(),
    y_label: z.string(),
    data: z.array(z.record(z.string(), z.unknown())).max(500),
    x_key: z.string(),
    y_keys: z.array(z.string()).min(1),
    series_labels: z.array(z.string()).optional(),
    series_colors: z.record(z.string(), z.string()).optional(),
    category_colors: z.record(z.string(), z.string()).optional(),
    colors: z.array(z.string()).optional(),
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
    series_colors,
    category_colors,
    colors,
  }) => ({
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
      seriesColors: series_colors,
      categoryColors: category_colors,
      colors: colors ?? [],
    },
  }),
});
