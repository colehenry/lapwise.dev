import { describe, expect, it } from "vitest";
import type { NormalizedRaceLap } from "./race-evidence-quality";
import { findSafeStopCases } from "./race-stop-loss";
import {
  extractPitTransitEvents,
  findDoubleStacks,
  findUndercutFailures,
  type PitTransitEvent,
} from "./race-strategy-events";

function lap(params: {
  driverId: number;
  lapNumber: number;
  position: number;
  lapTime?: number;
  lapStart?: number;
  pitIn?: number;
  pitOut?: number;
}): NormalizedRaceLap {
  const code =
    params.driverId === 1 ? "NOR" : params.driverId === 2 ? "RUS" : "ALB";
  return {
    driverId: params.driverId,
    driverCode: code,
    driverName: code,
    teamId: params.driverId,
    teamName: `Team ${params.driverId}`,
    lapNumber: params.lapNumber,
    position: params.position,
    lapTimeSeconds: params.lapTime ?? 100,
    lapStartTimeSeconds: params.lapStart ?? params.lapNumber * 100,
    pitInTimeSeconds: params.pitIn ?? null,
    pitOutTimeSeconds: params.pitOut ?? null,
    stint: params.lapNumber < 11 ? 1 : 2,
    compound: params.lapNumber < 11 ? "SOFT" : "MEDIUM",
    tyreLife: params.lapNumber,
    trackStatus: "1",
    isAccurate: true,
    isDeleted: false,
  };
}

function bahrainUndercutLaps(): NormalizedRaceLap[] {
  const laps: NormalizedRaceLap[] = [];
  for (let lapNumber = 1; lapNumber <= 15; lapNumber += 1) {
    laps.push(
      lap({
        driverId: 1,
        lapNumber,
        position: 2,
        lapTime: lapNumber === 12 ? 97.867 : 100,
        lapStart:
          lapNumber === 10
            ? 1000.975
            : lapNumber === 15
              ? 1503.132
              : lapNumber * 100 + 1,
        pitIn: lapNumber === 10 ? 1000 : undefined,
        pitOut: lapNumber === 11 ? 1029.615 : undefined,
      }),
      lap({
        driverId: 2,
        lapNumber,
        position: 1,
        lapTime: lapNumber === 12 ? 99.098 : 100,
        lapStart: lapNumber * 100,
        pitIn: lapNumber === 13 ? 1300 : undefined,
        pitOut: lapNumber === 14 ? 1323.939 : undefined,
      }),
    );
  }
  return laps;
}

describe("race strategy event detection", () => {
  it("decomposes a failed undercut without inventing pit-crew time", () => {
    const laps = bahrainUndercutLaps();
    const stops = extractPitTransitEvents(laps);
    const failures = findUndercutFailures(laps, stops);

    expect(failures).toHaveLength(1);
    expect(failures[0].comparedNewTyreLaps).toBe(1);
    expect(failures[0].gapBeforeSeconds).toBeCloseTo(0.975, 3);
    expect(failures[0].gapAfterSeconds).toBeCloseTo(3.132, 3);
    expect(failures[0].newTyreGainSeconds).toBeCloseTo(1.231, 3);
    expect(failures[0].transitDeltaSeconds).toBeCloseTo(5.676, 3);
  });

  it("measures the second car's double-stack transit tax", () => {
    const base: PitTransitEvent = {
      driverId: 1,
      driverCode: "RUS",
      driverName: "George Russell",
      teamId: 7,
      teamName: "Mercedes",
      inLap: 62,
      outLap: 63,
      pitInTimeSeconds: 1000,
      pitOutTimeSeconds: 1028.807,
      transitSeconds: 28.807,
      beforeCompound: "MEDIUM",
      afterCompound: "HARD",
      underNeutralization: false,
    };
    const stacks = findDoubleStacks([
      base,
      {
        ...base,
        driverId: 2,
        driverCode: "BOT",
        driverName: "Valtteri Bottas",
        pitInTimeSeconds: 1006.337,
        pitOutTimeSeconds: 1059.168,
        transitSeconds: 52.831,
      },
    ]);

    expect(stacks).toHaveLength(1);
    expect(stacks[0].arrivalGapSeconds).toBeCloseTo(6.337, 3);
    expect(stacks[0].secondTransitTaxSeconds).toBeCloseTo(24.024, 3);
  });

  it("compares a position gap with the modeled stop-loss distribution", () => {
    const laps = [
      lap({ driverId: 1, lapNumber: 47, position: 8 }),
      lap({ driverId: 3, lapNumber: 47, position: 9 }),
      lap({ driverId: 1, lapNumber: 48, position: 8, lapStart: 4800 }),
      lap({ driverId: 3, lapNumber: 48, position: 9, lapStart: 4833.393 }),
      lap({ driverId: 1, lapNumber: 49, position: 8 }),
    ];
    const stops: PitTransitEvent[] = [
      {
        driverId: 1,
        driverCode: "NOR",
        driverName: "Lando Norris",
        teamId: 1,
        teamName: "McLaren",
        inLap: 48,
        outLap: 49,
        pitInTimeSeconds: 4800,
        pitOutTimeSeconds: 4822,
        transitSeconds: 22,
        beforeCompound: "MEDIUM",
        afterCompound: "SOFT",
        underNeutralization: false,
      },
    ];
    const cases = findSafeStopCases(laps, stops, {
      sampleCount: 10,
      lowerQuartileSeconds: 21.5,
      medianSeconds: 22.34,
      upperQuartileSeconds: 23.1,
      samples: [],
    });

    expect(cases[0].gapBehindSeconds).toBeCloseTo(33.393, 3);
    expect(cases[0].bufferSeconds).toBeCloseTo(11.053, 3);
    expect(cases[0].retainedPosition).toBe(true);
  });
});
