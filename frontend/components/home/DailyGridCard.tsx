"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import DriverHeadshot from "@/components/entities/DriverHeadshot";
import type { PanelState } from "@/hooks/useHomeConsole";
import { utcDate } from "@/lib/consoleFormat";
import {
  DEMO_COLUMN,
  DEMO_COLUMN_LABEL,
  DEMO_ROW,
  DEMO_ROW_LABEL,
  type DemoCell,
} from "@/lib/dailyGridDemo";
import type { DailySummary } from "@/lib/queries/dailySummary";
import ConsolePanel, {
  PanelFailure,
  PanelLabel,
  ValueSkeleton,
} from "./ConsolePanel";

/** The board is concealed here, so the header plates carry a lock and no text.
 *  The demo turns them over to a generic pairing, never today's. */
function LockPlate({
  label,
  vertical = false,
}: {
  label?: string;
  vertical?: boolean;
}) {
  return (
    <div className="relative grid place-items-center overflow-hidden rounded-[3px] border border-line-soft bg-surface-band">
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            "repeating-linear-gradient(135deg, var(--glass-surface-soft) 0 3px, transparent 3px 7px)",
        }}
      />
      {label ? (
        <span
          className="relative max-h-full max-w-full truncate px-1 text-center font-mono text-[8px] font-bold uppercase leading-tight tracking-[0.04em] text-ink-base"
          style={
            vertical
              ? { writingMode: "vertical-rl", transform: "rotate(180deg)" }
              : undefined
          }
        >
          {label}
        </span>
      ) : (
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
          className="relative text-ink-faint opacity-70"
          aria-hidden="true"
        >
          <rect x="4" y="11" width="16" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
      )}
    </div>
  );
}

const LIGHTS = ["one", "two", "three", "four", "five"];

/* The lights sit in their own dark housing. Directly on the accent, red on
   purple goes muddy and the lit ones stop reading as lit. */
function StartingLightRow() {
  return (
    <span className="flex gap-1 rounded-full bg-black/35 px-2 py-1">
      {LIGHTS.map((name, index) => (
        <i
          key={name}
          className={`block h-2 w-2 rounded-full border ${
            index < 2
              ? "border-danger-bright bg-danger shadow-red"
              : "border-danger/25 bg-danger/10"
          }`}
        />
      ))}
    </span>
  );
}

/** Stable keys for a fixed board, so rows are never keyed by their index. */
function cellKeys(count: number, prefix: string): string[] {
  const keys: string[] = [];
  for (let i = 0; i < count; i++) keys.push(`${prefix}-${i}`);
  return keys;
}

