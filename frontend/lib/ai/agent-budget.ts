export const AGENT_MAX_STEPS = 4;
export const AGENT_MAX_OUTPUT_TOKENS = 900;
export const AGENT_CONTINUATION_TOKEN_BUDGET = 10_000;
export const AGENT_MAX_SQL_CALLS = 2;
export const AGENT_TOTAL_TIMEOUT_MS = 45_000;

interface BudgetToolCall {
  toolName: string;
  input?: unknown;
}

interface BudgetStep {
  usage: { totalTokens?: number };
  toolCalls: readonly BudgetToolCall[];
}

function repeatedToolCall(steps: readonly BudgetStep[]): boolean {
  const callCounts = new Map<string, number>();
  for (const step of steps) {
    for (const call of step.toolCalls) {
      const signature = `${call.toolName}:${JSON.stringify(call.input)}`;
      const count = (callCounts.get(signature) ?? 0) + 1;
      if (count >= 2) return true;
      callCounts.set(signature, count);
    }
  }
  return false;
}

export function shouldForceFinalAnswer(
  steps: readonly BudgetStep[],
  nextStepNumber: number,
): boolean {
  if (nextStepNumber >= AGENT_MAX_STEPS - 1) return true;

  const calls = steps.flatMap((step) => step.toolCalls);
  if (calls.some((call) => call.toolName === "get_season_context")) {
    return true;
  }
  if (
    calls.filter((call) => call.toolName === "run_sql_query").length >=
    AGENT_MAX_SQL_CALLS
  ) {
    return true;
  }
  if (repeatedToolCall(steps)) return true;

  const usedTokens = steps.reduce(
    (total, step) => total + (step.usage.totalTokens ?? 0),
    0,
  );
  return usedTokens >= AGENT_CONTINUATION_TOKEN_BUDGET;
}
