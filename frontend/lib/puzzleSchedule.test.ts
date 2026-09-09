import { describe, expect, it } from "vitest";

import { nextRollover, puzzleDate, puzzlePhase } from "./puzzleSchedule";

/** 17:27 US Pacific on 8 September, which is already 9 September in UTC. */
const PACIFIC_EVENING = new Date("2026-09-09T00:27:00Z");

describe("puzzleDate", () => {
  it("stays on the board's day through a reviewer's evening", () => {
    expect(puzzleDate(0, PACIFIC_EVENING)).toBe("2026-09-08");
    expect(puzzleDate(1, PACIFIC_EVENING)).toBe("2026-09-09");
  });

  it("advances at 07:00 UTC, not at midnight UTC", () => {
    expect(puzzleDate(0, new Date("2026-09-09T06:59:00Z"))).toBe("2026-09-08");
    expect(puzzleDate(0, new Date("2026-09-09T07:00:00Z"))).toBe("2026-09-09");
  });
});

describe("nextRollover", () => {
  it("points at the next 07:00 UTC", () => {
    expect(nextRollover(PACIFIC_EVENING).toISOString()).toBe(
      "2026-09-09T07:00:00.000Z",
    );
    expect(nextRollover(new Date("2026-09-09T07:00:00Z")).toISOString()).toBe(
      "2026-09-10T07:00:00.000Z",
    );
  });
});

describe("puzzlePhase", () => {
  const at = (
    status: "draft" | "approved" | "published",
    date: string | null,
  ) => puzzlePhase({ status, published_on: date }, PACIFIC_EVENING);

  it("calls a published board live only once its date has arrived", () => {
    expect(at("published", "2026-09-08")).toBe("live");
    expect(at("published", "2026-09-07")).toBe("live");
    expect(at("published", "2026-09-09")).toBe("scheduled");
  });

  it("never calls an unpublished board live", () => {
    expect(at("draft", "2026-09-08")).toBe("draft");
    expect(at("approved", "2026-09-08")).toBe("scheduled");
    expect(at("published", null)).toBe("scheduled");
  });
});
