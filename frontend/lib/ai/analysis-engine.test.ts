import { describe, expect, it } from "vitest";
import {
  createQualifyingComparisonPlan,
  looksLikeQualifyingComparison,
} from "./analysis-engine";
import type { DriverCandidate } from "./driver-resolution";
import { extractSeason } from "./question-parsing";
import { raceStrategyIntent } from "./race-strategy-analysis";

const candidates: DriverCandidate[] = [
  {
    id: 1,
    slug: "norris",
    fullName: "Lando Norris",
    displayName: "Lando Norris",
    driverCode: "NOR",
    externalId: "norris",
  },
  {
    id: 2,
    slug: "piastri",
    fullName: "Oscar Piastri",
    displayName: "Oscar Piastri",
    driverCode: "PIA",
    externalId: "piastri",
  },
  {
    id: 3,
    slug: "max-verstappen",
    fullName: "Max Verstappen",
    displayName: "Max Verstappen",
    driverCode: "VER",
    externalId: "max_verstappen",
  },
];

describe("deterministic analysis planning", () => {
  it("routes the three bounded pit-strategy questions", () => {
    expect(raceStrategyIntent("Why didn't the undercut work?")).toBe(
      "undercut_failure",
    );
    expect(raceStrategyIntent("Could Norris pit and keep position?")).toBe(
      "safe_stop",
    );
    expect(raceStrategyIntent("What did the double-stack cost?")).toBe(
      "double_stack",
    );
    expect(raceStrategyIntent("Explain the winning strategy")).toBeNull();
  });

  it("recognizes a qualifying comparison and preserves driver order", () => {
    const question =
      "Compare Oscar Piastri versus Lando Norris in qualifying in 2025";
    const plan = createQualifyingComparisonPlan(question, candidates);

    expect(plan?.scope).toMatchObject({ season: 2025 });
    expect(plan?.entities.map((entity) => entity.name)).toEqual([
      "Oscar Piastri",
      "Lando Norris",
      "2025",
    ]);
    expect(plan?.facets[0].metrics).toContain("median_q3_gap");
  });

  it("matches full names, surnames, slugs, and driver codes", () => {
    const questions = [
      "Compare Lando Norris vs Oscar Piastri in 2025 qualifying",
      "Compare Norris vs Piastri in 2025 qualifying",
      "Compare norris vs piastri in 2025 qualifying",
      "Compare NOR vs PIA in 2025 qualifying",
    ];

    for (const question of questions) {
      expect(
        createQualifyingComparisonPlan(question, candidates),
      ).not.toBeNull();
    }
  });

  it("does not claim support when scope or entities are unresolved", () => {
    expect(
      createQualifyingComparisonPlan(
        "Compare Norris and Piastri in qualifying",
        candidates,
      ),
    ).toBeNull();
    expect(
      createQualifyingComparisonPlan(
        "Compare the McLarens in qualifying in 2025",
        candidates,
      ),
    ).toBeNull();
    expect(
      createQualifyingComparisonPlan(
        "Compare Norris, Piastri, and Verstappen in 2025 qualifying",
        candidates,
      ),
    ).toBeNull();
  });

  it("uses validated page context when the prompt refers to visible drivers", () => {
    const plan = createQualifyingComparisonPlan(
      "Compare these drivers in qualifying",
      candidates,
      {
        route: "/compare/drivers",
        season: 2025,
        driverSlugs: ["norris", "piastri"],
      },
    );

    expect(plan?.scope.season).toBe(2025);
    expect(plan?.entities.map((entity) => entity.name)).toEqual([
      "Lando Norris",
      "Oscar Piastri",
      "2025",
    ]);
  });

  it("keeps recognition independent from keyword intent ordering", () => {
    expect(
      looksLikeQualifyingComparison(
        "Head-to-head qualifying comparison: Norris vs Piastri in 2025",
      ),
    ).toBe(true);
    expect(looksLikeQualifyingComparison("Who took pole in Monaco?")).toBe(
      false,
    );
    expect(extractSeason("the 2025 season")).toBe(2025);
  });
});
