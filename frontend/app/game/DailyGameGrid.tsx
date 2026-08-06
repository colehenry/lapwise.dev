"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import Button from "@/components/ui/Button";
import { useDailyGridProgress } from "@/hooks/useDailyGridProgress";
import {
  type DailyGame,
  dailyGameQuery,
  type GameCategory,
  type GameDriver,
  submitGameGuess,
} from "@/lib/queries/game";
import DriverSearchPanel from "./DriverSearchPanel";

const GRID_MARKS = Array.from({ length: 9 }, (_, index) => `mark-${index + 1}`);

function HeaderCell({
  category,
  axis,
}: {
  category: GameCategory;
  axis: "row" | "column";
}) {
  return (
    <div
      title={category.description}
      className="relative flex min-h-20 items-center justify-center overflow-hidden border border-border-primary bg-bg-secondary px-2 py-3 text-center sm:min-h-24 sm:px-4"
    >
      <div
        className={`absolute bg-purple-500/40 ${
          axis === "row" ? "inset-y-3 left-0 w-px" : "inset-x-3 top-0 h-px"
        }`}
      />
      <span className="text-[9px] font-bold uppercase leading-snug tracking-[0.12em] text-text-secondary sm:text-[11px]">
        {category.label}
      </span>
    </div>
  );
}

