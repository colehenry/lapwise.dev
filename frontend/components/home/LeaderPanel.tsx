"use client";

import { useEffect, useRef } from "react";
import type { RaceClockController } from "@/hooks/useRaceClock";
import { integer, seconds3 } from "@/lib/consoleFormat";
import type { ConsoleReplay } from "@/lib/queries/consoleReplay";
import ConsolePanel, { PanelLabel } from "./ConsolePanel";
import LapTimeChart from "./LapTimeChart";

/** Label, then the value. Only channels the database actually holds. */
const READOUTS = [
  "Sector 1",
  "Sector 2",
  "Sector 3",
  "Lap",
  "Trap I1",
  "Trap I2",
  "Finish",
  "Straight",
] as const;

export default function LeaderPanel({
  replay,
  clock,
  className = "",
}: {
  replay: ConsoleReplay;
  clock: RaceClockController;
  className?: string;
}) {
  const valueRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const stintRef = useRef<HTMLSpanElement | null>(null);
  const { subscribe, frame } = clock;
  const leader = frame?.leader;

  useEffect(() => {
    return subscribe((next) => {
      const car = next.leader.car;
      const running = car.laps[next.leader.lapIndex];
      const done = car.laps[Math.max(0, next.leader.lapIndex - 1)] ?? running;
      const values = [
        seconds3(done?.s?.[0]),
        seconds3(done?.s?.[1]),
        seconds3(done?.s?.[2]),
        seconds3(done?.t),
        integer(done?.v?.[0]),
        integer(done?.v?.[1]),
        integer(done?.v?.[2]),
        integer(done?.v?.[3]),
      ];
      values.forEach((value, index) => {
        const element = valueRefs.current[index];
        if (!element) return;
        element.textContent = value;
      });
      const lapValue = valueRefs.current[3];
      if (lapValue) {
        lapValue.style.color = done?.pb
          ? "var(--status-fastest)"
          : "var(--ink-strong)";
      }
      if (stintRef.current) {
        stintRef.current.textContent = running
          ? `${running.c} · ${running.age ?? "?"} laps`
          : "—";
      }
    });
  }, [subscribe]);

  if (!leader) return null;

  return (
    <ConsolePanel
      title={
        <h2 className="m-0 truncate text-[14px] font-bold tracking-[-0.01em] text-ink-strong">
          Leader · {leader.car.driver_code ?? leader.car.full_name}
        </h2>
      }
      label={<PanelLabel>Lap time by lap · real record</PanelLabel>}
      className={className}
      bodyClassName="grid grid-cols-1 gap-px bg-line-soft lg:grid-cols-[minmax(0,1fr)_286px]"
    >
      <div className="flex min-h-[120px] min-w-0 flex-col overflow-hidden bg-surface-panel px-3 py-[9px]">
        <LapTimeChart car={leader.car} clock={clock} />
      </div>
      <div className="grid min-w-0 grid-cols-4 content-start gap-x-2.5 gap-y-[11px] overflow-hidden bg-surface-panel px-3 py-[9px]">
        {READOUTS.map((label, index) => (
          <div key={label} className="min-w-0">
            <span className="block font-mono text-[8px] uppercase tracking-[0.1em] text-ink-faint">
              {label}
            </span>
            <span
              ref={(node) => {
                valueRefs.current[index] = node;
              }}
              className="mt-0.5 block truncate font-mono text-[13px] tabular-nums text-ink-strong"
            />
          </div>
        ))}
        <div className="col-span-4 min-w-0">
          <span className="block font-mono text-[8px] uppercase tracking-[0.1em] text-ink-faint">
            Stint
          </span>
          <span
            ref={stintRef}
            className="mt-0.5 block truncate font-mono text-[13px] tabular-nums text-ink-strong"
          />
        </div>
        <p className="col-span-4 m-0 mt-1 font-mono text-[8px] uppercase tracking-[0.1em] text-ink-faint">
          {replay.fastest_lap
            ? `Fastest lap ${seconds3(replay.fastest_lap.seconds)} · ${replay.fastest_lap.driver_code ?? "—"}`
            : "No fastest lap recorded"}
        </p>
      </div>
    </ConsolePanel>
  );
}
