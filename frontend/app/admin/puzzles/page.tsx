"use client";

import { useCallback, useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import {
  adminDeleteAllDrafts,
  adminDeletePuzzle,
  adminRevertPuzzle,
  adminSchedulePuzzle,
  fetchAdminPuzzle,
  fetchAdminPuzzles,
} from "@/lib/admin";
import type { AdminPuzzleDetail, AdminPuzzleSummary } from "@/lib/adminTypes";
import {
  type PuzzlePhase,
  puzzleDate,
  puzzlePhase,
} from "@/lib/puzzleSchedule";
import GeneratePanel from "./GeneratePanel";
import PuzzleReviewGrid from "./PuzzleReviewGrid";
import RolloverNotice from "./RolloverNotice";

// Phases, not statuses: a published board is live only once its date arrives,
// and both halves of that split read as "published" in the database.
const FILTERS: { value: PuzzlePhase | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Drafts" },
  { value: "scheduled", label: "Scheduled" },
  { value: "live", label: "Live" },
];

const PHASE_STYLES: Record<PuzzlePhase, string> = {
  draft: "bg-bg-elevated text-text-muted",
  scheduled: "bg-amber-500/15 text-amber-300",
  live: "bg-emerald-500/15 text-emerald-300",
};

const PHASE_LABELS: Record<PuzzlePhase, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  live: "Live",
};

const DEFAULT_FLOOR = 1990;

/** The 0–100 score as the three words a reviewer actually sorts by. */
function difficultyWord(score: number): string {
  if (score < 20) return "Easy";
  if (score < 40) return "Medium";
  return "Hard";
}

function PuzzleRow({
  puzzle,
  phase,
  expanded,
  onToggle,
}: {
  puzzle: AdminPuzzleSummary;
  phase: PuzzlePhase;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full flex-wrap items-center gap-x-4 gap-y-1.5 px-3 py-3 text-left hover:bg-bg-tertiary"
    >
      <span className="font-mono text-sm font-bold text-text-primary">
        #{String(puzzle.number).padStart(3, "0")}
      </span>
      <span
        className={`rounded-sm px-1.5 py-0.5 text-[11px] font-semibold ${PHASE_STYLES[phase]}`}
      >
        {PHASE_LABELS[phase]}
      </span>
      <span className="text-sm text-text-secondary">
        {puzzle.published_on ?? "No date"}
      </span>
      <span
        className="text-sm text-text-muted"
        title="Fewest and most drivers that answer a square"
      >
        {puzzle.min_depth}–{puzzle.max_depth} answers
      </span>
      {puzzle.difficulty_score !== null && (
        <span
          className="text-sm text-text-muted"
          title={`Score ${puzzle.difficulty_score} of 100`}
        >
          {difficultyWord(puzzle.difficulty_score)}
        </span>
      )}
      {puzzle.eligibility_floor !== DEFAULT_FLOOR && (
        <span className="text-sm text-text-muted">
          {puzzle.eligibility_floor}+
        </span>
      )}
      {puzzle.error_count > 0 && (
        <span className="text-sm font-semibold text-red-400">
          {puzzle.error_count} error{puzzle.error_count === 1 ? "" : "s"}
        </span>
      )}
      {puzzle.warning_count > 0 && (
        <span className="text-sm text-amber-400">
          {puzzle.warning_count} warning{puzzle.warning_count === 1 ? "" : "s"}
        </span>
      )}
      <span className="ml-auto text-sm text-text-muted">
        {expanded ? "Close" : "Review"}
      </span>
    </button>
  );
}

