import { describe, expect, it } from "vitest";
import { clutchAcceptanceCases } from "@/test/clutch-acceptance-cases";
import { renderArtifactMarkdown } from "./artifact-markdown";
import { buildQualifyingArtifact } from "./qualifying-artifact";
import {
  calculateQualifyingComparison,
  QUALIFYING_COMPARISON_SQL,
  type QualifyingResultRow,
} from "./qualifying-comparison";

const snapshot = [
  { round: 1, norris: 1, piastri: 2, gap: 0.084 },
  { round: 2, norris: 3, piastri: 1, gap: -0.152 },
  { round: 3, norris: 2, piastri: 3, gap: 0.032 },
  { round: 4, norris: 6, piastri: 1, gap: -0.426 },
  { round: 5, norris: 10, piastri: 2, gap: null },
  { round: 6, norris: 2, piastri: 4, gap: 0.106 },
  { round: 7, norris: 4, piastri: 1, gap: -0.292 },
  { round: 8, norris: 1, piastri: 3, gap: 0.175 },
  { round: 9, norris: 2, piastri: 1, gap: -0.209 },
  { round: 10, norris: 7, piastri: 3, gap: -0.505 },
  { round: 11, norris: 1, piastri: 3, gap: 0.583 },
  { round: 12, norris: 3, piastri: 2, gap: -0.015 },
  { round: 13, norris: 1, piastri: 2, gap: 0.085 },
  { round: 14, norris: 3, piastri: 2, gap: -0.015 },
  { round: 15, norris: 2, piastri: 1, gap: -0.012 },
  { round: 16, norris: 2, piastri: 3, gap: 0.113 },
  { round: 17, norris: 7, piastri: 9, gap: null },
  { round: 18, norris: 5, piastri: 3, gap: -0.062 },
  { round: 19, norris: 2, piastri: 6, gap: 0.283 },
  { round: 20, norris: 1, piastri: 8, gap: 0.588 },
  { round: 21, norris: 1, piastri: 4, gap: 0.375 },
  { round: 22, norris: 1, piastri: 5, gap: 1.027 },
  { round: 23, norris: 2, piastri: 1, gap: -0.108 },
  { round: 24, norris: 2, piastri: 3, gap: 0.029 },
] as const;

function resultRows(): QualifyingResultRow[] {
  return snapshot.flatMap((entry) => {
    const shared = {
      round: entry.round,
      event_name: `Round ${entry.round}`,
      date: `2025-01-${String(entry.round).padStart(2, "0")}`,
      q1_time_seconds: 81,
      q2_time_seconds: 80.5,
    };
    const norrisQ3 = entry.gap === null && entry.round === 5 ? null : 80;
    const piastriQ3 =
      entry.gap === null && entry.round === 17 ? null : 80 + (entry.gap ?? 0);

    return [
      {
        ...shared,
        slug: "norris",
        full_name: "Lando Norris",
        position: entry.norris,
        q3_time_seconds: norrisQ3,
      },
      {
        ...shared,
        slug: "piastri",
        full_name: "Oscar Piastri",
        position: entry.piastri,
        q3_time_seconds: piastriQ3,
      },
    ];
  });
}

describe("qualifying comparison", () => {
  it("reproduces the locked 2025 Norris-Piastri facts", () => {
    const comparison = calculateQualifyingComparison(
      2025,
      ["norris", "piastri"],
      resultRows(),
    );
    const expected = clutchAcceptanceCases.find(
      (testCase) => testCase.id === "qualifying-norris-piastri-2025",
    )?.expected.exactFacts;

    expect(comparison.drivers[0]).toMatchObject({
      headToHeadWins: expected?.norrisHeadToHeadWins,
      poles: expected?.norrisPoles,
      fasterQ3Appearances: 12,
    });
    expect(comparison.drivers[1]).toMatchObject({
      headToHeadWins: expected?.piastriHeadToHeadWins,
      poles: expected?.piastriPoles,
      fasterQ3Appearances: 10,
    });
    expect(comparison.mutualQ3Rounds).toBe(expected?.mutualQ3Appearances);
    expect(comparison.medianSecondMinusFirstQ3Seconds).toBeCloseTo(
      Number(expected?.medianPiastriMinusNorrisSeconds),
      4,
    );
  });

  it("builds an evidence-linked artifact and deterministic report", () => {
    const comparison = calculateQualifyingComparison(
      2025,
      ["norris", "piastri"],
      resultRows(),
    );
    const artifact = buildQualifyingArtifact(comparison);
    const evidenceIds = new Set(artifact.evidence.map((record) => record.id));

    for (const metric of artifact.metrics) {
      expect(metric.evidenceIds.every((id) => evidenceIds.has(id))).toBe(true);
    }

    const markdown = renderArtifactMarkdown(artifact);
    expect(markdown).toContain("13–11");
    expect(markdown).toContain("7–6");
    expect(markdown).toContain("+0.031 s");
    expect(markdown).not.toContain("8–5");
    expect(markdown).not.toContain("0.075 seconds");
  });

  it("uses a parameterized, read-only query", () => {
    expect(QUALIFYING_COMPARISON_SQL).toContain("s.year = $1");
    expect(QUALIFYING_COMPARISON_SQL).toContain("ANY($2::text[])");
    expect(QUALIFYING_COMPARISON_SQL.trimStart()).toMatch(/^SELECT/i);
    expect(QUALIFYING_COMPARISON_SQL).not.toContain("norris");
  });

  it("requires two different drivers with data", () => {
    expect(() =>
      calculateQualifyingComparison(2025, ["norris", "norris"], resultRows()),
    ).toThrow(/two different drivers/);
    expect(() =>
      calculateQualifyingComparison(2025, ["norris", "missing"], resultRows()),
    ).toThrow(/No qualifying data/);
  });
});
