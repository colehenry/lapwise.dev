"use client";

import { useState } from "react";

const ROWS = ["Ferrari", "Raced in the 2000s", "Podium finisher"] as const;
const COLUMNS = ["McLaren", "Raced in the 2010s", "Race winner"] as const;
const GUESS_DOTS = Array.from(
  { length: 9 },
  (_, index) => `guess-${index + 1}`,
);
const GRID_MARKS = Array.from({ length: 9 }, (_, index) => `mark-${index + 1}`);

function HeaderCell({
  label,
  axis,
}: {
  label: string;
  axis: "row" | "column";
}) {
  return (
    <div className="relative flex min-h-20 items-center justify-center overflow-hidden border border-border-primary bg-bg-secondary px-2 py-3 text-center sm:min-h-24 sm:px-4">
      <div
        className={`absolute bg-purple-500/40 ${
          axis === "row" ? "inset-y-3 left-0 w-px" : "inset-x-3 top-0 h-px"
        }`}
      />
      <span className="text-[9px] font-bold uppercase leading-snug tracking-[0.12em] text-text-secondary sm:text-[11px]">
        {label}
      </span>
    </div>
  );
}

export default function GameGridPreview() {
  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const selectedRow =
    selectedCell === null ? null : Math.floor(selectedCell / 3);
  const selectedColumn = selectedCell === null ? null : selectedCell % 3;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
      <section aria-labelledby="daily-grid-heading" className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-purple-400">
              Preview board
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
              aria-label="9 guesses remaining"
            >
              {GUESS_DOTS.map((guess) => (
                <span
                  key={guess}
                  className="h-1.5 w-1.5 rounded-full bg-purple-400"
                />
              ))}
            </div>
            <span className="font-mono text-xs font-bold text-text-primary">
              9
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
                    className={`h-1.5 w-1.5 rounded-[1px] ${index === 4 ? "bg-purple-400" : "bg-border-secondary"}`}
                  />
                ))}
              </div>
            </div>

            {COLUMNS.map((column) => (
              <HeaderCell key={column} label={column} axis="column" />
            ))}

            {ROWS.map((row, rowIndex) => (
              <div key={row} className="contents">
                <HeaderCell label={row} axis="row" />
                {COLUMNS.map((column, columnIndex) => {
                  const cellIndex = rowIndex * 3 + columnIndex;
                  const selected = selectedCell === cellIndex;
                  return (
                    <button
                      key={`${row}-${column}`}
                      type="button"
                      aria-pressed={selected}
                      aria-label={`Choose a driver for ${row} and ${column}`}
                      onClick={() => setSelectedCell(cellIndex)}
                      className={`group relative aspect-square min-h-20 border border-border-primary transition-all duration-200 focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-400 sm:min-h-28 ${
                        selected
                          ? "z-10 bg-purple-500/12 shadow-[inset_0_0_0_1px_var(--purple-400)]"
                          : "bg-bg-tertiary hover:z-10 hover:bg-bg-elevated hover:shadow-[inset_0_0_0_1px_var(--border-secondary)]"
                      }`}
                    >
                      <span
                        className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full border text-lg transition-all sm:h-10 sm:w-10 ${
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
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 min-h-24 rounded-sm border border-border-primary bg-bg-secondary p-4">
          {selectedRow !== null && selectedColumn !== null ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <label
                  htmlFor="driver-preview-search"
                  className="font-mono text-[9px] font-bold uppercase tracking-widest text-purple-400"
                >
                  {ROWS[selectedRow]} × {COLUMNS[selectedColumn]}
                </label>
                <input
                  id="driver-preview-search"
                  type="text"
                  disabled
                  placeholder="Driver search connects next"
                  className="mt-2 w-full rounded-sm border border-border-primary bg-bg-primary px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted disabled:cursor-not-allowed disabled:opacity-70"
                />
              </div>
              <button
                type="button"
                disabled
                className="rounded-sm bg-purple-500 px-5 py-2.5 text-sm font-bold text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
              >
                Submit driver
              </button>
            </div>
          ) : (
            <div className="flex min-h-16 items-center justify-center text-center">
              <p className="text-sm text-text-muted">
                Select a square to see its two categories.
              </p>
            </div>
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
              <span className="mr-2 font-mono text-purple-400">03</span>Use each
              driver only once.
            </li>
          </ol>
        </div>

        <div className="rounded-sm border border-border-primary bg-bg-tertiary p-5">
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-text-muted">
              Daily format
            </span>
            <span className="rounded-full border border-success/20 bg-success/10 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest text-success">
              No account
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
              <dt className="text-text-muted">Refresh</dt>
              <dd className="font-medium text-text-primary">00:00 UTC</dd>
            </div>
          </dl>
        </div>
      </aside>
    </div>
  );
}
