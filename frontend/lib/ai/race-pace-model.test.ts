import { describe, expect, it } from "vitest";
import type { NormalizedRaceLap } from "./race-evidence-quality";
import { fitRacePaceModel, predictRaceLapSeconds } from "./race-pace-model";

const COMPOUNDS = ["SOFT", "MEDIUM", "HARD"];
const OFFSETS: Record<string, number> = { SOFT: -0.2, MEDIUM: 0, HARD: 0.15 };
const DEGRADATION: Record<string, number> = {
  SOFT: 0.08,
  MEDIUM: 0.05,
  HARD: 0.03,
};

function syntheticRace(): NormalizedRaceLap[] {
  const laps: NormalizedRaceLap[] = [];
  for (let driverId = 1; driverId <= 8; driverId += 1) {
    for (let lapNumber = 3; lapNumber <= 50; lapNumber += 1) {
      const stint = Math.floor((lapNumber - 3) / 8) + 1;
      const tyreLife = ((lapNumber - 3) % 8) + 1;
      const compound = COMPOUNDS[(driverId + stint) % COMPOUNDS.length];
      const noise = Math.sin(driverId * 17 + lapNumber * 11) * 0.025;
      laps.push({
        driverId,
        driverCode: `D${driverId}`,
        driverName: `Driver ${driverId}`,
        teamId: Math.ceil(driverId / 2),
        teamName: `Team ${Math.ceil(driverId / 2)}`,
        lapNumber,
        position: driverId,
        lapTimeSeconds:
          90 +
          driverId * 0.12 -
          0.05 * lapNumber +
          OFFSETS[compound] +
          DEGRADATION[compound] * tyreLife +
          noise,
        lapStartTimeSeconds: lapNumber * 90 + driverId,
        pitInTimeSeconds: null,
        pitOutTimeSeconds: null,
        stint,
        compound,
        tyreLife,
        trackStatus: "1",
        isAccurate: true,
        isDeleted: false,
      });
    }
  }
  return laps;
}

describe("race pace model", () => {
  it("accepts a stable supported fit and preserves physical coefficients", () => {
    const laps = syntheticRace();
    const model = fitRacePaceModel(laps);

    expect(model.quality.usable).toBe(true);
    expect(model.quality.rmseSeconds).toBeLessThan(0.05);
    expect(model.quality.bootstrapSamples).toBeGreaterThanOrEqual(12);
    expect(model.coefficients?.fuelSlopeSecondsPerLap).toBeCloseTo(-0.05, 2);
    expect(model.coefficients?.degradationSecondsPerLap.MEDIUM).toBeCloseTo(
      0.05,
      2,
    );
    expect(predictRaceLapSeconds(model, laps[0])).not.toBeNull();
  });

  it("withholds a fit that lacks supported drivers and compounds", () => {
    const model = fitRacePaceModel(syntheticRace().slice(0, 20));

    expect(model.quality.usable).toBe(false);
    expect(model.quality.rejectionReasons).toContain(
      "fewer than 80 supported clean laps",
    );
  });
});
