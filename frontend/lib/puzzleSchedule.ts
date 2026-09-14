/** The board in play changes at 07:00 UTC. Mirrors PUZZLE_ROLLOVER_UTC_HOUR in
 *  `backend/app/services/daily_game_clock.py`, which is the authority. */
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

/** Where a puzzle sits relative to the date gate.
 *
 *  The date is the whole state: undated is a draft, dated is scheduled, and
 *  dated on or before today is live. */
export type PuzzlePhase = "draft" | "scheduled" | "live";

export function puzzlePhase(
  puzzle: { status: string; published_on: string | null },
  now: Date = new Date(),
): PuzzlePhase {
  if (puzzle.status === "draft" || !puzzle.published_on) return "draft";
  return puzzle.published_on <= puzzleDate(0, now) ? "live" : "scheduled";
}

/** "Today", "Tomorrow", or "Thu 17 Sep", relative to the board day in play. */
export function formatDay(iso: string, now: Date = new Date()): string {
  if (iso === puzzleDate(0, now)) return "Today";
  if (iso === puzzleDate(1, now)) return "Tomorrow";
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function addDays(iso: string, days: number): string {
  const shifted = new Date(`${iso}T12:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

/** Every day from today through the last scheduled one, plus one open day
 *  after it, so the run always shows where the next puzzle will land. */
export function upcomingDays(
  lastScheduled: string | null,
  now: Date = new Date(),
): string[] {
  const today = puzzleDate(0, now);
  const last = lastScheduled && lastScheduled > today ? lastScheduled : today;
  const days: string[] = [];
  for (let day = today; day <= last; day = addDays(day, 1)) days.push(day);
  days.push(addDays(last, 1));
  return days;
}

/** "4h 12m" or "37m" until `to`. */
export function countdown(from: Date, to: Date): string {
  const minutes = Math.max(
    0,
    Math.round((to.getTime() - from.getTime()) / 60000),
  );
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}

/** The rollover as a local wall-clock time, e.g. "3:00 AM". */
export function localTime(at: Date): string {
  return at.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}
