import { describe, expect, it } from "vitest";
import { calculateRaceDynamics } from "./race-dynamics-calculation";

const results = [
  {
    driver_id: 1,
    driver_code: "HAM",
    full_name: "Lewis Hamilton",
    position: 1,
    grid_position: 2,
  },
  {
    driver_id: 2,
    driver_code: "VER",
    full_name: "Max Verstappen",
    position: 2,
    grid_position: 1,
  },
];

function lap(
  driverId: number,
  lapNumber: number,
  position: number,
  extra: Record<string, unknown> = {},
) {
  return {
    driver_id: driverId,
    driver_code: driverId === 1 ? "HAM" : "VER",
    full_name: driverId === 1 ? "Lewis Hamilton" : "Max Verstappen",
    lap_number: lapNumber,
    position,
    stint: lapNumber < 3 ? 1 : 2,
    compound: lapNumber < 3 ? "MEDIUM" : "HARD",
    lap_time_seconds: 90 + driverId + lapNumber,
    is_accurate: true,
    deleted: false,
    track_status: lapNumber === 2 ? "4" : "1",
    ...extra,
  };
}

describe("race dynamics calculation", () => {
  it("derives leader, neutralization, position, stint, and stop evidence", () => {
    const evidence = calculateRaceDynamics({
      sessionId: 79,
      results,
      laps: [
        lap(1, 1, 2),
        lap(2, 1, 1),
        lap(1, 2, 1, { pit_in_time_seconds: 120 }),
        lap(2, 2, 2),
        lap(1, 3, 1, { pit_out_time_seconds: 150 }),
        lap(2, 3, 2),
      ],
      raceControl: [{ lap_number: 2, message: "SAFETY CAR DEPLOYED" }],
    });

    expect(evidence.leaderTimeline).toEqual(["L1 VER", "L2-L3 HAM"]);
    expect(evidence.lapsLed).toEqual({ HAM: 2, VER: 1 });
    expect(evidence.neutralizedLaps.safetyCar).toEqual(["L2"]);
    expect(evidence.positionPaths[0]).toMatchObject({
      driverCode: "HAM",
      grid: 2,
      lap1: 2,
      finish: 1,
      firstP1Lap: 2,
    });
    expect(evidence.pitStops[0]).toEqual({
      driverCode: "HAM",
      lapRange: "L2-L3",
      inLap: 2,
      outLap: 3,
      compound: "HARD",
      underScOrVsc: true,
    });
    expect(evidence.stintSummaries).toContainEqual(
      expect.objectContaining({
        driverCode: "HAM",
        stint: 1,
        startLap: 1,
        endLap: 2,
        medianCleanLapSeconds: 92,
      }),
    );
    expect(evidence.pitStops[0]).not.toHaveProperty("durationSeconds");
  });
});
