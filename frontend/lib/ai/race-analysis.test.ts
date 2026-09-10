import { describe, expect, it } from "vitest";
import { renderArtifactMarkdown } from "./artifact-markdown";
import {
  buildRaceAnalysisExecution,
  looksLikeRaceAnalysis,
} from "./race-analysis";
import { calculateRaceDynamics } from "./race-dynamics-calculation";

describe("race analysis", () => {
  it("renders only claims present in deterministic race evidence", () => {
    const evidence = calculateRaceDynamics({
      sessionId: 20,
      results: [
        {
          driver_id: 1,
          driver_code: "HAM",
          full_name: "Lewis Hamilton",
          position: 1,
          grid_position: 2,
        },
      ],
      laps: [
        {
          driver_id: 1,
          driver_code: "HAM",
          full_name: "Lewis Hamilton",
          lap_number: 1,
          position: 1,
          stint: 1,
          compound: "SOFT",
          lap_time_seconds: 90,
          is_accurate: true,
          deleted: false,
          track_status: "1",
        },
      ],
      raceControl: [],
    });
    const execution = buildRaceAnalysisExecution({
      question: "How did Hamilton win the 2024 British Grand Prix?",
      season: 2024,
      sessionType: "race",
      session: {
        id: 20,
        eventName: "British Grand Prix",
        round: 12,
        date: "2024-07-07",
      },
      evidence,
    });
    const markdown = renderArtifactMarkdown(execution.artifact);

    expect(markdown).toContain("Lewis Hamilton won from grid position 2");
    expect(markdown).toContain("1 of 1 recorded leader laps");
    expect(markdown).not.toMatch(/dominant|masterclass|brilliant strategy/i);
    expect(execution.artifact.evidence.map((item) => item.kind)).toEqual([
      "database",
      "calculation",
    ]);
  });

  it("recognizes narrative and strategy questions, not simple results", () => {
    expect(looksLikeRaceAnalysis("What decided this race?")).toBe(true);
    expect(
      looksLikeRaceAnalysis("Explain the winning strategy at Monaco"),
    ).toBe(true);
    expect(looksLikeRaceAnalysis("Who won Monaco?")).toBe(false);
  });
});
