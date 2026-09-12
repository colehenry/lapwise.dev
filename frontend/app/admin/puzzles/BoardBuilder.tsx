"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { formatDay, puzzlePhase } from "@/lib/puzzleSchedule";
import {
  adminGridDetailQuery,
  adminGridHeadersQuery,
  adminGridInvalidation,
  adminGridPreviewQuery,
  approveAdminGridPuzzle,
  createAdminGridPuzzle,
  type PuzzleHeaders,
  replaceAdminGridHeaders,
} from "@/lib/queries/adminGrid";
import HeaderPicker from "./HeaderPicker";
import ReviewCell from "./ReviewCell";

const DEFAULT_FLOOR = 1990;

/** The validator's codes, in the words a reviewer reads them by. The full
 *  message stays on hover. */
const FINDING_LABELS: Record<string, string> = {
  unsolvable: "Can't be completed with nine different drivers",
  empty_cell: "A cell has no answer",
  duplicate_header: "A header is used twice",
  unresolved_driver: "An answer isn't in the driver pool",
  no_secondary_category: "Every header is a constructor, nationality or decade",
  singleton: "A cell has exactly one answer",
  thin_cell_below_floor: "A thin cell with no well-known answer",
  thin_cell_with_singleton: "A thin cell next to a one-answer cell",
  thin_cell_without_anchor: "A thin cell with no big-name answer",
  too_many_thin_cells: "Too many thin cells",
  shared_thin_answer: "Two thin cells rely on the same driver",
  no_marquee_answer: "No famous driver fits this cell",
  forced_assignment: "Only one way to fill the board",
  tight_assignment: "A few cells compete for the same drivers",
  near_identical_cells: "Two cells have the same answers",
  header_implies: "One header is a subset of another",
  free_square: "A giveaway cell (huge answer set)",
  single_axis_decoys: "Rookie Mode decoys only miss one header",
};

function findingLabel(code: string) {
  return FINDING_LABELS[code] ?? code.replace(/_/g, " ");
}
const EMPTY: (string | null)[] = [null, null, null];
// Slot names, so a header slot keeps its identity when its content changes.
const POSITIONS = ["first", "second", "third"] as const;

export function difficultyWord(score: number | null): string {
  if (score === null) return "";
  if (score < 20) return "Easy";
  if (score < 40) return "Medium";
  return "Hard";
}

type Slot = { axis: "rows" | "columns"; index: number };

function HeaderSlot({
  label,
  locked,
  open,
  onOpen,
  onClear,
  className,
  children,
}: {
  label: string | null;
  locked: boolean;
  open: boolean;
  onOpen: () => void;
  onClear: () => void;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`relative flex min-h-16 min-w-0 items-center justify-center border border-line-soft bg-surface-panel ${className ?? ""}`}
    >
      <button
        type="button"
        disabled={locked}
        onClick={onOpen}
        className={`flex h-full w-full items-center justify-center px-2 py-1 text-center text-xs font-semibold leading-tight hover:bg-surface-raised disabled:cursor-default disabled:hover:bg-transparent ${
          label ? "text-ink-strong" : "text-accent-light"
        }`}
      >
        {label ?? (locked ? "—" : "+ Pick")}
      </button>
      {label && !locked && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear header"
          className="absolute right-0.5 top-0.5 px-1 text-[10px] text-ink-faint hover:text-danger-bright"
        >
          ×
        </button>
      )}
      {open && children}
    </div>
  );
}

/** Builds or edits one board.
 *
 *  Every header change re-reads the preview, so the cell counts, the names
 *  behind them and the validator's verdict follow the reviewer's hand. */
