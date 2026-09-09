import { generateText, type LanguageModel } from "ai";
import type { StepType } from "../chat";
import type { AnalysisPageContext } from "./analysis-contracts";
import type { AnalysisGuidance } from "./analysis-guidance";
import { buildSystemPrompt } from "./system-prompt";

export interface ToolSummary {
  toolName: string;
  summary: string;
}

export function summarizeToolOutput(
  toolName: string,
  output: Record<string, unknown>,
): string {
  if (toolName === "run_sql_query") {
    const columns = Array.isArray(output.columns)
      ? output.columns.filter(
          (column): column is string => typeof column === "string",
        )
      : [];
    return JSON.stringify({
      type: "sql_result",
      error: typeof output.error === "string" ? output.error : null,
      count: typeof output.count === "number" ? output.count : null,
      columns,
      sampleRows: Array.isArray(output.rows) ? output.rows.slice(0, 5) : [],
    });
  }

  if (toolName === "generate_chart") {
    return JSON.stringify({ type: "chart_result", config: output.config });
  }

  if (toolName === "resolve_session") {
    return JSON.stringify({
      type: "session_resolution",
      error: typeof output.error === "string" ? output.error : null,
      count: typeof output.count === "number" ? output.count : null,
      rows: Array.isArray(output.rows) ? output.rows.slice(0, 10) : [],
      note: output.note,
    });
  }

  if (toolName === "get_race_dynamics") {
    return JSON.stringify({
      type: "race_dynamics",
      sessionId: output.sessionId,
      leaderTimeline: output.leaderTimeline,
      lapsLed: output.lapsLed,
      neutralizedLaps: output.neutralizedLaps,
      positionPaths: output.positionPaths,
      pitStops: output.pitStops,
      raceControl: Array.isArray(output.raceControl)
        ? output.raceControl.slice(0, 10)
        : output.raceControl,
      evidenceRules: output.evidenceRules,
      error: output.error,
    });
  }

  return JSON.stringify(output);
}

export function legacyToolStatus(
  toolName: string,
  queryCount: number,
): { message: string; stepType: StepType } | null {
  switch (toolName) {
    case "run_sql_query":
      return { message: `Running SQL query ${queryCount}...`, stepType: "sql" };
    case "resolve_session":
      return { message: "Resolving the session...", stepType: "sql" };
    case "get_race_dynamics":
      return {
        message: "Building race dynamics evidence...",
        stepType: "sql",
      };
    case "generate_chart":
      return { message: "Generating visualization...", stepType: "chart" };
    default:
      return null;
  }
}

export async function buildFallbackAnswer(params: {
  question: string;
  guidance: AnalysisGuidance;
  queries: string[];
  toolSummaries: ToolSummary[];
  model: LanguageModel;
  abortSignal?: AbortSignal;
  pageContext?: AnalysisPageContext;
}): Promise<string> {
  const synthesisPrompt = `The agent collected data for this user question but did not finish the final report.

User question:
${params.question}

Executed SQL queries:
${params.queries.length > 0 ? params.queries.map((query, index) => `${index + 1}. ${query}`).join("\n\n") : "None"}

Tool outputs:
${params.toolSummaries
  .map((tool, index) => `${index + 1}. ${tool.toolName}\n${tool.summary}`)
  .join("\n\n")}

Write the final answer now. Use only retrieved data, state failed queries, and do not narrate internal tool usage.`;
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), 30_000);
  const abortSignal = params.abortSignal
    ? AbortSignal.any([params.abortSignal, timeoutController.signal])
    : timeoutController.signal;

  try {
    const fallback = await generateText({
      model: params.model,
      system: buildSystemPrompt({
        question: params.question,
        analysisFamilies: params.guidance.families,
        requiredTools: params.guidance.requiredTools,
        planningSource: params.guidance.source,
        pageContext: params.pageContext,
      }),
      prompt: synthesisPrompt,
      abortSignal,
    });
    return fallback.text;
  } finally {
    clearTimeout(timeoutId);
  }
}
