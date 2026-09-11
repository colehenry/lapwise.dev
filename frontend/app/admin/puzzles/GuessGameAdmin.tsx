"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import DailyGameDriverSearch from "@/components/games/DailyGameDriverSearch";
import Button from "@/components/ui/Button";
import { puzzleDate } from "@/lib/puzzleSchedule";
import {
  type AdminGuessPuzzle,
  addManualAdminGuessPuzzle,
  adminGuessGameCatalogQuery,
  adminGuessGameInvalidation,
  adminGuessGameQueueQuery,
  approveAdminGuessPuzzle,
  deleteAdminGuessDrafts,
  deleteAdminGuessPuzzle,
  randomizeAdminGuessPuzzles,
  revertAdminGuessPuzzle,
  scheduleAdminGuessPuzzle,
} from "@/lib/queries/adminGuessGame";
import type {
  GameDriver,
  GameDriverCatalogResponse,
} from "@/lib/queries/dailyGrid";

const STATUS_STYLE = {
  draft: "bg-surface-raised text-ink-faint",
  approved: "bg-[var(--compound-medium)] text-[var(--game-close-ink)]",
  scheduled: "bg-amber-500/15 text-amber-300",
  live: "bg-emerald-500/15 text-emerald-300",
};

function phase(puzzle: AdminGuessPuzzle) {
  if (puzzle.status === "draft") return "draft" as const;
  if (puzzle.status === "approved") return "approved" as const;
  return puzzle.published_on && puzzle.published_on <= puzzleDate(0)
    ? ("live" as const)
    : ("scheduled" as const);
}

function GuessPuzzleRow({
  busy,
  onAction,
  puzzle,
}: {
  busy: boolean;
  onAction: (action: () => Promise<unknown>) => void;
  puzzle: AdminGuessPuzzle;
}) {
  const [date, setDate] = useState(puzzle.published_on ?? "");
  const state = phase(puzzle);
  return (
    <article className="space-y-3 border-b border-line-soft p-4 last:border-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <strong className="font-mono text-sm text-ink-strong">
          #{String(puzzle.number).padStart(3, "0")}
        </strong>
        <span
          className={`rounded-sm px-1.5 py-0.5 text-[11px] font-semibold capitalize ${STATUS_STYLE[state]}`}
        >
          {state}
        </span>
        <strong className="text-sm text-ink-strong">{puzzle.full_name}</strong>
        <span className="font-mono text-[10px] text-ink-faint">
          {puzzle.driver_code}
        </span>
        <span className="ml-auto text-xs text-ink-faint">
          {puzzle.published_on ?? "No date"}
        </span>
      </div>
      <div className="grid gap-1 text-xs text-ink-soft sm:grid-cols-5">
        <span>Debut {puzzle.debut}</span>
        <span>Last raced {puzzle.last_raced}</span>
        <span>{puzzle.country}</span>
        <span>{puzzle.constructor}</span>
        <span>{puzzle.career_peak}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-line-soft pt-3">
        {puzzle.status === "draft" && (
          <Button
            size="sm"
            disabled={busy}
            onClick={() =>
              onAction(() => approveAdminGuessPuzzle(puzzle.number))
            }
          >
            Approve
          </Button>
        )}
        {puzzle.status === "approved" && (
          <>
            <label
              htmlFor={`guess-date-${puzzle.number}`}
              className="text-sm text-ink-base"
            >
              Run on
            </label>
            <input
              id={`guess-date-${puzzle.number}`}
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="rounded-sm border border-line-soft bg-surface-band px-2 py-1 text-sm text-ink-strong"
            />
            <button
              type="button"
              onClick={() => setDate(puzzleDate(0))}
              className="rounded-sm border border-line-soft px-2 py-1 text-sm text-ink-base hover:bg-surface-panel"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setDate(puzzleDate(1))}
              className="rounded-sm border border-line-soft px-2 py-1 text-sm text-ink-base hover:bg-surface-panel"
            >
              Tomorrow
            </button>
            <Button
              size="sm"
              disabled={busy || !date}
              onClick={() =>
                onAction(() => scheduleAdminGuessPuzzle(puzzle.number, date))
              }
            >
              {date && date <= puzzleDate(0) ? "Publish now" : "Schedule"}
            </Button>
          </>
        )}
        {puzzle.status !== "draft" && (
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={() =>
              onAction(() => revertAdminGuessPuzzle(puzzle.number))
            }
          >
            {puzzle.status === "published" ? "Unschedule" : "Back to draft"}
          </Button>
        )}
        <Button
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => {
            if (!window.confirm(`Delete Guess Game #${puzzle.number}?`)) return;
            onAction(() => deleteAdminGuessPuzzle(puzzle.number));
          }}
        >
          Delete
        </Button>
      </div>
    </article>
  );
}