export default function BoardBuilder({
  number,
}: {
  /** Null builds a new board. */
  number: number | null;
}) {
  const client = useQueryClient();
  const router = useRouter();
  const back = () => router.push("/admin/puzzles");
  const detail = useQuery({
    ...adminGridDetailQuery(number ?? 0),
    enabled: number !== null,
  });
  const [floor, setFloor] = useState(DEFAULT_FLOOR);
  const [rows, setRows] = useState(EMPTY);
  const [columns, setColumns] = useState(EMPTY);
  const [seeded, setSeeded] = useState(number === null);
  const [picking, setPicking] = useState<Slot | null>(null);
  const [showSolution, setShowSolution] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!detail.data || seeded) return;
    setFloor(detail.data.eligibility_floor);
    setRows(detail.data.rows.map((row) => row.id));
    setColumns(detail.data.columns.map((column) => column.id));
    setSeeded(true);
  }, [detail.data, seeded]);

  const headers: PuzzleHeaders = { eligibility_floor: floor, rows, columns };
  const catalog = useQuery(adminGridHeadersQuery(floor));
  const preview = useQuery({
    ...adminGridPreviewQuery(headers),
    enabled: seeded,
  });
  const complete = [...rows, ...columns].every(Boolean);
  const locked = detail.data ? puzzlePhase(detail.data) === "live" : false;
  const dated = detail.data?.published_on ?? null;

  const options = new Map(
    (catalog.data?.headers ?? []).map((header) => [header.id, header]),
  );
  const labels = new Map(
    [...options.values()].map((header) => [header.id, header.label]),
  );
  // What a column pick must cross: the rows already placed, and vice versa.
  const placed = (ids: (string | null)[]) =>
    ids.flatMap((id) => {
      const option = id ? options.get(id) : undefined;
      return option ? [option] : [];
    });
  const labelFor = (id: string | null) => (id ? (labels.get(id) ?? id) : null);
  const taken = new Set([...rows, ...columns].filter(Boolean) as string[]);
  const cells = new Map(
    (preview.data?.cells ?? []).map((cell) => [cell.cell_id, cell]),
  );
  const findings = preview.data?.findings ?? [];
  const errors = findings.filter((finding) => finding.level === "error");
  const warnings = findings.filter((finding) => finding.level === "warning");

  const set = (slot: Slot, id: string | null) => {
    const update = (values: (string | null)[]) =>
      values.map((value, index) => (index === slot.index ? id : value));
    if (slot.axis === "rows") setRows(update);
    else setColumns(update);
    setPicking(null);
  };

  const save = useMutation({
    mutationFn: async (approve: boolean) => {
      const saved =
        number === null
          ? await createAdminGridPuzzle(headers)
          : await replaceAdminGridHeaders(number, headers);
      if (approve && !dated) await approveAdminGridPuzzle(saved.number);
    },
    onSuccess: () => {
      client.invalidateQueries(adminGridInvalidation());
      back();
    },
    onError: (reason) =>
      setError(reason instanceof Error ? reason.message : "Save failed"),
  });

  const canSave = complete && errors.length === 0 && !save.isPending && !locked;

  const solution = showSolution ? (preview.data?.solution ?? null) : null;

  return (
    <div className="mx-auto max-w-3xl">
      <div>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <Link
            href="/admin/puzzles"
            className="text-xs text-ink-faint hover:text-ink-strong"
          >
            ← Games
          </Link>
          <h2 className="font-mono text-sm font-bold text-ink-strong">
            {number === null
              ? "New board"
              : `#${String(number).padStart(3, "0")}`}
          </h2>
          {dated && (
            <span className="text-xs text-ink-faint">
              {locked ? "Live" : "Runs"} {formatDay(dated)}
            </span>
          )}
          {preview.data?.difficulty_score != null && (
            <span className="text-xs text-ink-base">
              {difficultyWord(preview.data.difficulty_score)}
            </span>
          )}
          <label className="ml-auto flex items-center gap-1.5 text-xs text-ink-faint">
            Since
            <input
              type="number"
              min={1950}
              max={2100}
              value={floor}
              disabled={locked}
              onChange={(event) => setFloor(Number(event.target.value))}
              className="w-16 rounded-sm border border-line-soft bg-surface-band px-1.5 py-0.5 font-mono text-xs text-ink-strong"
            />
          </label>
          <span className="text-xs text-ink-faint">
            {catalog.data ? `${catalog.data.pool_size} drivers` : "Loading…"}
          </span>
          {/* A solution exists only for a complete, completable board. */}
          {preview.data?.solution && (
            <button
              type="button"
              onClick={() => setShowSolution((open) => !open)}
              aria-pressed={showSolution}
              className={`rounded-sm border px-2 py-0.5 text-xs ${
                showSolution
                  ? "border-accent/30 bg-accent/15 text-accent-light"
                  : "border-line-soft text-ink-base hover:bg-surface-panel"
              }`}
            >
              {showSolution ? "Hide solution" : "Best solution"}
            </button>
          )}
        </div>

        <div className="grid grid-cols-[8rem_repeat(3,minmax(0,1fr))]">
          <div className="flex min-h-16 items-center justify-center rounded-tl-sm border border-line-soft bg-surface-band">
            <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
              {preview.isFetching ? "…" : "Grid"}
            </span>
          </div>
          {POSITIONS.map((position, index) => (
            <HeaderSlot
              key={position}
              label={
                columns[index]
                  ? (labels.get(columns[index]) ?? columns[index])
                  : null
              }
              locked={locked}
              open={picking?.axis === "columns" && picking.index === index}
              onOpen={() => setPicking({ axis: "columns", index })}
              onClear={() => set({ axis: "columns", index }, null)}
              className={index === 2 ? "rounded-tr-sm" : undefined}
            >
              <HeaderPicker
                headers={catalog.data?.headers ?? []}
                taken={taken}
                against={placed(rows)}
                onPick={(picked) => set({ axis: "columns", index }, picked)}
                onClose={() => setPicking(null)}
              />
            </HeaderSlot>
          ))}
          {POSITIONS.map((rowPosition, rowIndex) => (
            <div key={rowPosition} className="contents">
              <HeaderSlot
                label={labelFor(rows[rowIndex])}
                locked={locked}
                open={picking?.axis === "rows" && picking.index === rowIndex}
                onOpen={() => setPicking({ axis: "rows", index: rowIndex })}
                onClear={() => set({ axis: "rows", index: rowIndex }, null)}
                className={rowIndex === 2 ? "rounded-bl-sm" : undefined}
              >
                <HeaderPicker
                  headers={catalog.data?.headers ?? []}
                  taken={taken}
                  against={placed(columns)}
                  onPick={(picked) =>
                    set({ axis: "rows", index: rowIndex }, picked)
                  }
                  onClose={() => setPicking(null)}
                />
              </HeaderSlot>
              {POSITIONS.map((columnPosition, columnIndex) => {
                const rowId = rows[rowIndex];
                const columnId = columns[columnIndex];
                const corner =
                  rowIndex === 2 && columnIndex === 2 ? "rounded-br-sm" : "";
                const cell =
                  rowId && columnId
                    ? cells.get(`${rowId}__${columnId}`)
                    : undefined;
                return cell ? (
                  <ReviewCell
                    key={cell.cell_id}
                    cell={cell}
                    findings={findings}
                    solution={solution?.[cell.cell_id]}
                    className={corner}
                  />
                ) : (
                  <div
                    key={columnPosition}
                    className={`min-h-16 border border-line-soft bg-surface-band/40 ${corner}`}
                  />
                );
              })}
            </div>
          ))}
        </div>

        {/* Errors block saving and always show. Warnings are notes — the
            validator's opinion on shape, not a verdict — so they sit behind
            a count. */}
        {errors.length > 0 && (
          <ul className="mt-3 space-y-1 text-xs">
            {errors.map((finding) => (
              <li
                key={`${finding.code}-${finding.message}`}
                title={finding.message}
                className="flex gap-2"
              >
                <span className="shrink-0 font-mono text-[10px] font-bold uppercase text-danger-bright">
                  fail
                </span>
                <span className="text-ink-strong">
                  {findingLabel(finding.code)}
                </span>
              </li>
            ))}
          </ul>
        )}
        {warnings.length > 0 && (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setShowNotes((open) => !open)}
              className="text-xs text-ink-faint hover:text-ink-strong"
            >
              {warnings.length} note{warnings.length === 1 ? "" : "s"}{" "}
              {showNotes ? "▾" : "▸"}
            </button>
            {showNotes && (
              <ul className="mt-1 space-y-1 text-xs">
                {warnings.map((finding) => (
                  <li
                    key={`${finding.code}-${finding.message}`}
                    title={finding.message}
                    className="flex gap-2"
                  >
                    <span className="shrink-0 font-mono text-[10px] font-bold uppercase text-amber-400">
                      note
                    </span>
                    <span className="text-ink-base">
                      {findingLabel(finding.code)}
                    </span>
                    <span className="truncate text-ink-faint">
                      {finding.message}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {error && (
          <p className="mt-3 rounded-sm border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger-bright">
            {error}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {!locked && (
            <>
              <Button
                size="sm"
                disabled={!canSave}
                onClick={() => save.mutate(!dated)}
              >
                {dated ? "Save" : "Save & schedule"}
              </Button>
              {!dated && (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!canSave}
                  onClick={() => save.mutate(false)}
                >
                  Save draft
                </Button>
              )}
            </>
          )}
          <Button size="sm" variant="ghost" onClick={back}>
            {locked ? "Back" : "Cancel"}
          </Button>
          {!complete && !locked && (
            <span className="text-xs text-ink-faint">
              Six headers to go live.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
