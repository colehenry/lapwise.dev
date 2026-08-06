import { describe, expect, it } from "vitest";
import type { GameDriver } from "@/lib/queries/dailyGrid";
import { deriveGridProgress, type GridAttempt } from "./useDailyGridProgress";

const hamilton: GameDriver = {
  driver_slug: "hamilton",
  full_name: "Lewis Hamilton",
  driver_code: "HAM",
  headshot_url: null,
};

const attempts: GridAttempt[] = [
  { cellId: "ferrari__winner", correct: false, driver: hamilton },
  { cellId: "ferrari__mclaren", correct: true, driver: hamilton },
];

describe("daily grid progress", () => {
  it("locks only correctly placed drivers", () => {
    const progress = deriveGridProgress(attempts);

    expect(progress.placedDriverSlugs).toEqual(new Set(["hamilton"]));
    expect(progress.filledCells.has("ferrari__winner")).toBe(false);
    expect(progress.filledCells.get("ferrari__mclaren")).toEqual(hamilton);
  });

  it("keeps incorrect guesses attached to their cell", () => {
    const progress = deriveGridProgress(attempts);

    expect(progress.missesByCell.get("ferrari__winner")).toEqual([hamilton]);
    expect(progress.missesByCell.has("ferrari__mclaren")).toBe(false);
  });
});
