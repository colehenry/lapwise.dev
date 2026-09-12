"use client";

import { useEffect, useState } from "react";
import { countdown, localTime, nextRollover } from "@/lib/puzzleSchedule";

/** When the next game arrives, in the player's own clock.
 *
 *  Rendered only after mount: the answer depends on the browser's clock and
 *  timezone, which the server does not share. */
export default function NextGameNotice({ className }: { className?: string }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const tick = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(tick);
  }, []);

  if (!now) return null;
  const rollover = nextRollover(now);
  return (
    <p className={`text-xs text-ink-faint ${className ?? ""}`}>
      New game at <span className="text-ink-base">{localTime(rollover)}</span>
      <span aria-hidden="true"> · </span>
      <span className="sr-only">, </span>
      in {countdown(now, rollover)}
    </p>
  );
}
