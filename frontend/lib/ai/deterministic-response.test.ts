import { describe, expect, it } from "vitest";
import { analysisPlanSchema } from "./analysis-contracts";
import type { DeterministicAnalysisResult } from "./analysis-engine";
import { createDeterministicAnalysisResponse } from "./deterministic-response";

const analysis: DeterministicAnalysisResult = {
  plan: analysisPlanSchema.parse({
    version: 1,
    question: "Compare Norris and Piastri in 2025 qualifying",
    entities: [
      { kind: "driver", id: 1, name: "Lando Norris", slug: "norris" },
      { kind: "driver", id: 2, name: "Oscar Piastri", slug: "piastri" },
      { kind: "season", id: 2025, name: "2025" },
    ],
    scope: { season: 2025, sessionTypes: ["qualifying"] },
    facets: [
      {
        family: "qualifying_comparison",
        objective: "Compare qualifying",
        metrics: ["head_to_head"],
        presentations: ["narrative", "chart"],
      },
    ],
    assumptions: [],
    unresolvedTerms: [],
  }),
  markdown: "Norris led 13–11.",
  charts: [
    {
      chartType: "bar",
      title: "Q3 gap",
      xLabel: "Round",
      yLabel: "Seconds",
      data: [{ round: 1, gap: 0.084 }],
      xKey: "round",
      yKeys: ["gap"],
      colors: [],
    },
  ],
  queries: ["SELECT ... WHERE s.year = $1"],
  model: "deterministic/qualifying-comparison-v1",
};

describe("deterministic analysis response", () => {
  it("uses the existing stream protocol without a model request", async () => {
    const response = createDeterministicAnalysisResponse({
      analysis,
      conversationId: "seed",
      question: analysis.plan.question,
      remaining: 2,
      seedMode: true,
    });
    const events = (await response.text())
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));

    expect(events.map((event) => event.type)).toEqual([
      "init",
      "status",
      "text-delta",
      "metadata",
    ]);
    expect(events[2].text).toBe("Norris led 13–11.");
    expect(events[3]).toMatchObject({
      conversationId: "seed",
      charts: analysis.charts,
      usage: { totalTokens: 0 },
      model: {
        id: "deterministic/qualifying-comparison-v1",
        provider: "deterministic",
      },
    });
  });
});
