import type {
  ClutchProgressMetric,
  ClutchProgressStage,
  ClutchProgressStatus,
} from "../clutch-progress";

function toolStage(toolName: string): ClutchProgressStage | null {
  switch (toolName) {
    case "run_sql_query":
      return "more_data";
    case "get_season_context":
      return "season";
    case "resolve_session":
      return "event";
    case "get_race_dynamics":
      return "race";
    case "generate_chart":
      return "chart";
    default:
      return null;
  }
}

function arrayLength(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function toolMetrics(
  toolName: string,
  output: Record<string, unknown>,
): ClutchProgressMetric[] {
  switch (toolName) {
    case "get_season_context":
      return [
        { value: Number(output.completedRaces) || 0, label: "rounds checked" },
        { value: arrayLength(output.charts), label: "visuals ready" },
      ];
    case "resolve_session":
      return [{ value: Number(output.count) || 0, label: "sessions found" }];
    case "get_race_dynamics":
      return [
        { value: arrayLength(output.positionPaths), label: "drivers traced" },
        {
          value: arrayLength(output.neutralizedLaps),
          label: "neutralized laps",
        },
      ];
    case "generate_chart": {
      const config = output.config as Record<string, unknown> | undefined;
      return [{ value: arrayLength(config?.data), label: "points plotted" }];
    }
    case "run_sql_query":
      return [{ value: Number(output.count) || 0, label: "records checked" }];
    default:
      return [];
  }
}

export function agentToolProgress(
  toolName: string,
  output?: Record<string, unknown>,
): ClutchProgressStatus | null {
  const stage = toolStage(toolName);
  if (!stage) return null;
  const metrics = output ? toolMetrics(toolName, output) : [];
  return { stage, metrics: metrics.length > 0 ? metrics : undefined };
}