/** A null field hides its own line; nothing here is invented. */
function StatLines({ summary }: { summary: DailySummary }) {
  const streak = summary.streak;
  const lastSeven = summary.last_seven;
  const playCount = summary.play_count;
  if (streak == null && lastSeven == null && playCount == null) return null;

  return (
    <div className="mt-2.5 flex items-end justify-between gap-3">
      {streak != null && (
        <div>
          <PanelLabel>Your streak</PanelLabel>
          <div className="mt-0.5 font-mono text-[16px] leading-tight text-ink-strong tabular-nums">
            {streak} {streak === 1 ? "day" : "days"}
          </div>
        </div>
      )}
      {playCount != null && streak == null && (
        <div>
          <PanelLabel>Played today</PanelLabel>
          <div className="mt-0.5 font-mono text-[16px] leading-tight text-ink-strong tabular-nums">
            {playCount.toLocaleString()}
          </div>
        </div>
      )}
      {lastSeven != null && lastSeven.length > 0 && (
        <div className="text-right">
          <PanelLabel>Last 7</PanelLabel>
          <div className="mt-0.5 flex h-[22px] items-end gap-[3px]">
            {lastSeven
              .map((won, index) => ({ won, id: `day-${index}` }))
              .map((day) => (
                <i
                  key={day.id}
                  className={`block w-2 rounded-[1.5px] ${
                    day.won ? "bg-accent" : "bg-surface-raised"
                  }`}
                  style={{ height: day.won ? 22 : 11 }}
                />
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** One step of the scripted round, in wall-clock milliseconds. */
const DEMO_STEP_MS = 1100;

/** Locked · the pair turns over · four faces land · hold, then round again. */
const DEMO_HOLD_STEPS = 2;

function useDemoStep(enabled: boolean, cells: number): number {
  const [step, setStep] = useState(0);
  const total = cells + DEMO_HOLD_STEPS;

  useEffect(() => {
    if (!enabled || cells === 0) return;
    const timer = window.setInterval(
      () => setStep((value) => (value + 1) % (total + 1)),
      DEMO_STEP_MS,
    );
    return () => window.clearInterval(timer);
  }, [enabled, cells, total]);

  return enabled ? step : 0;
}

export default function DailyGridCard({
  summary,
  state,
  demoCells,
  animate,
  className = "",
}: {
  summary: DailySummary | undefined;
  state: PanelState;
  /** The scripted round, or empty to leave the board concealed. */
  demoCells: DemoCell[];
  animate: boolean;
  className?: string;
}) {
  const rows = summary?.rows ?? 3;
  const columns = summary?.columns ?? 3;
  const step = useDemoStep(animate, demoCells.length);
  const uncovered = step >= 1;
  const revealed = demoCells.slice(0, Math.max(0, step - 1));
  /* A miss shows for its own beat and then clears, because a wrong guess never
     occupies the cell — it just costs a life. */
  const shown = revealed.filter(
    (cell, index) => cell.correct || index === revealed.length - 1,
  );

  return (
    <ConsolePanel
      title="Daily Grid"
      label={
        summary ? (
          <PanelLabel>
            {utcDate(summary.published_on, {
              day: "numeric",
              month: "short",
            })}
          </PanelLabel>
        ) : (
          <ValueSkeleton width={44} height={10} />
        )
      }
      className={className}
      bodyClassName="flex flex-col"
    >
      {state === "error" ? (
        <PanelFailure message="Today's board could not be loaded." />
      ) : (
        <div className="flex flex-1 flex-col px-3 pb-3 pt-[11px]">
          <div
            className="mb-4 grid gap-[3px]"
            style={{
              gridTemplateColumns: `28px repeat(${columns}, minmax(0, 1fr))`,
              gridTemplateRows: `28px repeat(${rows}, minmax(0, 1fr))`,
            }}
          >
            <div />
            {cellKeys(columns, "column").map((key, index) => (
              <LockPlate
                key={key}
                label={
                  uncovered && index === DEMO_COLUMN
                    ? DEMO_COLUMN_LABEL
                    : undefined
                }
              />
            ))}
            {cellKeys(rows, "row").map((key, index) => (
              <BoardRow
                key={key}
                columns={columns}
                rowIndex={index}
                label={
                  uncovered && index === DEMO_ROW ? DEMO_ROW_LABEL : undefined
                }
                shown={shown}
              />
            ))}
          </div>

          {summary && <StatLines summary={summary} />}

          <Link
            href="/daily"
            className="mt-auto flex w-full items-center justify-center gap-2.5 rounded-sm border border-accent-bright bg-accent px-4 py-2.5 text-[14px] font-semibold text-ink-strong transition-colors hover:bg-accent-bright focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-bright"
          >
            <StartingLightRow />
            Try today&apos;s grid
          </Link>
        </div>
      )}
    </ConsolePanel>
  );
}

function BoardRow({
  columns,
  rowIndex,
  label,
  shown,
}: {
  columns: number;
  rowIndex: number;
  label: string | undefined;
  shown: DemoCell[];
}) {
  return (
    <>
      <LockPlate label={label} vertical />
      {cellKeys(columns, `row-${rowIndex}-cell`).map((key, columnIndex) => {
        const cell = shown.find(
          (item) => item.row === rowIndex && item.column === columnIndex,
        );
        return (
          <div
            key={key}
            className={`relative grid aspect-square place-items-center overflow-hidden rounded-[3px] border bg-surface-page transition-colors duration-300 ${
              cell
                ? cell.correct
                  ? "border-success"
                  : "game-cell-shake border-danger"
                : "border-line-soft"
            }`}
          >
            {cell ? (
              <>
                <DriverHeadshot
                  code={cell.driver.code}
                  fullName={cell.driver.name}
                  src={cell.driver.headshot}
                  responsive
                  shape="square"
                  bordered={false}
                  className={`animate-fadeIn h-full w-full ${cell.correct ? "" : "opacity-40"}`}
                  focalY={0.1}
                />
                {!cell.correct && (
                  <span className="absolute inset-0 grid place-items-center font-mono text-[20px] font-bold text-danger">
                    ×
                  </span>
                )}
              </>
            ) : (
              <span className="font-mono text-[13px] text-ink-faint opacity-60">
                ?
              </span>
            )}
          </div>
        );
      })}
    </>
  );
}
