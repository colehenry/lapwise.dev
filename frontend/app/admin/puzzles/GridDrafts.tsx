"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import Button from "@/components/ui/Button";
import {
  type AdminPuzzleSummary,
  adminGridHeadersQuery,
  type PuzzleGenerateRequest,
} from "@/lib/queries/adminGrid";
import { difficultyWord } from "./BoardBuilder";
import { DRAG_TYPE } from "./dragTypes";
import HeaderPicker from "./HeaderPicker";
import { DepthHeatmap } from "./ScheduleBoard";

const DEFAULT_FLOOR = 1990;

function DraftCard({
  puzzle,
  busy,
  onOpen,
  onApprove,
  onDelete,
}: {
  puzzle: AdminPuzzleSummary;
  busy: boolean;
  onOpen: () => void;
  onApprove: () => void;
  onDelete: () => void;
}) {
  return (
    <li
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData(DRAG_TYPE.grid, String(puzzle.number));
        event.dataTransfer.effectAllowed = "move";
      }}
      className="flex cursor-grab items-center gap-3 px-3 py-2 hover:bg-surface-panel"
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <span className="font-mono text-xs font-bold text-ink-strong">
          #{String(puzzle.number).padStart(3, "0")}
        </span>
        <DepthHeatmap depths={puzzle.cell_depths} />
        <span className="text-xs text-ink-faint">
          {puzzle.min_depth}–{puzzle.max_depth}
        </span>
        <span className="text-xs text-ink-faint">
          {difficultyWord(puzzle.difficulty_score)}
        </span>
        {puzzle.error_count > 0 && (
          <span className="text-xs font-semibold text-danger-bright">
            {puzzle.error_count} err
          </span>
        )}
        {puzzle.warning_count > 0 && (
          <span className="text-xs text-amber-400">
            {puzzle.warning_count} warn
          </span>
        )}
      </button>
      <Button
        size="sm"
        disabled={busy || puzzle.error_count > 0}
        onClick={onApprove}
      >
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

/** Proposals from the generator. Anything failing validation is dropped
 *  server-side, so fewer boards than asked for is normal. */
function GeneratePanel({
  busy,
  onGenerate,
}: {
  busy: boolean;
  onGenerate: (request: PuzzleGenerateRequest) => void;
}) {
  const [count, setCount] = useState(5);
  const [theme, setTheme] = useState<string[]>([]);
  const [picking, setPicking] = useState(false);
  const catalog = useQuery(adminGridHeadersQuery(DEFAULT_FLOOR));
  const labels = new Map(
    (catalog.data?.headers ?? []).map((header) => [header.id, header.label]),
  );
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="number"
        min={1}
        max={30}
        value={count}
        onChange={(event) => setCount(Number(event.target.value))}
        aria-label="Boards to generate"
        className="w-12 rounded-sm border border-line-soft bg-surface-page px-1.5 py-1 font-mono text-xs text-ink-strong"
      />
      <Button
        size="sm"
        variant="secondary"
        disabled={busy}
        onClick={() =>
          onGenerate({ count, eligibility_floor: DEFAULT_FLOOR, theme })
        }
      >
        {busy ? "Generating…" : "Generate"}
      </Button>
      {theme.map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => setTheme(theme.filter((value) => value !== id))}
          className="rounded-sm border border-accent/30 bg-accent/10 px-1.5 py-0.5 text-[11px] text-ink-strong hover:border-danger/40"
        >
          {labels.get(id) ?? id} ×
        </button>
      ))}
      <div className="relative">
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="text-xs text-ink-faint hover:text-accent-light"
        >
          + theme
        </button>
        {picking && (
          <HeaderPicker
            headers={catalog.data?.headers ?? []}
            taken={new Set(theme)}
            onPick={(id) => {
              setTheme([...theme, id]);
              setPicking(false);
            }}
            onClose={() => setPicking(false)}
          />
        )}
      </div>
    </div>
  );
}

export default function GridDrafts({
  drafts,
  busy,
  onNew,
  onOpen,
  onApprove,
  onDelete,
  onDeleteAll,
  onGenerate,
}: {
  drafts: AdminPuzzleSummary[];
  busy: boolean;
  onNew: () => void;
  onOpen: (number: number) => void;
  onApprove: (number: number) => void;
  onDelete: (number: number) => void;
  onDeleteAll: () => void;
  onGenerate: (request: PuzzleGenerateRequest) => void;
}) {
  return (
    <section className="rounded-sm border border-line-soft bg-surface-band">
      <div className="flex flex-wrap items-center gap-2 border-b border-line-soft px-3 py-2">
        <h2 className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
          Grid drafts · {drafts.length}
        </h2>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={onNew}>
            New board
          </Button>
          <GeneratePanel busy={busy} onGenerate={onGenerate} />
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
      {drafts.length === 0 ? (
        <p className="px-3 py-6 text-center text-xs text-ink-faint">
          No drafts. Build one or generate a few.
        </p>
      ) : (
        <ul className="divide-y divide-line-soft/60">
          {drafts.map((puzzle) => (
            <DraftCard
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
