import { describe, expect, it } from "vitest";
import type { ConsoleCar, ConsoleReplay } from "./queries/consoleReplay";
import {
  buildFrame,
  feedCountAt,
  frameSignature,
  openingTime,
  pointAt,
  progressAt,
  skipStoppages,
  statusAt,
  timeAtProgress,
} from "./raceClockMath";

function car(overrides: Partial<ConsoleCar> = {}): ConsoleCar {
  return {
    driver_code: "VER",
    full_name: "Max Verstappen",
    team_name: "Red Bull Racing",
    team_color: "3671C6",
    headshot_url: null,
    final_position: 1,
    start: [100, 200, 300, 400],
    end: 500,
    laps: [
      { t: 100, c: "M", age: 1, s: [], v: [], pos: 1, pit: 0, pb: 0 },
      { t: null, c: "M", age: 2, s: [], v: [], pos: 1, pit: 0, pb: 0 },
      { t: null, c: "S", age: 1, s: [], v: [], pos: 1, pit: 1, pb: 0 },
      { t: 95, c: "S", age: 2, s: [], v: [], pos: 1, pit: 0, pb: 0 },
    ],
    ...overrides,
  };
}

describe("progressAt", () => {
  it("reads the clock off lap starts, so null lap times do not truncate a car", () => {
    const subject = car();
    // Laps two and three have no recorded time; a loop that summed lap times
    // would stop here.
    expect(progressAt(subject, 350)).toBeCloseTo(2.5, 5);
    expect(progressAt(subject, 450)).toBeCloseTo(3.5, 5);
  });

  it("is zero before the first lap start and complete once the car is done", () => {
    const subject = car();
    expect(progressAt(subject, 50)).toBe(0);
    expect(progressAt(subject, 100)).toBe(0);
    expect(progressAt(subject, 500)).toBe(4);
    expect(progressAt(subject, 9999)).toBe(4);
  });

  it("inverts through timeAtProgress", () => {
    const subject = car();
    expect(timeAtProgress(subject, 2.5)).toBeCloseTo(350, 5);
    expect(timeAtProgress(subject, progressAt(subject, 275))).toBeCloseTo(
      275,
      5,
    );
  });
});

describe("skipStoppages", () => {
  it("jumps a stoppage window rather than sitting still inside it", () => {
    expect(skipStoppages(3700, [[3636, 5514.9]])).toBe(5514.9);
  });

  it("leaves a time outside every window alone", () => {
    expect(skipStoppages(3000, [[3636, 5514.9]])).toBe(3000);
    expect(skipStoppages(6000, [[3636, 5514.9]])).toBe(6000);
  });
});

describe("pointAt", () => {
  const line = [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
  ];

  it("wraps at a lap boundary", () => {
    expect(pointAt(line, 0)).toEqual(pointAt(line, 3));
  });

  it("returns null without geometry", () => {
    expect(pointAt([], 0.5)).toBeNull();
  });
});

function replay(overrides: Partial<ConsoleReplay> = {}): ConsoleReplay {
  return {
    event_name: "Test",
    circuit_id: 1,
    circuit_name: "Test",
    date: "2026-01-01",
    total_laps: 4,
    t0: 100,
    t_end: 500,
    lead_changes: 0,
    fastest_lap: null,
    skips: [],
    status: [{ from: 210, to: 300, code: "red", label: "Red flag" }],
    cars: [
      car(),
      car({ driver_code: "HAM", start: [102, 204, 306, 408], end: 505 }),
    ],
    feed: [
      { t: 150, lap: 1, kind: "pit", text: "one", driver_code: null },
      { t: 260, lap: 2, kind: "red", text: "two", driver_code: null },
      { t: 460, lap: 4, kind: "fast", text: "three", driver_code: null },
    ],
    ...overrides,
  };
}

describe("buildFrame", () => {
  it("orders by progress and measures gaps against the leader", () => {
    const frame = buildFrame(replay(), 350);
    expect(frame?.order.map((entry) => entry.key)).toEqual(["VER", "HAM"]);
    expect(frame?.leader.gapSeconds).toBeNull();
    expect(frame?.order[1].gapSeconds).toBeGreaterThan(0);
  });

  it("reports the flag that is actually out at that instant", () => {
    expect(buildFrame(replay(), 260)?.status?.code).toBe("red");
    expect(buildFrame(replay(), 320)?.status).toBeNull();
  });

  it("cuts the feed at the current instant", () => {
    expect(buildFrame(replay(), 260)?.feedCount).toBe(2);
    expect(buildFrame(replay(), 100)?.feedCount).toBe(0);
  });

  it("returns nothing when the payload carries no cars", () => {
    expect(buildFrame(replay({ cars: [] }), 300)).toBeNull();
  });
});

describe("frameSignature", () => {
  it("is unchanged while only positions move", () => {
    const a = buildFrame(replay(), 340);
    const b = buildFrame(replay(), 345);
    expect(a && b && frameSignature(a)).toBe(b && frameSignature(b));
  });

  it("changes when the lap advances", () => {
    const a = buildFrame(replay(), 340);
    const b = buildFrame(replay(), 420);
    expect(a && b && frameSignature(a)).not.toBe(b && frameSignature(b));
  });
});

describe("openingTime", () => {
  it("opens a third of the way in, with the whole field under way", () => {
    expect(openingTime(replay())).toBe(204);
  });

  it("falls back to the session start with no lap starts to read", () => {
    expect(openingTime(replay({ cars: [car({ start: [] })] }))).toBe(100);
  });
});

describe("statusAt and feedCountAt", () => {
  it("treats a window as closed at its end", () => {
    expect(statusAt(replay().status, 300)).toBeNull();
    expect(statusAt(replay().status, 299)).not.toBeNull();
  });

  it("counts every event at or before the instant", () => {
    expect(feedCountAt(replay(), 460)).toBe(3);
    expect(feedCountAt(replay(), 459)).toBe(2);
  });
});
