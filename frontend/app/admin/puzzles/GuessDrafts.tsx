"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import DailyGameDriverSearch from "@/components/games/DailyGameDriverSearch";
import Button from "@/components/ui/Button";
import {
  type AdminGuessPuzzle,
  adminGuessGameCatalogQuery,
} from "@/lib/queries/adminGuessGame";
import { DRAG_TYPE } from "./dragTypes";

function DraftRow({
  puzzle,
  busy,
  onOpen,
  onApprove,
  onDelete,
}: {
  puzzle: AdminGuessPuzzle;
  busy: boolean;
  onOpen: () => void;
  onApprove: () => void;
  onDelete: () => void;
}) {
  return (
    <li
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData(DRAG_TYPE.guess, String(puzzle.number));
        event.dataTransfer.effectAllowed = "move";
      }}
      className="flex cursor-grab items-center gap-3 px-3 py-2 hover:bg-surface-panel"
    >
      <button
        type="button"
        onClick={onOpen}
        className="min-w-0 flex-1 text-left"
      >
        <span className="block truncate text-xs font-semibold text-ink-strong">
          {puzzle.full_name}
        </span>
        <span className="block truncate text-[11px] text-ink-faint">
          {puzzle.country} · {puzzle.constructor} · {puzzle.debut}–
          {puzzle.last_raced} · {puzzle.career_peak}
        </span>
      </button>
      <Button size="sm" disabled={busy} onClick={onApprove}>
        Schedule
      </Button>
      <button
        type="button"
        disabled={busy}
        onClick={onDelete}
        aria-label="Delete draft"
        className="px-1 text-sm text-ink-faint hover:text-danger-bright"
      >
        ×
      </button>
    </li>
  );
}

export default function GuessDrafts({
  drafts,
  busy,
  onOpen,
  onAdd,
  onRandomize,
  onApprove,
  onDelete,
  onDeleteAll,
}: {
  drafts: AdminGuessPuzzle[];
  busy: boolean;
  onOpen: (number: number) => void;
  /** A chosen driver goes straight onto the schedule. */
  onAdd: (driverSlug: string) => void;
  onRandomize: (count: number) => void;
  onApprove: (number: number) => void;
  onDelete: (number: number) => void;
  onDeleteAll: () => void;
}) {
  const catalog = useQuery(adminGuessGameCatalogQuery());
  const [count, setCount] = useState(5);
  return (
    <section className="rounded-sm border border-line-soft bg-surface-band">
      <div className="flex flex-wrap items-center gap-2 border-b border-line-soft px-3 py-2">
        <h2 className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
          Pole drafts · {drafts.length}
        </h2>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <input
            type="number"
            min={1}
            max={30}
            value={count}
            onChange={(event) => setCount(Number(event.target.value))}
            aria-label="Drivers to randomize"
            className="w-12 rounded-sm border border-line-soft bg-surface-page px-1.5 py-1 font-mono text-xs text-ink-strong"
          />
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={() => onRandomize(count)}
          >
            Randomize
          </Button>
          {drafts.length > 0 && (
            <button
              type="button"
              disabled={busy}
              onClick={onDeleteAll}
              className="text-xs text-ink-faint hover:text-danger-bright"
            >
              Clear all
            </button>
          )}
        </div>
      </div>
      <div className="border-b border-line-soft px-3 py-2">
        <DailyGameDriverSearch
          catalog={catalog.data?.drivers}
          disabled={catalog.isError || busy}
          onSelect={(driver) => onAdd(driver.driver_slug)}
          placeholder="Pick a driver → schedules on the next open day"
        />
      </div>
      {drafts.length === 0 ? (
        <p className="px-3 py-6 text-center text-xs text-ink-faint">
          No drafts. Pick a driver or randomize a few.
        </p>
      ) : (
        <ul className="divide-y divide-line-soft/60">
          {drafts.map((puzzle) => (
            <DraftRow
              key={puzzle.number}
              puzzle={puzzle}
              busy={busy}
              onOpen={() => onOpen(puzzle.number)}
              onApprove={() => onApprove(puzzle.number)}
              onDelete={() => onDelete(puzzle.number)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
