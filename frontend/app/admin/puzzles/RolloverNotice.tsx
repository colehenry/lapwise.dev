"use client";

import { useEffect, useState } from "react";
import {
  nextRollover,
  PUZZLE_ROLLOVER_UTC_HOUR,
  puzzleDate,
} from "@/lib/puzzleSchedule";

function countdown(from: Date, to: Date): string {
  const minutes = Math.max(
    0,
    Math.round((to.getTime() - from.getTime()) / 60000),
  );
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}

function localTime(at: Date): string {
  return at.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

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
    <p className="text-sm text-text-muted">
      <span className="text-text-secondary">
        Playing now: {puzzleDate(0, now)}
      </span>{" "}
      · next board takes over at 0{PUZZLE_ROLLOVER_UTC_HOUR}:00 UTC (
      {localTime(rollover)} local), in {countdown(now, rollover)}
    </p>
  );
}
