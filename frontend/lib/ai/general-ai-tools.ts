import { tool } from "ai";
import { z } from "zod";
import { executeAIQuery } from "./db";
import { ensureLimit, validateSQL } from "./sql-safety";

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
      const rows = await executeAIQuery(ensureLimit(sql));
      return {
        rows,
        count: rows.length,
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
    "Return a frontend chart configuration. Keys must match the supplied data exactly.",
  inputSchema: z.object({
    chart_type: z.enum(["bar", "line", "scatter", "pie", "stacked_bar"]),
    title: z.string(),
    x_label: z.string(),
    y_label: z.string(),
    data: z.array(z.record(z.string(), z.unknown())).max(500),
    x_key: z.string(),
    y_keys: z.array(z.string()).min(1),
    series_labels: z.array(z.string()).optional(),
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
      colors: colors ?? [],
    },
  }),
});
