"use client";

import { useEffect, useRef } from "react";
import DriverHeadshot from "@/components/entities/DriverHeadshot";
import type { RaceClockController } from "@/hooks/useRaceClock";
import { gapLabel, teamTint } from "@/lib/consoleFormat";
import type { ConsoleCar } from "@/lib/queries/consoleReplay";
import { carKey } from "@/lib/raceClockMath";
import ConsolePanel, { PanelLabel } from "./ConsolePanel";

/** How many places the panel shows. The rest keep their rows and stay hidden. */
const VISIBLE_ROWS = 6;

type Row = {
  root: HTMLDivElement | null;
  position: HTMLSpanElement | null;
  gap: HTMLSpanElement | null;
};

export default function HomeRunningOrder({
  cars,
  clock,
  className = "",
}: {
  cars: ConsoleCar[];
  clock: RaceClockController;
  className?: string;
}) {
  const rowsRef = useRef(new Map<string, Row>());
  const lapRef = useRef<HTMLSpanElement | null>(null);
  const { subscribe } = clock;

  /* Rows are built once and reordered. Rebuilding the list every tick recreated
     every headshot, so the photos never finished downloading. */
  useEffect(() => {
    return subscribe((frame) => {
      frame.order.forEach((entry, index) => {
        const row = rowsRef.current.get(entry.key);
        if (!row?.root) return;
        row.root.style.order = String(index);
        row.root.hidden = index >= VISIBLE_ROWS;
        if (index >= VISIBLE_ROWS) return;
        if (row.position) row.position.textContent = String(index + 1);
        if (row.gap) {
          if (index === 0) {
            row.gap.textContent = "LEADER";
            row.gap.style.color = "var(--delta-faster)";
          } else {
            row.gap.style.color = "var(--ink-soft)";
            row.gap.textContent =
              entry.lapsBehind >= 1
                ? `+${entry.lapsBehind} ${entry.lapsBehind === 1 ? "LAP" : "LAPS"}`
                : gapLabel(entry.gapSeconds);
          }
        }
      });
      if (lapRef.current) lapRef.current.textContent = `Lap ${frame.lap}`;
    });
  }, [subscribe]);

  return (
    <ConsolePanel
      title="Running order"
      label={
        <PanelLabel>
          <span ref={lapRef} />
        </PanelLabel>
      }
      className={className}
      bodyClassName="flex flex-col"
    >
      {cars.map((car) => {
        const key = carKey(car);
        return (
          <div
            key={key}
            hidden
            ref={(node) => {
              const row = rowsRef.current.get(key) ?? {
                root: null,
                position: null,
                gap: null,
              };
              row.root = node;
              rowsRef.current.set(key, row);
            }}
            className="grid min-h-[38px] flex-1 grid-cols-[20px_30px_minmax(0,1fr)_auto] items-center gap-2.5 border-b border-line-soft/50 px-[11px] last:border-b-0 [&[hidden]]:hidden"
          >
            <span
              ref={(node) => {
                const row = rowsRef.current.get(key);
                if (row) row.position = node;
              }}
              className="text-right font-mono text-[11px] tabular-nums text-ink-faint"
            />
            <DriverHeadshot
              code={car.driver_code}
              fullName={car.full_name}
              src={car.headshot_url}
              size={30}
              shape="circle"
              bordered={false}
              focalY={0.12}
            />
            <span
              className="truncate text-[13px] font-semibold"
              style={{ color: teamTint(car.team_color) }}
            >
              {car.full_name}
            </span>
            <span
              ref={(node) => {
                const row = rowsRef.current.get(key);
                if (row) row.gap = node;
              }}
              className="font-mono text-[11px] tabular-nums text-ink-soft"
            />
          </div>
        );
      })}
    </ConsolePanel>
  );
}
