"use client";

import { useState } from "react";
import GameCategoryHeader from "@/components/daily/GameCategoryHeader";
import type {
  AdminPuzzleDetail,
  PuzzleAnswer,
  PuzzleCell,
  PuzzleFinding,
} from "@/lib/adminTypes";

const STANDARD_MIN_ANSWERS = 3;

/** Findings name their cell as `row__column` inside a longer message, so the
 *  cell id is matched as a substring rather than parsed out of it. */
function findingsForCell(cellId: string, findings: PuzzleFinding[]) {
  return findings.filter((finding) => finding.message.includes(cellId));
}

function AnswerRow({ answer }: { answer: PuzzleAnswer }) {
  const years =
    answer.first_season && answer.latest_season
      ? `${answer.first_season}–${answer.latest_season}`
      : "—";
  return (
    <li className="flex items-baseline justify-between gap-3 py-0.5">
      <span className="truncate text-[11px] text-text-primary">
        {answer.full_name}
      </span>
      <span className="shrink-0 font-mono text-[9px] text-text-muted">
        {answer.wins}W · {answer.entries}E · {years}
      </span>
    </li>
  );
}

/** One square of the review board.
 *
 *  Closed, it shows only the answer count, so the board reads the way a player
 *  meets it — nine empty squares under two headers. The names are the actual
 *  review and they open on hover, because judging whether a cell is fair means
 *  reading them, not counting them. */
function ReviewCell({
  cell,
  findings,
  cornerClass,
}: {
  cell: PuzzleCell;
  findings: PuzzleFinding[];
  cornerClass?: string;
}) {
  const cellFindings = findingsForCell(cell.cell_id, findings);
  const failed = cellFindings.some((finding) => finding.level === "error");
  const flagged = cellFindings.length > 0 || cell.depth < STANDARD_MIN_ANSWERS;

  const tone = failed
    ? "border-red-500/60 bg-red-500/5"
    : flagged
      ? "border-amber-500/50 bg-amber-500/5"
      : "border-border-primary bg-bg-secondary";
  const countTone = failed
    ? "text-red-400"
    : flagged
      ? "text-amber-400"
      : "text-text-secondary";

  return (
    <div
      className={`group relative flex min-h-14 min-w-0 items-center justify-center border ${tone} ${cornerClass ?? ""}`}
    >
      <span className={`font-mono text-sm font-bold ${countTone}`}>
        {cell.depth}
      </span>
      {flagged && (
        <span
          className={`absolute right-1 top-1 h-1.5 w-1.5 rounded-full ${
            failed ? "bg-red-400" : "bg-amber-400"
          }`}
          aria-hidden="true"
        />
      )}

      <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1 w-64 -translate-x-1/2 translate-y-1 rounded-sm border border-border-primary bg-bg-elevated p-2 text-left opacity-0 shadow-lg transition-all group-hover:translate-y-0 group-hover:opacity-100">
        <p className="truncate font-mono text-[9px] uppercase tracking-wider text-text-muted">
          {cell.row_label} × {cell.column_label}
        </p>
        <p className={`font-mono text-[10px] font-bold ${countTone}`}>
          {cell.depth} {cell.depth === 1 ? "answer" : "answers"}
        </p>
        {/* A cell can carry two findings of one code — two near-identical
            pairings, say — so the message is part of the identity. */}
        {cellFindings.map((finding) => (
          <p
            key={`${finding.code}-${finding.message}`}
            className={`mt-1 text-[10px] ${
              finding.level === "error" ? "text-red-400" : "text-amber-400"
            }`}
          >
            {finding.message}
          </p>
        ))}
        <ul className="mt-1 max-h-56 overflow-y-auto border-t border-border-primary pt-1">
          {cell.answers.map((answer) => (
            <AnswerRow key={answer.driver_slug} answer={answer} />
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function PuzzleReviewGrid({
  puzzle,
}: {
  puzzle: AdminPuzzleDetail;
}) {
  const [showFindings, setShowFindings] = useState(false);
  const errors = puzzle.findings.filter((f) => f.level === "error");
  const warnings = puzzle.findings.filter((f) => f.level === "warning");
  const byCell = new Map(puzzle.cells.map((cell) => [cell.cell_id, cell]));

  return (
    <div className="space-y-3">
      {/* Capped rather than fluid: this is a preview of a board, and a preview
          the width of the queue stops reading as one. */}
      <div className="max-w-md">
        <div className="grid grid-cols-[3.5rem_repeat(3,minmax(0,1fr))]">
          <div className="flex min-h-14 items-center justify-center rounded-tl-sm border border-border-primary bg-bg-secondary">
            <span className="font-mono text-[9px] uppercase tracking-wider text-text-muted">
              #{puzzle.number}
            </span>
          </div>
          {puzzle.columns.map((column, index) => (
            <GameCategoryHeader
              key={column.id}
              category={column}
              size="compact"
              className={
                index === puzzle.columns.length - 1
                  ? "rounded-tr-sm"
                  : undefined
              }
            />
          ))}

          {puzzle.rows.map((row, rowIndex) => {
            const lastRow = rowIndex === puzzle.rows.length - 1;
            return (
              <div key={row.id} className="contents">
                <GameCategoryHeader
                  category={row}
                  orientation="row"
                  size="compact"
                  className={lastRow ? "rounded-bl-sm" : undefined}
                />
                {puzzle.columns.map((column, columnIndex) => {
                  const cellId = `${row.id}__${column.id}`;
                  const cell = byCell.get(cellId);
                  if (!cell) return null;
                  return (
                    <ReviewCell
                      key={cellId}
                      cell={cell}
                      findings={puzzle.findings}
                      cornerClass={
                        lastRow && columnIndex === puzzle.columns.length - 1
                          ? "rounded-br-sm"
                          : undefined
                      }
                    />
                  );
                })}
              </div>
            );
          })}
        </div>

        <p className="mt-1.5 text-[10px] leading-relaxed text-text-muted">
          Each square shows how many drivers answer it. Hover a square for the
          names. Amber is a cell the validator flagged, red is one that blocks
          scheduling.
        </p>
      </div>

      {puzzle.findings.length > 0 && (
        <div className="max-w-md rounded-sm border border-border-primary bg-bg-secondary">
          <button
            type="button"
            onClick={() => setShowFindings((open) => !open)}
            className="flex w-full items-center justify-between px-3 py-1.5 text-left"
          >
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-text-secondary">
              {errors.length} error{errors.length === 1 ? "" : "s"} ·{" "}
              {warnings.length} warning{warnings.length === 1 ? "" : "s"}
            </span>
            <span className="text-xs text-text-muted">
              {showFindings ? "Hide" : "Show"}
            </span>
          </button>
          {showFindings && (
            <ul className="border-t border-border-primary px-3 py-2">
              {puzzle.findings.map((finding) => (
                <li
                  key={`${finding.code}-${finding.message}`}
                  className="flex gap-2 py-1 text-xs"
                >
                  <span
                    className={`shrink-0 font-mono text-[10px] font-bold uppercase ${
                      finding.level === "error"
                        ? "text-red-400"
                        : "text-amber-400"
                    }`}
                  >
                    {finding.level === "error" ? "fail" : "warn"}
                  </span>
                  <span className="text-text-secondary">{finding.message}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
