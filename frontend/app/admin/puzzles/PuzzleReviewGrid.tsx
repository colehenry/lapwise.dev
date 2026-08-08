"use client";

import { useState } from "react";
import type { AdminPuzzleDetail, PuzzleAnswer, PuzzleCell } from "@/lib/types";

/** A cell's answers, scrollable in place.
 *
 *  Depth counts and validator flags say a board is legal, not that it is good.
 *  Judging whether a cell is fair means reading the names, so the list is here
 *  rather than behind a click, and every answer carries the numbers the board
 *  gates turn on. */
function CellAnswers({ cell }: { cell: PuzzleCell }) {
  const thin = cell.depth < 3;
  return (
    <div
      className={`flex min-h-0 flex-col rounded-sm border bg-bg-secondary ${
        thin ? "border-amber-500/50" : "border-border-primary"
      }`}
    >
      <div className="border-b border-border-primary px-2 py-1.5">
        <p className="truncate font-mono text-[10px] uppercase tracking-wider text-text-muted">
          {cell.row_label} × {cell.column_label}
        </p>
        <p
          className={`font-mono text-xs font-bold ${
            thin ? "text-amber-400" : "text-text-secondary"
          }`}
        >
          {cell.depth} {cell.depth === 1 ? "answer" : "answers"}
        </p>
      </div>
      <ul className="max-h-52 overflow-y-auto">
        {cell.answers.map((answer) => (
          <AnswerRow key={answer.driver_slug} answer={answer} />
        ))}
      </ul>
    </div>
  );
}

function AnswerRow({ answer }: { answer: PuzzleAnswer }) {
  const years =
    answer.first_season && answer.latest_season
      ? `${answer.first_season}–${answer.latest_season}`
      : "—";
  return (
    <li className="flex items-baseline justify-between gap-2 border-b border-border-primary/50 px-2 py-1 last:border-b-0">
      <span className="truncate text-xs text-text-primary">
        {answer.full_name}
      </span>
      <span className="shrink-0 font-mono text-[10px] text-text-muted">
        {answer.wins}W · {answer.entries}E · {years}
      </span>
    </li>
  );
}

export default function PuzzleReviewGrid({
  puzzle,
}: {
  puzzle: AdminPuzzleDetail;
}) {
  const [showFindings, setShowFindings] = useState(true);
  const errors = puzzle.findings.filter((f) => f.level === "error");
  const warnings = puzzle.findings.filter((f) => f.level === "warning");

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-3">
        {puzzle.cells.map((cell) => (
          <CellAnswers key={cell.cell_id} cell={cell} />
        ))}
      </div>

      {puzzle.findings.length > 0 && (
        <div className="rounded-sm border border-border-primary bg-bg-secondary">
          <button
            type="button"
            onClick={() => setShowFindings((open) => !open)}
            className="flex w-full items-center justify-between px-3 py-2 text-left"
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
