"use client";

import type {
  PuzzleAnswer,
  PuzzleCell,
  PuzzleFinding,
} from "@/lib/queries/adminGrid";

const STANDARD_MIN_ANSWERS = 3;

/** Findings name their cell as `row__column` inside a longer message, so the
 *  cell id is matched as a substring rather than parsed out of it. */
export function findingsForCell(cellId: string, findings: PuzzleFinding[]) {
  return findings.filter((finding) => finding.message.includes(cellId));
}

function withoutCellId(message: string, cellId: string) {
  return message.startsWith(`${cellId}: `)
    ? message.slice(cellId.length + 2)
    : message;
}

function AnswerRow({ answer }: { answer: PuzzleAnswer }) {
  const years =
    answer.first_season && answer.latest_season
      ? `${answer.first_season}–${answer.latest_season}`
      : "—";
  return (
    <li className="flex items-baseline justify-between gap-3 py-0.5">
      <span className="truncate text-[11px] text-ink-strong">
        {answer.full_name}
      </span>
      <span className="shrink-0 font-mono text-[9px] text-ink-faint">
        {answer.wins}W · {answer.entries}E · {years}
      </span>
    </li>
  );
}

/** Tone for an answer count, shared by cells and the queue's heatmaps. */
export function depthTone(depth: number): "fail" | "warn" | "ok" {
  if (depth < 2) return "fail";
  if (depth < STANDARD_MIN_ANSWERS) return "warn";
  return "ok";
}

/** One square of a board under review.
 *
 *  Closed, it shows only the answer count, so the board reads the way a
 *  player meets it. The names open on hover, because judging whether a cell
 *  is fair means reading them. */
export default function ReviewCell({
  cell,
  findings,
  solution,
  className,
}: {
  cell: PuzzleCell;
  findings: PuzzleFinding[];
  /** The driver a solution places here; shown in place of the count. */
  solution?: PuzzleAnswer;
  className?: string;
}) {
  const cellFindings = findingsForCell(cell.cell_id, findings);
  const failed =
    cellFindings.some((finding) => finding.level === "error") ||
    depthTone(cell.depth) === "fail";
  const flagged =
    failed || cellFindings.length > 0 || depthTone(cell.depth) === "warn";

  const tone = failed
    ? "border-danger/60 bg-danger/5"
    : flagged
      ? "border-amber-500/50 bg-amber-500/5"
      : "border-line-soft bg-surface-band";
  const countTone = failed
    ? "text-danger-bright"
    : flagged
      ? "text-amber-400"
      : "text-ink-base";

  return (
    <div
      className={`group relative flex min-h-16 min-w-0 items-center justify-center border ${tone} ${className ?? ""}`}
    >
      {solution ? (
        <span className="px-1 text-center text-xs font-semibold leading-tight text-ink-strong">
          {solution.full_name}
        </span>
      ) : (
        <span className={`font-mono text-base font-bold ${countTone}`}>
          {cell.depth}
        </span>
      )}
      {flagged && (
        <span
          className={`absolute right-1 top-1 h-1.5 w-1.5 rounded-full ${
            failed ? "bg-danger-bright" : "bg-amber-400"
          }`}
          aria-hidden="true"
        />
      )}

      <div className="pointer-events-none absolute left-1/2 top-full z-50 mt-1 w-64 -translate-x-1/2 -translate-y-1 rounded-sm border border-line-soft bg-surface-raised p-2 text-left opacity-0 shadow-lg transition-all group-hover:translate-y-0 group-hover:opacity-100">
        <p className="truncate font-mono text-[9px] uppercase tracking-wider text-ink-faint">
          {cell.row_label} × {cell.column_label}
        </p>
        <p className={`font-mono text-[10px] font-bold ${countTone}`}>
          {cell.depth} {cell.depth === 1 ? "answer" : "answers"}
        </p>
        {cellFindings.map((finding) => (
          <p
            key={`${finding.code}-${finding.message}`}
            className={`mt-1 text-[10px] ${
              finding.level === "error"
                ? "text-danger-bright"
                : "text-amber-400"
            }`}
          >
            {withoutCellId(finding.message, cell.cell_id)}
          </p>
        ))}
        <ul className="mt-1 max-h-56 overflow-y-auto border-t border-line-soft pt-1">
          {cell.answers.map((answer) => (
            <AnswerRow key={answer.driver_slug} answer={answer} />
          ))}
        </ul>
      </div>
    </div>
  );
}
