import { describe, expect, it } from "vitest";
import { buildAnalysisGuidance } from "./analysis-guidance";

describe("analysis guidance", () => {
  it("keeps every relevant analysis family instead of choosing one intent", () => {
    const guidance = buildAnalysisGuidance(
      "Compare the wet-weather strategy and turning points in this race",
    );

    expect(guidance.families).toEqual(
      expect.arrayContaining([
        "race_narrative",
        "strategy",
        "weather",
        "comparison",
      ]),
    );
    expect(guidance.requiredTools).toEqual([
      "resolve_session",
      "get_race_dynamics",
    ]);
    expect(guidance.evidenceRequirements).toContain("weather_samples");
  });

  it("does not re-resolve a session supplied by the app", () => {
    const guidance = buildAnalysisGuidance("What decided this race?", {
      route: "/results/2024/8",
      sessionId: 79,
      season: 2024,
      sessionType: "race",
    });

    expect(guidance.requiredTools).toEqual(["get_race_dynamics"]);
  });
});
