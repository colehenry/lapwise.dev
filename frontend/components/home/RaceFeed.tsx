"use client";

import { useMemo } from "react";
import type { RaceClockController } from "@/hooks/useRaceClock";
import { lapTag, sessionClock } from "@/lib/consoleFormat";
import type {
  ConsoleFeedEvent,
  ConsoleReplay,
} from "@/lib/queries/consoleReplay";
import ConsolePanel, { PanelLabel } from "./ConsolePanel";
import { HIDDEN_FEED_KINDS, statusColor } from "./consoleStatus";

const VISIBLE_ROWS = 6;

export default function RaceFeed({
  replay,
  clock,
  className = "",
}: {
  replay: ConsoleReplay;
  clock: RaceClockController;
  className?: string;
}) {
  const frame = clock.frame;
  const feedCount = frame?.feedCount ?? 0;
  const lap = frame?.lap ?? 1;

  const visible: ConsoleFeedEvent[] = useMemo(
    () =>
      replay.feed
        .slice(0, feedCount)
        .filter((event) => !HIDDEN_FEED_KINDS.has(event.kind))
        .slice(-VISIBLE_ROWS)
        .reverse(),
    [replay.feed, feedCount],
  );

  return (
    <ConsolePanel
      title="Race feed"
      label={
        <PanelLabel>
          {frame ? `Lap ${lap} · ${sessionClock(frame.elapsed)}` : ""}
        </PanelLabel>
      }
      className={className}
      bodyClassName="flex flex-col"
    >
      {visible.length === 0 ? (
        <p className="flex flex-1 items-center px-3 text-[12.5px] text-ink-soft">
          Green flag — nothing reported through lap {lap}.
        </p>
      ) : (
        visible.map((event) => (
          <div
            key={`${event.t}-${event.text}`}
            className="grid min-h-[30px] flex-1 grid-cols-[26px_8px_minmax(0,1fr)] items-center gap-[9px] border-b border-line-soft/45 px-3 last:border-b-0"
          >
            <span className="font-mono text-[9.5px] tracking-[0.06em] tabular-nums text-ink-faint">
              {event.lap ? lapTag(event.lap) : "—"}
            </span>
            <span
              className="h-[7px] w-[7px] rounded-full"
              style={{ background: statusColor(event.kind) }}
            />
            <span className="truncate text-[12.5px] leading-[1.35] text-ink-base">
              {event.text}
            </span>
          </div>
        ))
      )}
    </ConsolePanel>
  );
}
