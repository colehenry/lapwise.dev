import { describe, expect, it } from "vitest";
import { selectRaceCornerInsight } from "./race-corner-insight";
import type { PitTransitEvent } from "./race-strategy-events";

const stop: PitTransitEvent = {
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

describe("race corner insight selection", () => {
  it("surfaces a salient failed undercut with a full-analysis follow-up", () => {
    const insight = selectRaceCornerInsight({
      undercutFailures: [
        {
          attacker: stop,
          target: {
            ...stop,
            driverId: 2,
            driverCode: "RUS",
            driverName: "George Russell",
            inLap: 13,
            outLap: 14,
            transitSeconds: 23.939,
          },
          gapBeforeSeconds: 0.975,
          gapAfterSeconds: 3.132,
          gapChangeSeconds: 2.157,
          newTyreGainSeconds: 1.231,
          comparedNewTyreLaps: 1,
          transitDeltaSeconds: 5.676,
        },
      ],
      safeStopCases: [],
      doubleStacks: [],
    });

    expect(insight).toMatchObject({
      kind: "failed_undercut",
      question: "Why didn't Norris's undercut work?",
      followupQuestion: "Why didn't Norris's undercut on Russell work?",
    });
    expect(insight?.answer).toContain("1.231s");
    expect(insight?.answer).toContain("5.676s longer");
  });

  it("prefers a costly double-stack and refuses when no detector fires", () => {
    const stack = selectRaceCornerInsight({
      undercutFailures: [],
      safeStopCases: [],
      doubleStacks: [
        {
          teamId: 1,
          teamName: "Mercedes",
          lapNumber: 62,
          first: stop,
          second: { ...stop, driverId: 2, driverName: "Valtteri Bottas" },
          arrivalGapSeconds: 6.337,
          secondTransitTaxSeconds: 24.024,
        },
      ],
    });
    expect(stack?.kind).toBe("double_stack");
    expect(stack?.question).toBe("What did Mercedes' double-stack cost?");
    expect(stack?.answer).toContain("24.024s longer");
    expect(
      selectRaceCornerInsight({
        undercutFailures: [],
        safeStopCases: [],
        doubleStacks: [],
      }),
    ).toBeNull();
  });
});
