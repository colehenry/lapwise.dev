import { describe, expect, it } from "vitest";
import {
  AGENT_MAX_OUTPUT_TOKENS,
  AGENT_MAX_STEPS,
  AGENT_STEP_TIMEOUT_MS,
  AGENT_TOTAL_TIMEOUT_MS,
  shouldForceFinalAnswer,
} from "./agent-budget";

function step(
  totalTokens: number,
  toolCalls: { toolName: string; input?: unknown }[] = [],
) {
  return { usage: { totalTokens }, toolCalls };
}

describe("agent budget", () => {
  it("allows slow inference while retaining explicit cost bounds", () => {
    expect(AGENT_MAX_OUTPUT_TOKENS).toBeGreaterThanOrEqual(1_800);
    expect(AGENT_STEP_TIMEOUT_MS).toBeGreaterThanOrEqual(90_000);
    expect(AGENT_TOTAL_TIMEOUT_MS).toBeGreaterThan(AGENT_STEP_TIMEOUT_MS);
    expect(AGENT_TOTAL_TIMEOUT_MS).toBeLessThanOrEqual(180_000);
  });

  it("finishes after a complete season context result", () => {
    expect(
      shouldForceFinalAnswer(
        [step(4_000, [{ toolName: "get_season_context" }])],
        1,
      ),
    ).toBe(true);
  });

  it("finishes after two SQL calls or a repeated tool call", () => {
    expect(
      shouldForceFinalAnswer(
        [
          step(2_000, [{ toolName: "run_sql_query", input: { sql: "a" } }]),
          step(3_000, [{ toolName: "run_sql_query", input: { sql: "b" } }]),
        ],
        2,
      ),
    ).toBe(true);
    expect(
      shouldForceFinalAnswer(
        [
          step(2_000, [{ toolName: "resolve_session", input: { year: 2026 } }]),
          step(2_000, [{ toolName: "resolve_session", input: { year: 2026 } }]),
        ],
        2,
      ),
    ).toBe(true);
  });

  it("finishes at the token or step budget while allowing a normal next step", () => {
    expect(shouldForceFinalAnswer([step(10_000)], 1)).toBe(true);
    expect(shouldForceFinalAnswer([step(1_000)], AGENT_MAX_STEPS - 1)).toBe(
      true,
    );
    expect(shouldForceFinalAnswer([step(1_000)], 1)).toBe(false);
  });
});
