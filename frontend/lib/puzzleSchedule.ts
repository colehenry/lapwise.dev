import type { PuzzleStatus } from "./adminTypes";

/** The board in play changes at 07:00 UTC. Mirrors PUZZLE_ROLLOVER_UTC_HOUR in
 *  `backend/app/services/daily_grid_service.py`, which is the authority. */
export const PUZZLE_ROLLOVER_UTC_HOUR = 7;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** The ISO date of the board in play `offsetDays` from now.
 *
 *  Derived in UTC against the rollover, never from the reviewer's calendar: a
 *  reviewer west of the meridian is already on the next UTC day for part of
 *  their evening, and dating a board from their local clock schedules it a day
 *  late. */
export function puzzleDate(offsetDays = 0, now: Date = new Date()): string {
  const shifted = new Date(
    now.getTime() - PUZZLE_ROLLOVER_UTC_HOUR * HOUR_MS + offsetDays * DAY_MS,
  );
  return shifted.toISOString().slice(0, 10);
}

/** When the board in play next changes. */
export function nextRollover(now: Date = new Date()): Date {
  const tomorrow = puzzleDate(1, now);
  return new Date(`${tomorrow}T0${PUZZLE_ROLLOVER_UTC_HOUR}:00:00Z`);
}

/** Where a board sits relative to the date gate.
 *
 *  `published` is not the same as live: the player service serves a board only
 *  once its date arrives, so a future-dated one is scheduled. */
export type PuzzlePhase = "draft" | "scheduled" | "live";

export function puzzlePhase(
  puzzle: { status: PuzzleStatus; published_on: string | null },
  now: Date = new Date(),
): PuzzlePhase {
  if (puzzle.status === "draft") return "draft";
  if (puzzle.status !== "published" || !puzzle.published_on) return "scheduled";
  return puzzle.published_on <= puzzleDate(0, now) ? "live" : "scheduled";
}
