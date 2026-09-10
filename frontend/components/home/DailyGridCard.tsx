"use client";

import Link from "next/link";
import type { PanelState } from "@/hooks/useHomeConsole";
import { utcDate } from "@/lib/consoleFormat";
import type { DailySummary } from "@/lib/queries/dailySummary";
import ConsolePanel, {
  PanelFailure,
  PanelLabel,
  ValueSkeleton,
} from "./ConsolePanel";

/** The board is concealed here, so the header plates carry a lock and no text. */
function LockPlate() {
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
    </div>
  );
}

const LIGHTS = ["one", "two", "three", "four", "five"];

function StartingLightRow() {
  return (
    <span className="flex gap-1">
      {LIGHTS.map((name, index) => (
        <i
          key={name}
          className={`block h-2 w-2 rounded-full border ${
            index < 2
              ? "border-danger-bright bg-danger shadow-red"
              : "border-danger/30 bg-danger/15"
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

export default function DailyGridCard({
  summary,
  state,
  className = "",
}: {
  summary: DailySummary | undefined;
  state: PanelState;
  className?: string;
}) {
  const rows = summary?.rows ?? 3;
  const columns = summary?.columns ?? 3;

  return (
    <ConsolePanel
      title="Daily Grid"
      label={
        summary ? (
          <PanelLabel>No. {summary.number}</PanelLabel>
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
            className="grid gap-[3px]"
            style={{
              gridTemplateColumns: `28px repeat(${columns}, minmax(0, 1fr))`,
              gridTemplateRows: `28px repeat(${rows}, minmax(0, 1fr))`,
            }}
          >
            <div />
            {cellKeys(columns, "column").map((key) => (
              <LockPlate key={key} />
            ))}
            {cellKeys(rows, "row").map((key) => (
              <ConcealedRow key={key} columns={columns} rowKey={key} />
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

          {summary && (
            <p className="m-0 mt-2 text-center font-mono text-[9.5px] uppercase tracking-[0.12em] text-ink-faint">
              {utcDate(summary.published_on)} · {summary.max_guesses} guesses
            </p>
          )}
        </div>
      )}
    </ConsolePanel>
  );
}

function ConcealedRow({
  columns,
  rowKey,
}: {
  columns: number;
  rowKey: string;
}) {
  return (
    <>
      <LockPlate />
      {cellKeys(columns, `${rowKey}-cell`).map((key) => (
        <div
          key={key}
          className="grid aspect-square place-items-center rounded-[3px] border border-line-soft bg-surface-page font-mono text-[13px] text-ink-faint opacity-60"
        >
          ?
        </div>
      ))}
    </>
  );
}