function GameBoard({ puzzle }: { puzzle: DailyGame }) {
  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{
    correct: boolean;
    message: string;
  } | null>(null);
  const progress = useDailyGridProgress(puzzle.id);
  const guessMutation = useMutation({ mutationFn: submitGameGuess });
  const selectedRow =
    selectedCell === null
      ? null
      : Math.floor(selectedCell / puzzle.columns.length);
  const selectedColumn =
    selectedCell === null ? null : selectedCell % puzzle.columns.length;
  const remaining = Math.max(puzzle.max_guesses - progress.attempts.length, 0);
  const complete = progress.filledCells.size === 9;
  const finished = complete || remaining === 0;

  const submitDriver = async (driver: GameDriver): Promise<boolean> => {
    if (selectedRow === null || selectedColumn === null || finished)
      return false;
    if (progress.usedDriverSlugs.has(driver.driver_slug)) {
      setFeedback({
        correct: false,
        message: `${driver.full_name} was already used.`,
      });
      return false;
    }

    const row = puzzle.rows[selectedRow];
    const column = puzzle.columns[selectedColumn];
    try {
      const result = await guessMutation.mutateAsync({
        row_id: row.id,
        column_id: column.id,
        driver_slug: driver.driver_slug,
      });
      progress.recordAttempt(result);
      setFeedback({
        correct: result.correct,
        message: result.correct
          ? `${driver.full_name} fits ${row.label} and ${column.label}.`
          : `${driver.full_name} does not fit both categories.`,
      });
      if (result.correct) setSelectedCell(null);
      return true;
    } catch (error) {
      setFeedback({
        correct: false,
        message:
          error instanceof Error
            ? error.message
            : "The guess could not be submitted.",
      });
      return false;
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
      <section aria-labelledby="daily-grid-heading" className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-purple-400">
              Puzzle {String(puzzle.number).padStart(3, "0")} ·{" "}
              {puzzle.published_on}
            </p>
            <h2
              id="daily-grid-heading"
              className="mt-1 text-lg font-bold text-text-primary sm:text-xl"
            >
              Find a driver for every intersection
            </h2>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-border-primary bg-bg-secondary px-3 py-2">
            <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-text-muted">
              Guesses
            </span>
            <div
              className="flex gap-1"
              role="img"
              aria-label={`${remaining} guesses remaining`}
            >
              {Array.from({ length: puzzle.max_guesses }, (_, index) => {
                const attempt = progress.attempts[index];
                return (
                  <span
                    key={`guess-${index + 1}`}
                    className={`h-1.5 w-1.5 rounded-full ${
                      attempt
                        ? attempt.correct
                          ? "bg-success"
                          : "bg-warning"
                        : "bg-purple-400"
                    }`}
                  />
                );
              })}
            </div>
            <span className="font-mono text-xs font-bold text-text-primary">
              {remaining}
            </span>
          </div>
        </div>

        <div className="overflow-hidden rounded-sm border border-border-primary bg-bg-tertiary shadow-lg shadow-purple-500/5">
          <div className="grid grid-cols-[5rem_repeat(3,minmax(0,1fr))] sm:grid-cols-[8rem_repeat(3,minmax(0,1fr))]">
            <div className="relative flex min-h-20 items-center justify-center border border-border-primary bg-bg-primary sm:min-h-24">
              <div className="grid grid-cols-3 gap-1" aria-hidden="true">
                {GRID_MARKS.map((mark, index) => (
                  <span
                    key={mark}
                    className={`h-1.5 w-1.5 rounded-[1px] ${
                      index === 4 ? "bg-purple-400" : "bg-border-secondary"
                    }`}
                  />
                ))}
              </div>
            </div>

            {puzzle.columns.map((column) => (
              <HeaderCell key={column.id} category={column} axis="column" />
            ))}

            {puzzle.rows.map((row, rowIndex) => (
              <div key={row.id} className="contents">
                <HeaderCell category={row} axis="row" />
                {puzzle.columns.map((column, columnIndex) => {
                  const cellIndex =
                    rowIndex * puzzle.columns.length + columnIndex;
                  const cellId = `${row.id}__${column.id}`;
                  const driver = progress.filledCells.get(cellId);
                  const selected = selectedCell === cellIndex;
                  return (
                    <button
                      key={cellId}
                      type="button"
                      aria-pressed={selected}
                      aria-label={
                        driver
                          ? `${driver.full_name} fills ${row.label} and ${column.label}`
                          : `Choose a driver for ${row.label} and ${column.label}`
                      }
                      disabled={!!driver || finished || !progress.ready}
                      onClick={() => {
                        setSelectedCell(cellIndex);
                        setFeedback(null);
                      }}
                      className={`group relative aspect-square min-h-20 border border-border-primary p-1.5 transition-all duration-200 focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-400 sm:min-h-28 sm:p-2 ${
                        driver
                          ? "bg-success/10"
                          : selected
                            ? "z-10 bg-purple-500/12 shadow-[inset_0_0_0_1px_var(--purple-400)]"
                            : "bg-bg-tertiary hover:z-10 hover:bg-bg-elevated hover:shadow-[inset_0_0_0_1px_var(--border-secondary)]"
                      } disabled:cursor-default`}
                    >
                      {driver ? (
                        <span className="flex h-full flex-col items-center justify-center">
                          <span className="text-center text-[10px] font-bold leading-tight text-text-primary sm:text-sm">
                            {driver.full_name}
                          </span>
                          <span className="mt-1 font-mono text-[8px] uppercase tracking-widest text-success sm:text-[9px]">
                            {driver.driver_code || "Correct"}
                          </span>
                        </span>
                      ) : (
                        <span className="flex h-full flex-col items-center justify-center">
                          <span
                            className={`flex h-8 w-8 items-center justify-center rounded-full border text-lg transition-all sm:h-10 sm:w-10 ${
                              selected
                                ? "border-purple-500/40 bg-purple-500/15 text-purple-300"
                                : "border-border-secondary bg-bg-secondary text-text-muted group-hover:border-purple-500/30 group-hover:text-purple-400"
                            }`}
                            aria-hidden="true"
                          >
                            +
                          </span>
                          <span className="mt-2 hidden font-mono text-[8px] font-bold uppercase tracking-widest text-text-muted sm:block">
                            Select driver
                          </span>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 min-h-28 rounded-sm border border-border-primary bg-bg-secondary p-4">
          {finished ? (
            <div className="flex min-h-20 flex-col items-center justify-center text-center">
              <p className="text-base font-bold text-text-primary">
                {complete ? "Grid complete" : "Nine guesses used"}
              </p>
              <p className="mt-1 text-sm text-text-muted">
                You filled {progress.filledCells.size} of 9 squares.
              </p>
            </div>
          ) : selectedRow !== null && selectedColumn !== null ? (
            <DriverSearchPanel
              key={`${selectedRow}-${selectedColumn}-${progress.attempts.length}`}
              rowLabel={puzzle.rows[selectedRow].label}
              columnLabel={puzzle.columns[selectedColumn].label}
              disabled={!progress.ready}
              loading={guessMutation.isPending}
              onSubmit={submitDriver}
              usedDriverSlugs={progress.usedDriverSlugs}
            />
          ) : (
            <div className="flex min-h-20 items-center justify-center text-center">
              <p className="text-sm text-text-muted">
                {progress.ready
                  ? "Select an empty square to search for a driver."
                  : "Restoring your saved grid…"}
              </p>
            </div>
          )}
          {feedback && !finished && (
            <p
              aria-live="polite"
              className={`mt-3 text-sm ${feedback.correct ? "text-success" : "text-warning"}`}
            >
              {feedback.message}
            </p>
          )}
        </div>
      </section>

      <aside className="space-y-4 lg:sticky lg:top-20">
        <div className="rounded-sm border border-purple-500/20 bg-purple-500/8 p-5">
          <p className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-purple-400">
            How to play
          </p>
          <ol className="mt-4 space-y-3 text-sm text-text-secondary">
            <li>
              <span className="mr-2 font-mono text-purple-400">01</span>Choose
              any empty square.
            </li>
            <li>
              <span className="mr-2 font-mono text-purple-400">02</span>Find a
              driver matching both headers.
            </li>
            <li>
              <span className="mr-2 font-mono text-purple-400">03</span>Each
              driver and submission can be used once.
            </li>
          </ol>
        </div>

        <div className="rounded-sm border border-border-primary bg-bg-tertiary p-5">
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-text-muted">
              Daily format
            </span>
            <span className="rounded-full border border-success/20 bg-success/10 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest text-success">
              Saved locally
            </span>
          </div>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-text-muted">Board</dt>
              <dd className="font-medium text-text-primary">3 × 3</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-text-muted">Submissions</dt>
              <dd className="font-medium text-text-primary">9 total</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-text-muted">Answer set</dt>
              <dd className="font-medium text-text-primary">
                Snapshot v{puzzle.answer_version}
              </dd>
            </div>
          </dl>
        </div>
      </aside>
    </div>
  );
}

export default function DailyGameGrid() {
  const puzzle = useQuery(dailyGameQuery());

  if (puzzle.isLoading) {
    return (
      <div className="min-h-96 animate-pulse rounded-sm border border-border-primary bg-bg-secondary" />
    );
  }
  if (puzzle.isError || !puzzle.data) {
    return (
      <div className="flex min-h-72 flex-col items-center justify-center rounded-sm border border-border-primary bg-bg-secondary p-6 text-center">
        <p className="font-bold text-text-primary">
          The daily grid could not load.
        </p>
        <p className="mt-2 text-sm text-text-muted">
          Check the API connection and try again.
        </p>
        <Button
          className="mt-4"
          variant="secondary"
          onClick={() => puzzle.refetch()}
        >
          Try again
        </Button>
      </div>
    );
  }
  return <GameBoard key={puzzle.data.id} puzzle={puzzle.data} />;
}
