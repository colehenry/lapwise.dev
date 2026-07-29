"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { isValidHeadshotUrl } from "@/lib/api";
import type { ClockState } from "@/lib/raceClock";

type Props = {
  state: ClockState | null;
  rows?: number;
  headshotFor: (code: string, name: string) => string | null;
};

const COMPOUND_COLORS: Record<string, string> = {
  SOFT: "#e8002d",
  MEDIUM: "#ffd700",
  HARD: "#e8e8ea",
  INTERMEDIATE: "#39b54a",
  WET: "#3399ff",
};

/** Placeholder rows never reorder, so stable synthetic keys are enough. */
const SKELETON_KEYS = Array.from({ length: 24 }, (_, i) => `skeleton-${i}`);

function compoundColor(compound: string | null | undefined) {
  return COMPOUND_COLORS[String(compound ?? "").toUpperCase()] ?? "#8a8a94";
}

/**
 * The order sheet. Fixed height, no inner scroll — it is sized to sit level
 * with the track and channel stack beside it, because they are one instrument.
 * Driver photos and team-coloured codes carry the premium read.
 */
export default function RunningOrder({ state, rows = 12, headshotFor }: Props) {
  const shown = (state?.rows ?? []).slice(0, rows);
  const previous = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const next = new Map<string, number>();
    for (const row of shown) next.set(row.car.code, row.position);
    previous.current = next;
  });

  return (
    <section className="flex flex-col overflow-hidden rounded-sm border border-border-primary bg-bg-tertiary">
      <header className="flex items-center justify-between border-b border-border-primary px-4 py-2.5">
        <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-purple-400">
          Running order
        </p>
        <span className="font-mono text-[9px] uppercase tracking-wider text-text-muted">
          Top {rows} of {state?.rows.length ?? 0}
        </span>
      </header>

      <ol className="grid flex-1 content-stretch p-1.5">
        {shown.length === 0
          ? SKELETON_KEYS.slice(0, rows).map((key) => (
              <li
                key={key}
                className="mx-1 my-0.5 h-6 animate-pulse rounded-sm bg-bg-elevated/60"
              />
            ))
          : shown.map((row) => {
              const teamColor = row.car.color
                ? `#${row.car.color.replace("#", "")}`
                : undefined;
              const before = previous.current.get(row.car.code);
              const moved =
                before === undefined || before === row.position
                  ? null
                  : before > row.position
                    ? "up"
                    : "down";
              const url = headshotFor(row.car.code, row.car.name);
              const surname = row.car.name.split(" ").slice(-1)[0];

              return (
                <li
                  key={row.car.code}
                  className={`grid grid-cols-[1.4rem_auto_minmax(0,1fr)_auto_auto] items-center gap-2.5 rounded-sm px-2 transition-colors duration-500 ${
                    row.position === 1 ? "bg-purple-500/10" : ""
                  } ${
                    moved === "up"
                      ? "bg-success/15"
                      : moved === "down"
                        ? "bg-red-500/10"
                        : ""
                  }`}
                >
                  <span className="text-right font-mono text-xs font-semibold tabular-nums text-text-tertiary">
                    {row.retired ? "—" : row.position}
                  </span>

                  <span
                    className="relative h-6 w-6 overflow-hidden rounded-full border-[1.5px] bg-bg-secondary"
                    style={{
                      borderColor: teamColor ?? "var(--border-secondary)",
                    }}
                  >
                    {isValidHeadshotUrl(url) ? (
                      <Image
                        src={url as string}
                        alt=""
                        fill
                        sizes="24px"
                        className="scale-125 object-cover object-[50%_12%]"
                      />
                    ) : (
                      <span className="grid h-full w-full place-items-center font-mono text-[8px] text-text-muted">
                        {row.car.code.slice(0, 2)}
                      </span>
                    )}
                  </span>

                  <span className="flex min-w-0 items-baseline gap-1.5">
                    <span
                      className="font-mono text-xs font-bold tracking-wide"
                      style={{ color: teamColor }}
                    >
                      {row.car.code}
                    </span>
                    <span className="truncate text-[11px] text-text-muted">
                      {surname}
                    </span>
                  </span>

                  <span
                    className="grid h-4 w-4 place-items-center rounded-full border-[1.5px] font-mono text-[8px] font-bold"
                    style={{ color: compoundColor(row.lap?.compound) }}
                  >
                    {(row.lap?.compound ?? "?")[0]?.toUpperCase()}
                  </span>

                  <span className="w-14 text-right font-mono text-[11px] tabular-nums text-text-secondary">
                    {row.retired
                      ? "OUT"
                      : row.position === 1
                        ? "LEADER"
                        : `+${row.gap.toFixed(1)}`}
                  </span>
                </li>
              );
            })}
      </ol>
    </section>
  );
}
