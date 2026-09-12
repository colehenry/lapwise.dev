import { describe, expect, it } from "vitest";
import {
  evaluateRaceDataCoverage,
  finiteNumber,
  normalizeRaceLaps,
} from "./race-evidence-quality";

describe("race evidence quality", () => {
  it("treats PostgreSQL NaN and other non-finite values as missing", () => {
    expect(finiteNumber("NaN")).toBeNull();
    expect(finiteNumber(Number.NaN)).toBeNull();
    expect(finiteNumber(Number.POSITIVE_INFINITY)).toBeNull();
    expect(finiteNumber("91.234")).toBe(91.234);

    const laps = normalizeRaceLaps([
      {
        driver_id: 1,
        driver_code: "NOR",
        full_name: "Lando Norris",
        lap_number: 1,
        lap_time_seconds: "NaN",
        pit_in_time_seconds: "NaN",
      },
    ]);
    expect(laps[0].lapTimeSeconds).toBeNull();
    expect(laps[0].pitInTimeSeconds).toBeNull();
  });

  it("refuses model and pit claims when coverage is sparse", () => {
    const laps = normalizeRaceLaps([
      {
        driver_id: 1,
        driver_code: "NOR",
        full_name: "Lando Norris",
        lap_number: 3,
        lap_time_seconds: 90,
        compound: "MEDIUM",
        tyre_life: 3,
        stint: 1,
        is_accurate: true,
        deleted: false,
        track_status: "1",
      },
    ]);
    const coverage = evaluateRaceDataCoverage(laps);

    expect(coverage.supportsPaceModel).toBe(false);
    expect(coverage.supportsPitStrategy).toBe(false);
    expect(coverage.limitations).toEqual(
      expect.arrayContaining([
        "Rich tyre and stint coverage is too sparse.",
        "There are too few complete pit entry/exit markers.",
      ]),
    );
  });

  it("counts back-to-back stops when one lap has both pit markers", () => {
    const rows = [
      { lap_number: 1, pit_in_time_seconds: 100 },
      {
        lap_number: 2,
        pit_out_time_seconds: 125,
        pit_in_time_seconds: 190,
      },
      { lap_number: 3, pit_out_time_seconds: 215 },
    ].map((row) => ({
      ...row,
      driver_id: 1,
      driver_code: "RUS",
      full_name: "George Russell",
    }));

    expect(
      evaluateRaceDataCoverage(normalizeRaceLaps(rows)).completePitMarkers,
    ).toBe(2);
  });
});