function ManualGamePanel({
  busy,
  catalog,
  onAdd,
}: {
  busy: boolean;
  catalog: { data?: GameDriverCatalogResponse; isError: boolean };
  onAdd: (driverSlug: string, publishedOn: string) => void;
}) {
  const [driver, setDriver] = useState<GameDriver | null>(null);
  const [date, setDate] = useState(puzzleDate(1));
  return (
    <section className="rounded-sm border border-line-soft bg-surface-band p-4">
      <h3 className="text-sm font-bold text-ink-strong">Add an exact game</h3>
      <p className="mb-3 mt-1 text-xs text-ink-soft">
        Pick the answer and its day. This skips the approval queue because you
        chose the driver directly.
      </p>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
        <div>
          <DailyGameDriverSearch
            catalog={catalog.data?.drivers}
            disabled={catalog.isError}
            onSelect={(selected) => setDriver(selected)}
            placeholder="Search for the answer driver..."
          />
          <p className="mt-1 min-h-4 text-xs text-ink-soft">
            {driver ? `Selected: ${driver.full_name}` : "No driver selected"}
          </p>
        </div>
        <label className="grid gap-1 text-xs text-ink-base">
          Run on
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="h-[42px] rounded-sm border border-line-soft bg-surface-panel px-3 text-sm text-ink-strong"
          />
        </label>
        <Button
          disabled={busy || !driver || !date}
          onClick={() => driver && onAdd(driver.driver_slug, date)}
        >
          Add game
        </Button>
      </div>
    </section>
  );
}

export default function GuessGameAdmin() {
  const client = useQueryClient();
  const queue = useQuery(adminGuessGameQueueQuery());
  const catalog = useQuery(adminGuessGameCatalogQuery());
  const [count, setCount] = useState(7);
  const [error, setError] = useState("");
  const action = useMutation({
    mutationFn: async (run: () => Promise<unknown>) => run(),
    onSuccess: () => client.invalidateQueries(adminGuessGameInvalidation()),
    onError: (reason) =>
      setError(reason instanceof Error ? reason.message : "Action failed"),
  });
  const puzzles = queue.data?.puzzles ?? [];
  const drafts = puzzles.filter((puzzle) => puzzle.status === "draft").length;
  const run = (operation: () => Promise<unknown>) => {
    setError("");
    action.mutate(operation);
  };
  return (
    <div className="space-y-4">
      <ManualGamePanel
        busy={action.isPending}
        catalog={catalog}
        onAdd={(driverSlug, publishedOn) =>
          run(() => addManualAdminGuessPuzzle(driverSlug, publishedOn))
        }
      />
      <section className="flex flex-wrap items-center gap-2 rounded-sm border border-line-soft bg-surface-band p-4">
        <label htmlFor="guess-random-count" className="text-sm text-ink-base">
          Random proposals
        </label>
        <input
          id="guess-random-count"
          type="number"
          min={1}
          max={30}
          value={count}
          onChange={(event) => setCount(Number(event.target.value))}
          className="w-16 rounded-sm border border-line-soft bg-surface-panel px-2 py-1 text-sm text-ink-strong"
        />
        <Button
          size="sm"
          disabled={action.isPending}
          onClick={() => run(() => randomizeAdminGuessPuzzles(count))}
        >
          Randomize drafts
        </Button>
        {drafts > 0 && (
          <Button
            size="sm"
            variant="secondary"
            disabled={action.isPending}
            onClick={() => {
              if (!window.confirm(`Delete all ${drafts} Guess Game drafts?`))
                return;
              run(deleteAdminGuessDrafts);
            }}
          >
            Delete {drafts} drafts
          </Button>
        )}
        <p className="basis-full text-xs text-ink-soft">
          Randomized drivers stay as drafts until you approve each one.
        </p>
      </section>
      {(error || queue.isError) && (
        <p className="rounded-sm border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger-bright">
          {error || "Guess Game puzzles could not load."}
        </p>
      )}
      {queue.isLoading ? (
        <div className="h-28 animate-pulse rounded-sm bg-surface-panel" />
      ) : puzzles.length ? (
        <div className="rounded-sm border border-line-soft bg-surface-band">
          {puzzles.map((puzzle) => (
            <GuessPuzzleRow
              key={puzzle.number}
              puzzle={puzzle}
              busy={action.isPending}
              onAction={run}
            />
          ))}
        </div>
      ) : (
        <p className="rounded-sm border border-line-soft bg-surface-band px-3 py-8 text-center text-sm text-ink-faint">
          No Guess Game puzzles yet. Pick an exact driver or randomize drafts.
        </p>
      )}
    </div>
  );
}
