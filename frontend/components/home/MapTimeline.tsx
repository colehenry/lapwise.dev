"use client";

import { useEffect, useMemo, useRef } from "react";
import type { RaceClockController } from "@/hooks/useRaceClock";
import { sessionClock } from "@/lib/consoleFormat";
import type { ConsoleReplay } from "@/lib/queries/consoleReplay";
import { statusColor } from "./consoleStatus";

/** Only the non-green stretches are worth colouring in. */
const FLAGGED = new Set(["yellow", "sc", "vsc", "red"]);

/**
 * Where the replay has got to, and what the race was doing along the way.
 *
 * The bar spans the session from the first lap start to the last, with the
 * flagged stretches drawn in place — so a red flag reads as a period rather
 * than as a chip that appears and disappears.
 */
export default function MapTimeline({
  replay,
  clock,
}: {
  replay: ConsoleReplay;
  clock: RaceClockController;
}) {
  const headRef = useRef<HTMLDivElement | null>(null);
  const { subscribe } = clock;

  const span = Math.max(1, replay.t_end - replay.t0);

  const windows = useMemo(
    () =>
      replay.status
        .filter((window) => FLAGGED.has(window.code))
        .map((window) => {
          const rawFrom = window.from - replay.t0;
          const rawTo = window.to - replay.t0;
          /* Track status is recorded across the whole session, so some windows
             sit entirely before the first lap start — pre-race yellows in the
             pit lane. Those belong to no part of this bar. */
          if (rawTo <= 0 || rawFrom >= span) return null;
          const from = Math.max(0, rawFrom);
          const to = Math.min(span, rawTo);
          return {
            key: `${window.code}-${window.from}`,
            code: window.code,
            label: window.label ?? window.code,
            when: `${sessionClock(from)} – ${sessionClock(to)}`,
            left: (from / span) * 100,
            // A brief yellow is still a real event; below this it reads as a
            // rounded dot rather than disappearing into the bar.
            width: Math.max(0.9, ((to - from) / span) * 100),
          };
        })
        .filter((window) => window !== null),
    [replay.status, replay.t0, span],
  );

  useEffect(() => {
    return subscribe((frame) => {
      const head = headRef.current;
      if (!head) return;
      const progress = Math.max(0, Math.min(1, frame.elapsed / span));
      head.style.left = `${(progress * 100).toFixed(2)}%`;
    });
  }, [subscribe, span]);

  return (
    <div className="pointer-events-none absolute inset-x-3 bottom-3">
      <div className="relative h-[6px] w-full rounded-full bg-surface-raised/60">
        {windows.map((window) => (
          <span
            key={window.key}
            /* A hair taller than the bar so a one-percent window is still
               catchable by a cursor. */
            className="group/flag pointer-events-auto absolute -inset-y-1 cursor-default"
            style={{ left: `${window.left}%`, width: `${window.width}%` }}
          >
            {/* Rounded and inset, so two adjacent windows read as two events
                rather than fusing into one ragged block. */}
            <span
              className="absolute inset-y-1 inset-x-[0.5px] rounded-full"
              style={{ background: statusColor(window.code) }}
            />
            <span
              className="pointer-events-none absolute bottom-[18px] left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-sm border border-line-soft px-2 py-1 group-hover/flag:block"
              style={{ background: "var(--glass-surface)" }}
            >
              <span className="block font-mono text-[9.5px] uppercase tracking-[0.12em] text-ink-strong">
                {window.label}
              </span>
              <span className="block font-mono text-[9px] tabular-nums text-ink-faint">
                {window.when}
              </span>
            </span>
          </span>
        ))}
      </div>
      <div
        ref={headRef}
        className="absolute -top-[4px] h-[14px] w-[3px] -translate-x-1/2 rounded-full bg-ink-strong shadow-[0_0_0_2px_var(--surface-page)]"
        style={{ left: "0%" }}
      />
    </div>
  );
}
