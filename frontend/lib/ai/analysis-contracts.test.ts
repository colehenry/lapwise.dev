import { describe, expect, it } from "vitest";
import {
  analysisPlanSchema,
  analysisRequestSchema,
  answerArtifactSchema,
} from "./analysis-contracts";

describe("analysis contracts", () => {
  it("validates structured app context separately from question text", () => {
    const request = analysisRequestSchema.parse({
      question: "  Who won this race?  ",
      pageContext: {
        route: "/results/2024/8",
        season: 2024,
        round: 8,
        sessionId: 79,
        sessionType: "race",
        driverSlugs: ["leclerc"],
      },
    });

    expect(request.question).toBe("Who won this race?");
    expect(request.pageContext?.sessionId).toBe(79);
  });

  it("supports a multi-facet plan instead of a single keyword intent", () => {
    const plan = analysisPlanSchema.parse({
      version: 1,
      question: "Compare their qualifying and race results in 2025",
      entities: [
        { kind: "driver", name: "Lando Norris", slug: "lando-norris" },
        { kind: "driver", name: "Oscar Piastri", slug: "oscar-piastri" },
      ],
      scope: { season: 2025, sessionTypes: ["qualifying", "race"] },
      facets: [
        {
          family: "qualifying_comparison",
          objective: "Compare qualifying performance",
          metrics: ["head_to_head", "poles", "median_q3_gap"],
          presentations: ["metric_cards", "chart"],
        },
        {
          family: "results",
          objective: "Compare race finishes",
          metrics: ["wins", "podiums"],
          presentations: ["table"],
        },
      ],
      assumptions: [],
      unresolvedTerms: [],
    });

    expect(plan.facets).toHaveLength(2);
  });

  it("rejects a metric without supporting evidence", () => {
    const artifact = {
      version: 1,
      family: "qualifying_comparison",
      title: "2025 qualifying comparison",
      summary: "Norris led the head-to-head.",
      metrics: [
        {
          id: "head-to-head",
          label: "Head-to-head",
          value: "13-11",
          displayValue: "13–11",
          evidenceIds: [],
        },
      ],
      tables: [],
      charts: [],
      evidence: [
        {
          id: "qualifying-results",
          kind: "database",
          label: "Qualifying results",
          source: "session_results",
          fields: {},
        },
      ],
      caveats: [],
    };

    expect(answerArtifactSchema.safeParse(artifact).success).toBe(false);
  });
});
