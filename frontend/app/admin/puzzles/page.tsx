"use client";

import { useCallback, useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import {
  adminDeletePuzzle,
  adminRevertPuzzle,
  adminSchedulePuzzle,
  fetchAdminPuzzle,
  fetchAdminPuzzles,
} from "@/lib/admin";
import type {
  AdminPuzzleDetail,
  AdminPuzzleSummary,
  PuzzleStatus,
} from "@/lib/types";
import PuzzleReviewGrid from "./PuzzleReviewGrid";

const FILTERS: { value: PuzzleStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "approved", label: "Approved" },
  { value: "published", label: "Published" },
];

const STATUS_STYLES: Record<PuzzleStatus, string> = {
  draft: "bg-bg-elevated text-text-muted",
  approved: "bg-amber-500/15 text-amber-300",
  published: "bg-emerald-500/15 text-emerald-300",
};

function StatusChip({ status }: { status: PuzzleStatus }) {
  return (
    <span
      className={`rounded-sm px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}

function PuzzleRow({
  puzzle,
  expanded,
  onToggle,
}: {
  puzzle: AdminPuzzleSummary;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full flex-wrap items-center gap-3 px-3 py-2.5 text-left hover:bg-bg-tertiary"
    >
      <span className="font-mono text-sm font-bold text-text-primary">
        #{String(puzzle.number).padStart(3, "0")}
      </span>
      <StatusChip status={puzzle.status} />
      <span className="font-mono text-xs text-text-secondary">
        {puzzle.published_on ?? "unscheduled"}
      </span>
      <span className="font-mono text-[10px] text-text-muted">
        depth {puzzle.min_depth}–{puzzle.max_depth}
        {puzzle.difficulty_score !== null &&
          ` · difficulty ${puzzle.difficulty_score}`}
        {` · floor ${puzzle.eligibility_floor}`}
      </span>
      {puzzle.error_count > 0 && (
        <span className="font-mono text-[10px] font-bold text-red-400">
          {puzzle.error_count} error{puzzle.error_count === 1 ? "" : "s"}
        </span>
      )}
      {puzzle.warning_count > 0 && (
        <span className="font-mono text-[10px] text-amber-400">
          {puzzle.warning_count} warning{puzzle.warning_count === 1 ? "" : "s"}
        </span>
      )}
      <span className="ml-auto text-xs text-text-muted">
        {expanded ? "Close" : "Review"}
      </span>
    </button>
  );
}

export default function AdminPuzzlesPage() {
  const [puzzles, setPuzzles] = useState<AdminPuzzleSummary[]>([]);
  const [filter, setFilter] = useState<PuzzleStatus | "all">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openNumber, setOpenNumber] = useState<number | null>(null);
  const [detail, setDetail] = useState<AdminPuzzleDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchAdminPuzzles(
        filter === "all" ? undefined : filter,
      );
      setPuzzles(data.puzzles);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load puzzles");
    } finally {
      setLoading(false);
    }
  }, [filter]);

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
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setFilter(option.value)}
            className={`rounded-sm border px-3 py-1.5 text-xs font-medium transition-colors ${
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
      ) : puzzles.length === 0 ? (
        <p className="rounded-sm border border-border-primary bg-bg-secondary px-3 py-6 text-center text-sm text-text-muted">
          No boards in this state. Run{" "}
          <code className="font-mono text-xs">scripts/game_generator.py</code>{" "}
          to propose some.
        </p>
      ) : (
        <div className="divide-y divide-border-primary rounded-sm border border-border-primary bg-bg-secondary">
          {puzzles.map((puzzle) => (
            <div key={puzzle.number}>
              <PuzzleRow
                puzzle={puzzle}
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
                          className="font-mono text-[10px] uppercase tracking-wider text-text-muted"
                        >
                          Publish on
                        </label>
                        <input
                          id={`date-${puzzle.number}`}
                          type="date"
                          value={scheduleDate}
                          onChange={(event) =>
                            setScheduleDate(event.target.value)
                          }
                          className="rounded-sm border border-border-primary bg-bg-secondary px-2 py-1 text-xs text-text-primary"
                        />
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
                          Approve &amp; schedule
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
                            Return to draft
                          </Button>
                        )}
                        {puzzle.status === "draft" && (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={busy}
                            onClick={() =>
                              act(() => adminDeletePuzzle(puzzle.number))
                            }
                          >
                            Delete
                          </Button>
                        )}
                        {detail.error_count > 0 && (
                          <span className="text-xs text-red-400">
                            Validator errors must be resolved before scheduling.
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
