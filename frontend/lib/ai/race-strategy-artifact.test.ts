import { describe, expect, it } from "vitest";
import { renderArtifactMarkdown } from "./artifact-markdown";
import {
  doubleStackArtifact,
  safeStopArtifact,
  undercutFailureArtifact,
} from "./race-strategy-artifact";
import type { RaceStrategyEvidence } from "./race-strategy-calculation";
import type { PitTransitEvent } from "./race-strategy-events";

const context = {
  season: 2025,
  round: 4,
  eventName: "Bahrain Grand Prix",
  sessionType: "race" as const,
};

const first: PitTransitEvent = {
  driverId: 1,
  driverCode: "NOR",
  driverName: "Lando Norris",
  teamId: 1,
  teamName: "McLaren",
  inLap: 10,
  outLap: 11,
  pitInTimeSeconds: 1000,
  pitOutTimeSeconds: 1029.615,
  transitSeconds: 29.615,
  beforeCompound: "SOFT",
  afterCompound: "MEDIUM",
  underNeutralization: false,
};

const second: PitTransitEvent = {
  ...first,
  driverId: 2,
  driverCode: "RUS",
  driverName: "George Russell",
  teamId: 2,
  teamName: "Mercedes",
  inLap: 13,
  outLap: 14,
  pitInTimeSeconds: 1300,
  pitOutTimeSeconds: 1323.939,
  transitSeconds: 23.939,
};

function evidence(): RaceStrategyEvidence {
  return {
    sessionId: 9,
    coverage: {
      inputRows: 1000,
      timedRows: 990,
      richRows: 990,
      cleanPaceRows: 800,
      driverCount: 20,
      compoundCount: 3,
      stintCount: 50,
      completePitMarkers: 30,
      supportsPaceModel: true,
      supportsPitStrategy: true,
      limitations: [],
    },
    paceModel: {
      coefficients: null,
      quality: {
        usable: false,
        cleanLapCount: 0,
        driverCount: 0,
        compoundCount: 0,
        stintCount: 0,
        rmseSeconds: null,
        conditioningRatio: null,
        bootstrapSamples: 0,
        fuelSlopeInterval: null,
        rejectionReasons: ["design matrix is rank deficient"],
        excludedLaps: {},
      },
    },
    paceModelSummary: "Pace model withheld: design matrix is rank deficient.",
    pitStops: [first, second],
    undercutFailures: [],
    doubleStacks: [],
    stopLoss: null,
    safeStopCases: [],
    evidenceRules: [],
  };
}

describe("race strategy artifacts", () => {
  it("renders observed undercut components without assigning a cause", () => {
    const artifact = undercutFailureArtifact(context, evidence(), {
      attacker: first,
      target: second,
      gapBeforeSeconds: 0.975,
      gapAfterSeconds: 3.132,
      gapChangeSeconds: 2.157,
      newTyreGainSeconds: 1.231,
      comparedNewTyreLaps: 1,
      transitDeltaSeconds: 5.676,
    });
    const markdown = renderArtifactMarkdown(artifact);

    expect(markdown).toContain("fresh-tyre laps gained 1.231s");
    expect(markdown).toContain("total pit-lane transit was 5.676s longer");
    expect(markdown).toContain("cannot separate queueing");
  });

  it("withholds a safe-stop estimate when the pace model is rejected", () => {
    const artifact = safeStopArtifact(context, evidence(), null);
    expect(artifact.summary).toContain("safe-stop answer was withheld");
    expect(artifact.summary).toContain("rank deficient");
  });

  it("labels a double-stack delta as transit rather than service", () => {
    const stackEvidence = evidence();
    const artifact = doubleStackArtifact(context, stackEvidence, {
      teamId: 1,
      teamName: "McLaren",
      lapNumber: 20,
      first,
      second: { ...second, teamId: 1, teamName: "McLaren" },
      arrivalGapSeconds: 4,
      secondTransitTaxSeconds: 2.5,
    });
    const markdown = renderArtifactMarkdown(artifact);

    expect(markdown).toContain("2.500s longer in the pit lane");
    expect(markdown).toContain("not stationary service");
  });
});
