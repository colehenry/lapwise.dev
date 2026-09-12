import { describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({
  executeAIQuery: vi.fn(),
  executeAIParamQuery: vi.fn(),
}));

import { executeAIParamQuery } from "./db";
import { getRaceStrategyInsights } from "./tools";

describe("getRaceStrategyInsights tool", () => {
  it("returns bounded coverage instead of exposing pit-stop storage", async () => {
    vi.mocked(executeAIParamQuery).mockResolvedValue([]);

    // biome-ignore lint/style/noNonNullAssertion: tool always defines execute
    const result = await getRaceStrategyInsights.execute!({ session_id: 77 }, {
      toolCallId: "test",
      messages: [],
    } as never);
    if (Symbol.asyncIterator in result) throw new Error("expected a value");

    expect(executeAIParamQuery).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      sessionId: 77,
      coverage: { inputRows: 0, supportsPitStrategy: false },
      paceModel: { quality: { usable: false } },
    });
  });
});
