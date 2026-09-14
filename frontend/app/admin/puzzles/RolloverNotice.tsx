"use client";

import { useEffect, useState } from "react";
import {
  countdown,
  localTime,
  nextRollover,
  PUZZLE_ROLLOVER_UTC_HOUR,
  puzzleDate,
} from "@/lib/puzzleSchedule";

/** The date gate, spelled out. Dates here are the board's UTC day, which is
 *  not the reviewer's day for part of every evening west of the meridian, so
 *  the day in play is stated rather than left to be inferred from a calendar. */
export default function RolloverNotice() {
  // Held in state so the server render and the first paint agree: the answer
  // depends on the clock, which the server does not share with the browser.
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const tick = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(tick);
  }, []);

  if (!now) return null;
  const rollover = nextRollover(now);

  return (
    <p className="text-sm text-ink-faint">
      <span className="text-ink-base">Playing now: {puzzleDate(0, now)}</span> ·
      next board takes over at 0{PUZZLE_ROLLOVER_UTC_HOUR}:00 UTC (
      {localTime(rollover)} local), in {countdown(now, rollover)}
    </p>
  );
}
