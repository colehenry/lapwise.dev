"use client";

import { useState } from "react";
import { formatDay, puzzleDate, upcomingDays } from "@/lib/puzzleSchedule";
import type { AdminPuzzleSummary } from "@/lib/queries/adminGrid";
import type { AdminGuessPuzzle } from "@/lib/queries/adminGuessGame";
import { difficultyWord } from "./BoardBuilder";
import { DRAG_TYPE, type Game, readDrag } from "./dragTypes";
import { depthTone } from "./ReviewCell";

const TONE_SWATCH = {
  fail: "bg-danger-bright",
  warn: "bg-amber-400",
  ok: "bg-emerald-500/70",
};

/** Nine squares standing in for the board: enough to spot a thin cell. */
export function DepthHeatmap({ depths }: { depths: number[] }) {
  return (
    <span className="grid shrink-0 grid-cols-3 gap-px" aria-hidden="true">
      {depths.map((depth, index) => (
        <span
          // Position is the identity: two cells can share a depth.
          key={`${index}-${depth}`}
          className={`h-1.5 w-1.5 ${TONE_SWATCH[depthTone(depth)]}`}
        />
      ))}
    </span>
  );
}

function GridChip({ puzzle }: { puzzle: AdminPuzzleSummary }) {
  return (
    <>
      <span className="font-mono text-xs font-bold text-ink-strong">
        #{String(puzzle.number).padStart(3, "0")}
      </span>
      <DepthHeatmap depths={puzzle.cell_depths} />
      <span className="truncate text-xs text-ink-faint">
        {difficultyWord(puzzle.difficulty_score)}
      </span>
    </>
  );
}

function GuessChip({ puzzle }: { puzzle: AdminGuessPuzzle }) {
  return (
    <>
      <span className="truncate text-xs font-semibold text-ink-strong">
        {puzzle.full_name}
      </span>
      <span className="truncate text-xs text-ink-faint">
        {puzzle.constructor}
      </span>
    </>
  );
}

function Slot({
  game,
  day,
  locked,
  number,
  onDrop,
  onOpen,
  onUnschedule,
  children,
}: {
  game: Game;
  day: string;
  locked: boolean;
  number: number | null;
  onDrop: (game: Game, number: number, day: string) => void;
  onOpen?: () => void;
  onUnschedule?: () => void;
  children?: React.ReactNode;
}) {
  const [over, setOver] = useState(false);
  const accepts = (event: React.DragEvent) =>
    !locked && event.dataTransfer.types.includes(DRAG_TYPE[game]);

  if (number === null) {
    return (
      <li
        aria-label={`${game} on ${day}`}
        onDragOver={(event) => {
          if (!accepts(event)) return;
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          setOver(false);
          const drag = readDrag(event, game);
          if (drag) onDrop(game, drag, day);
        }}
        className={`flex min-h-9 items-center rounded-sm border border-dashed px-2 text-[11px] ${
          over
            ? "border-accent bg-accent/10 text-accent-light"
            : locked
              ? "border-transparent text-ink-faint/50"
              : "border-line-soft text-ink-faint"
        }`}
      >
        {locked ? "—" : "drop here"}
      </li>
    );
  }

  return (
    <li
      aria-label={`${game} on ${day}`}
      draggable={!locked}
      onDragStart={(event) => {
        event.dataTransfer.setData(DRAG_TYPE[game], String(number));
        event.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={(event) => {
        if (!accepts(event)) return;
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        setOver(false);
        const drag = readDrag(event, game);
        if (drag !== null && drag !== number) onDrop(game, drag, day);
      }}
      className={`group flex min-h-9 items-center gap-2 rounded-sm border px-2 ${
        over
          ? "border-accent bg-accent/10"
          : locked
            ? "border-emerald-500/30 bg-emerald-500/5"
            : "cursor-grab border-line-soft bg-surface-panel hover:border-line-strong"
      }`}
    >
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          {children}
        </button>
      ) : (
        <span className="flex min-w-0 flex-1 items-center gap-2">
          {children}
        </span>
      )}
      {!locked && onUnschedule && (
        <button
          type="button"
          onClick={onUnschedule}
          aria-label="Unschedule"
          title="Back to drafts"
          className="px-1 text-xs text-ink-faint opacity-0 hover:text-danger-bright group-hover:opacity-100"
        >
          ×
        </button>
      )}
    </li>
  );
}

