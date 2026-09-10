"use client";

import { useEffect, useRef } from "react";
import DriverHeadshot from "@/components/entities/DriverHeadshot";
import type { RaceClockController } from "@/hooks/useRaceClock";
import { useTeamTint } from "@/hooks/useTeamTint";
import { gapLabel } from "@/lib/consoleFormat";
import { compoundFromInitial, getCompoundColor } from "@/lib/palette";
import type { ConsoleCar } from "@/lib/queries/consoleReplay";
import { carKey } from "@/lib/raceClockMath";

/** Broadcast convention: the top five, and the leader's gap reads LEADER. */
const VISIBLE_ROWS = 5;

type Row = {
  root: HTMLDivElement | null;
  position: HTMLSpanElement | null;
  gap: HTMLSpanElement | null;
  tyre: HTMLSpanElement | null;
  compound: HTMLSpanElement | null;
};

/**
 * Rides the top-left of the map the way a television graphic does. Rows are
 * built once and reordered with `style.order`; rebuilding the list every tick
 * recreated every headshot, so the photos never finished downloading.
 */
export default function MapRunningOrder({
  cars,
  clock,
}: {
  cars: ConsoleCar[];
  clock: RaceClockController;
}) {
  const tint = useTeamTint();
  const rowsRef = useRef(new Map<string, Row>());
  const { subscribe } = clock;

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
          row.gap.textContent =
            index === 0
              ? "LEADER"
              : entry.lapsBehind >= 1
                ? `+${entry.lapsBehind} ${entry.lapsBehind === 1 ? "LAP" : "LAPS"}`
                : gapLabel(entry.gapSeconds);
          row.gap.style.color =
            index === 0 ? "var(--delta-faster)" : "var(--ink-base)";
        }

        const lap = entry.car.laps[entry.lapIndex];
        if (row.tyre) row.tyre.textContent = lap ? String(lap.age ?? "") : "";
        if (row.compound && lap) {
          row.compound.textContent = lap.c;
          row.compound.style.color = getCompoundColor(
            compoundFromInitial(lap.c),
          );
          row.compound.style.borderColor = getCompoundColor(
            compoundFromInitial(lap.c),
          );
        }
      });
    });
  }, [subscribe]);

  return (
    <div
      className="pointer-events-none absolute left-3 top-3 flex w-[228px] flex-col overflow-hidden rounded-sm border border-line-soft"
      style={{ background: "var(--glass-surface)" }}
    >
      {cars.map((car) => {
        const key = carKey(car);
        const set = (field: keyof Row) => (node: never) => {
          const row = rowsRef.current.get(key) ?? {
            root: null,
            position: null,
            gap: null,
            tyre: null,
            compound: null,
          };
          row[field] = node;
          rowsRef.current.set(key, row);
        };
        return (
          <div
            key={key}
            hidden
            ref={set("root")}
            className="grid grid-cols-[13px_22px_minmax(0,1fr)_auto_auto] items-center gap-2 border-b border-line-soft/40 px-2 py-1 last:border-b-0 [&[hidden]]:hidden"
          >
            <span
              ref={set("position")}
              className="text-right font-mono text-[10px] tabular-nums text-ink-faint"
            />
            <DriverHeadshot
              code={car.driver_code}
              fullName={car.full_name}
              src={car.headshot_url}
              size={22}
              shape="circle"
              bordered={false}
              focalY={0.12}
            />
            <span
              className="truncate font-mono text-[11px] font-bold tracking-[0.04em]"
              style={{ color: tint(car.team_color) }}
            >
              {car.driver_code ?? car.full_name}
            </span>
            <span className="flex items-center gap-[3px]">
              <span
                ref={set("compound")}
                className="grid h-[14px] w-[14px] place-items-center rounded-full border font-mono text-[8px] font-bold"
              />
              <span
                ref={set("tyre")}
                className="w-[13px] font-mono text-[9px] tabular-nums text-ink-faint"
              />
            </span>
            <span
              ref={set("gap")}
              className="w-[52px] text-right font-mono text-[10px] tabular-nums"
            />
          </div>
        );
      })}
    </div>
  );
}