export default function AdminPuzzlesPage() {
  const [puzzles, setPuzzles] = useState<AdminPuzzleSummary[]>([]);
  const [filter, setFilter] = useState<PuzzlePhase | "all">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openNumber, setOpenNumber] = useState<number | null>(null);
  const [detail, setDetail] = useState<AdminPuzzleDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [busy, setBusy] = useState(false);

  const phases = new Map(
    puzzles.map((puzzle) => [puzzle.number, puzzlePhase(puzzle)]),
  );
  // Filtered here rather than by the API: scheduled and live are one status
  // server-side, and the date that separates them is the browser's to read.
  const visible = puzzles.filter(
    (puzzle) => filter === "all" || phases.get(puzzle.number) === filter,
  );
  const draftCount = puzzles.filter(
    (puzzle) => puzzle.status === "draft",
  ).length;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchAdminPuzzles();
      setPuzzles(data.puzzles);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load boards");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = async (puzzle: AdminPuzzleSummary) => {
    if (openNumber === puzzle.number) {
      setOpenNumber(null);
      setDetail(null);
      return;
    }
    setOpenNumber(puzzle.number);
    setDetail(null);
    setScheduleDate(puzzle.published_on ?? "");
    setDetailLoading(true);
    try {
      setDetail(await fetchAdminPuzzle(puzzle.number));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load board");
    } finally {
      setDetailLoading(false);
    }
  };

  const act = async (action: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await action();
      setOpenNumber(null);
      setDetail(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start gap-3">
        <GeneratePanel onGenerated={load} />
        {draftCount > 0 && (
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={() => {
              if (
                !window.confirm(
                  `Delete all ${draftCount} draft${draftCount === 1 ? "" : "s"}? Scheduled and live boards are untouched.`,
                )
              )
                return;
              act(async () => {
                await adminDeleteAllDrafts();
              });
            }}
          >
            Delete {draftCount} draft{draftCount === 1 ? "" : "s"}
          </Button>
        )}
      </div>

      <RolloverNotice />

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setFilter(option.value)}
            className={`rounded-sm border px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === option.value
                ? "border-purple-500/30 bg-purple-500/15 text-purple-300"
                : "border-transparent text-text-secondary hover:bg-bg-tertiary"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="rounded-sm border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {loading ? (
        <div className="space-y-2">
          {["a", "b", "c"].map((key) => (
            <div
              key={key}
              className="h-12 animate-pulse rounded-sm border border-border-primary bg-bg-tertiary"
            />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <p className="rounded-sm border border-border-primary bg-bg-secondary px-3 py-8 text-center text-sm text-text-muted">
          Nothing here yet. Generate some boards.
        </p>
      ) : (
        <div className="divide-y divide-border-primary rounded-sm border border-border-primary bg-bg-secondary">
          {visible.map((puzzle) => (
            <div key={puzzle.number}>
              <PuzzleRow
                puzzle={puzzle}
                phase={phases.get(puzzle.number) ?? "draft"}
                expanded={openNumber === puzzle.number}
                onToggle={() => toggle(puzzle)}
              />
              {openNumber === puzzle.number && (
                <div className="border-t border-border-primary bg-bg-primary p-3">
                  {detailLoading || !detail ? (
                    <div className="h-40 animate-pulse rounded-sm bg-bg-tertiary" />
                  ) : (
                    <div className="space-y-4">
                      <PuzzleReviewGrid puzzle={detail} />

                      <div className="flex flex-wrap items-center gap-2 border-t border-border-primary pt-3">
                        <label
                          htmlFor={`date-${puzzle.number}`}
                          className="text-sm text-text-secondary"
                        >
                          Run on
                        </label>
                        <input
                          id={`date-${puzzle.number}`}
                          type="date"
                          value={scheduleDate}
                          onChange={(event) =>
                            setScheduleDate(event.target.value)
                          }
                          className="rounded-sm border border-border-primary bg-bg-secondary px-2 py-1 text-sm text-text-primary"
                        />
                        {/* A past date goes live at once and a future one waits:
                            same endpoint, and the date gate in the player
                            service is the whole difference. */}
                        <button
                          type="button"
                          onClick={() => setScheduleDate(puzzleDate(0))}
                          className="rounded-sm border border-border-primary px-2 py-1 text-sm text-text-secondary hover:bg-bg-tertiary"
                        >
                          Today
                        </button>
                        <button
                          type="button"
                          onClick={() => setScheduleDate(puzzleDate(1))}
                          className="rounded-sm border border-border-primary px-2 py-1 text-sm text-text-secondary hover:bg-bg-tertiary"
                        >
                          Tomorrow
                        </button>
                        <Button
                          size="sm"
                          disabled={
                            busy ||
                            !scheduleDate ||
                            detail.error_count > 0 ||
                            puzzle.status === "published"
                          }
                          onClick={() =>
                            act(() =>
                              adminSchedulePuzzle(puzzle.number, scheduleDate),
                            )
                          }
                        >
                          {scheduleDate && scheduleDate <= puzzleDate(0)
                            ? "Publish now"
                            : "Schedule"}
                        </Button>
                        {puzzle.status !== "draft" && (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={busy}
                            onClick={() =>
                              act(() => adminRevertPuzzle(puzzle.number))
                            }
                          >
                            Unschedule
                          </Button>
                        )}
                        {/* Allowed at any status: the gate is whether anyone has
                            played the board, which the server enforces. */}
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={busy}
                          onClick={() => {
                            if (
                              phases.get(puzzle.number) === "live" &&
                              !window.confirm(
                                `Delete #${puzzle.number}? It is live at /daily and its date frees up.`,
                              )
                            )
                              return;
                            act(() => adminDeletePuzzle(puzzle.number));
                          }}
                        >
                          Delete
                        </Button>
                        {detail.error_count > 0 && (
                          <span className="text-sm text-red-400">
                            Fix the errors above first.
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
