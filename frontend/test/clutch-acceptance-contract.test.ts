import { describe, expect, it } from "vitest";
import { clutchAcceptanceCases } from "./clutch-acceptance-cases";

describe("Clutch acceptance corpus", () => {
  it("covers the durable answer-quality families", () => {
    const covered = new Set(
      clutchAcceptanceCases.flatMap((testCase) => testCase.families),
    );

    expect(covered).toEqual(
      new Set([
        "results",
        "standings",
        "qualifying_comparison",
        "race_narrative",
        "strategy",
        "rules",
        "weather",
        "general",
      ]),
    );
  });

  it("uses stable ids and assertion-oriented expectations", () => {
    const ids = clutchAcceptanceCases.map((testCase) => testCase.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(clutchAcceptanceCases.length).toBeGreaterThanOrEqual(12);

    for (const testCase of clutchAcceptanceCases) {
      expect(testCase.id).toMatch(/^[a-z0-9-]+$/);
      expect(testCase.question.trim()).not.toBe("");
      expect(testCase.families.length).toBeGreaterThan(0);
    }
  });

  it("locks the known 2025 qualifying regression", () => {
    const regression = clutchAcceptanceCases.find(
      (testCase) => testCase.id === "qualifying-norris-piastri-2025",
    );

    expect(regression?.expected.exactFacts).toEqual({
      norrisHeadToHeadWins: 13,
      piastriHeadToHeadWins: 11,
      norrisPoles: 7,
      piastriPoles: 6,
      mutualQ3Appearances: 22,
      medianPiastriMinusNorrisSeconds: 0.0305,
    });
  });
});
