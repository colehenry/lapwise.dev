"use client";

import { useEffect, useState } from "react";
import type { RaceClockController } from "@/hooks/useRaceClock";
import { lapTag } from "@/lib/consoleFormat";
import type {
  ConsoleFeedEvent,
  ConsoleReplay,
} from "@/lib/queries/consoleReplay";
import { HIDDEN_FEED_KINDS, statusColor } from "./consoleStatus";

/** Wall-clock seconds a line holds before it fades, regardless of replay rate. */
const HOLD_MS = 6000;

/**
 * The newest thing that has happened, one line at a time. A stacked feed was a
 * column of its own; this keeps the narrative without spending a panel on it.
 */
export default function MapFeedToast({
  replay,
  clock,
}: {
  replay: ConsoleReplay;
  clock: RaceClockController;
}) {
  const feedCount = clock.frame?.feedCount ?? 0;
  const [shown, setShown] = useState<ConsoleFeedEvent | null>(null);

  useEffect(() => {
    const latest = replay.feed
      .slice(0, feedCount)
      .filter((event) => !HIDDEN_FEED_KINDS.has(event.kind))
      .at(-1);
    if (!latest) {
      setShown(null);
      return;
    }
    setShown(latest);
    const timer = setTimeout(() => setShown(null), HOLD_MS);
    return () => clearTimeout(timer);
  }, [replay.feed, feedCount]);

  if (!shown) return null;

  return (
    <output
      aria-live="polite"
      className="animate-fadeIn absolute bottom-3 right-3 flex max-w-[min(420px,60%)] items-center gap-2.5 rounded-sm border border-line-soft px-3 py-2"
      style={{ background: "var(--glass-surface)" }}
    >
      <span className="font-mono text-[9.5px] tabular-nums text-ink-faint">
        {lapTag(shown.lap)}
      </span>
      <span
        className="h-[7px] w-[7px] flex-none rounded-full"
        style={{ background: statusColor(shown.kind) }}
      />
      <span className="truncate text-[12.5px] text-ink-base">{shown.text}</span>
    </output>
  );
}