/** The run, one day per row, nearest first.
 *
 *  Drag a chip or a draft onto a day to put it there; the rest of the run
 *  closes up around it. Days that have been served are fixed. */
export default function ScheduleBoard({
  grid,
  guess,
  onDrop,
  onOpenGrid,
  onOpenGuess,
  onUnschedule,
}: {
  grid: AdminPuzzleSummary[];
  guess: AdminGuessPuzzle[];
  onDrop: (game: Game, number: number, day: string) => void;
  onOpenGrid: (number: number) => void;
  onOpenGuess: (number: number) => void;
  onUnschedule: (game: Game, number: number) => void;
}) {
  const [showPast, setShowPast] = useState(false);
  const today = puzzleDate(0);
  const gridByDay = new Map(
    grid.filter((p) => p.published_on).map((p) => [p.published_on, p]),
  );
  const guessByDay = new Map(
    guess.filter((p) => p.published_on).map((p) => [p.published_on, p]),
  );
  const dated = [...gridByDay.keys(), ...guessByDay.keys()] as string[];
  const last = dated.length ? dated.reduce((a, b) => (a > b ? a : b)) : null;
  const upcoming = upcomingDays(last);
  const past = dated
    .filter((day) => day < today)
    .filter((day, index, all) => all.indexOf(day) === index)
    .sort()
    .reverse();

  const row = (day: string) => {
    const gridPuzzle = gridByDay.get(day) ?? null;
    const guessPuzzle = guessByDay.get(day) ?? null;
    // A day is fixed once it has been served; today is fixed per game, only
    // where something already runs.
    const fixed = (taken: boolean) => day < today || (day === today && taken);
    return (
      <ul
        key={day}
        className={`grid grid-cols-[6.5rem_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2 px-3 py-1.5 ${
          day === today ? "bg-emerald-500/5" : ""
        }`}
      >
        <li
          className={`text-xs ${day === today ? "font-semibold text-emerald-300" : "text-ink-base"}`}
        >
          {formatDay(day)}
        </li>
        <Slot
          game="grid"
          day={day}
          locked={fixed(gridPuzzle !== null)}
          number={gridPuzzle?.number ?? null}
          onDrop={onDrop}
          onOpen={gridPuzzle ? () => onOpenGrid(gridPuzzle.number) : undefined}
          onUnschedule={
            gridPuzzle
              ? () => onUnschedule("grid", gridPuzzle.number)
              : undefined
          }
        >
          {gridPuzzle && <GridChip puzzle={gridPuzzle} />}
        </Slot>
        <Slot
          game="guess"
          day={day}
          locked={fixed(guessPuzzle !== null)}
          number={guessPuzzle?.number ?? null}
          onDrop={onDrop}
          onOpen={
            guessPuzzle ? () => onOpenGuess(guessPuzzle.number) : undefined
          }
          onUnschedule={
            guessPuzzle
              ? () => onUnschedule("guess", guessPuzzle.number)
              : undefined
          }
        >
          {guessPuzzle && <GuessChip puzzle={guessPuzzle} />}
        </Slot>
      </ul>
    );
  };

  return (
    <section className="rounded-sm border border-line-soft bg-surface-band">
      <div className="grid grid-cols-[6.5rem_minmax(0,1fr)_minmax(0,1fr)] gap-2 border-b border-line-soft px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-ink-faint">
        <span>Day</span>
        <span>Daily Grid</span>
        <span>Who's on Pole?</span>
      </div>
      <div className="divide-y divide-line-soft/60">{upcoming.map(row)}</div>
      {past.length > 0 && (
        <div className="border-t border-line-soft">
          <button
            type="button"
            onClick={() => setShowPast((open) => !open)}
            className="flex w-full items-center justify-between px-3 py-2 text-left text-xs text-ink-faint hover:bg-surface-panel"
          >
            <span>Past · {past.length} days</span>
            <span>{showPast ? "Hide" : "Show"}</span>
          </button>
          {showPast && (
            <div className="divide-y divide-line-soft/60 border-t border-line-soft">
              {past.map(row)}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
