import { describe, expect, it } from "vitest";
import { clutchAcceptanceCases } from "@/test/clutch-acceptance-cases";
import { renderArtifactMarkdown } from "./artifact-markdown";
import {
  buildStandingsExecution,
  DRIVER_STANDINGS_SQL,
  looksLikeStandingsQuestion,
  type StandingsRow,
  standingsEntrantType,
} from "./standings-analysis";

function standing(
  position: number | null,
  entrantName: string,
  points: number | null,
  source = "official",
): StandingsRow {
  return {
    championshipPosition: position,
    entrantName,
    entrantSlug: entrantName.toLowerCase().replaceAll(" ", "-"),
    teamName: "Test Team",
    points,
    pointsScored: points ?? 100,
    wins: position === 1 ? 10 : 2,
    podiums: 5,
    classificationStatus: position === null ? "not_classified" : "classified",
    standingsSource: source,
    explanation: null,
    explanationSourceUrl: null,
  };
}

describe("standings analysis", () => {
  it("renders official standings directly from canonical rows", () => {
    const rows = [
      standing(1, "Max Verstappen", 575),
      standing(2, "Sergio Perez", 285),
      standing(3, "Lewis Hamilton", 234),
      standing(4, "Fernando Alonso", 206),
      standing(5, "Charles Leclerc", 206),
    ];
    const execution = buildStandingsExecution({
      question: "Show the final top five in the 2023 drivers' championship.",
      season: 2023,
      entrantType: "driver",
      limit: 5,
      rows,
      query: DRIVER_STANDINGS_SQL,
    });
    const expected = clutchAcceptanceCases.find(
      (testCase) => testCase.id === "standings-final-2023-drivers",
    )?.expected.exactFacts;

    expect(
      execution.artifact.metrics.map(
        (metric) => `${metric.label.replace(/^P\d+ /, "")} — ${metric.value}`,
      ),
    ).toEqual([
      expected?.first,
      expected?.second,
      expected?.third,
      expected?.fourth,
      expected?.fifth,
    ]);
    expect(renderArtifactMarkdown(execution.artifact)).toContain(
      "[Max Verstappen](/drivers/max-verstappen) led the 2023 Drivers' Championship by +290 points over [Sergio Perez](/drivers/sergio-perez)",
    );
    expect(execution.artifact.charts[0].data).toHaveLength(5);
  });

  it("does not infer a champion when official standings are missing", () => {
    const execution = buildStandingsExecution({
      question: "Who won the 1960 drivers championship?",
      season: 1960,
      entrantType: "driver",
      limit: 1,
      rows: [standing(null, "Example Driver", null, "missing_official")],
      query: DRIVER_STANDINGS_SQL,
    });
    const markdown = renderArtifactMarkdown(execution.artifact);

    expect(execution.artifact.metrics).toEqual([]);
    expect(markdown).toContain("standings are unavailable");
    expect(markdown).toContain("no champion or ranking is inferred");
  });

  it("recognizes driver and constructor standings requests", () => {
    expect(looksLikeStandingsQuestion("2024 driver standings")).toBe(true);
    expect(standingsEntrantType("2024 constructor standings")).toBe(
      "constructor",
    );
    expect(standingsEntrantType("2024 drivers championship")).toBe("driver");
  });

  it("uses parameterized read-only SQL", () => {
    expect(DRIVER_STANDINGS_SQL).toContain("year = $1");
    expect(DRIVER_STANDINGS_SQL).toContain("LIMIT $2");
    expect(DRIVER_STANDINGS_SQL.trimStart()).toMatch(/^SELECT/i);
  });
});
