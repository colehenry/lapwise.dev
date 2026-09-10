"use client";

import { useCallback, useMemo } from "react";
import type { RaceClockController } from "@/hooks/useRaceClock";

import type {
  ConsoleFeedEvent,
  ConsoleReplay,
} from "@/lib/queries/consoleReplay";
import { HIDDEN_FEED_KINDS, statusColor } from "./consoleStatus";

/** Enough to read as a running commentary without becoming a column. */
const VISIBLE = 4;

/**
 * What has just happened, newest first, sitting under the running order it
 * belongs to. Ordered by when it happened and labelled with the lap it happened
 * on, which is the number the rest of the console is counting in.
 */
export default function MapRaceFeed({
  replay,
  clock,
}: {
  replay: ConsoleReplay;
  clock: RaceClockController;
}) {
  const feedCount = clock.frame?.feedCount ?? 0;

  const visible: ConsoleFeedEvent[] = useMemo(
    () =>
      replay.feed
        .slice(0, feedCount)
        .filter((event) => !HIDDEN_FEED_KINDS.has(event.kind))
        .slice(-VISIBLE)
        .reverse(),
    [replay.feed, feedCount],
  );

  /* A line too long for the panel scrolls itself rather than ending in an
     ellipsis: these are short messages whose tail carries the detail — which
     driver, how long the stop was. Measured per row, so a line that fits does
     not move at all. */
  const measure = useCallback((node: HTMLSpanElement | null) => {
    if (!node) return;
    /* The line sizes itself to its text, so it never overflows *itself* — the
       clipping happens on the cell around it, which is what to measure. */
    const visible = node.parentElement?.clientWidth ?? 0;
    const overflow = node.scrollWidth - visible;
    node.style.setProperty("--roll", `${Math.max(0, overflow)}px`);
    node.classList.toggle("feed-roll", overflow > 2);
  }, []);

  if (visible.length === 0) return null;

  return (
    <div
      className="pointer-events-none flex w-full flex-col overflow-hidden rounded-sm border border-line-soft"
      style={{ background: "var(--glass-surface)" }}
    >
      {visible.map((event) => (
        <div
          key={`${event.t}-${event.text}`}
          className="grid grid-cols-[40px_7px_minmax(0,1fr)] items-center gap-1.5 overflow-hidden border-b border-line-soft/40 px-1.5 py-1 last:border-b-0"
        >
          <span className="font-mono text-[9px] uppercase tabular-nums text-ink-faint">
            Lap {event.lap}
          </span>
          <span
            className="h-[6px] w-[6px] rounded-full"
            style={{ background: statusColor(event.kind) }}
          />
          <span className="overflow-hidden">
            <span
              ref={measure}
              className="block w-max whitespace-nowrap text-[10.5px] leading-tight text-ink-base"
            >
              {event.text}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}
