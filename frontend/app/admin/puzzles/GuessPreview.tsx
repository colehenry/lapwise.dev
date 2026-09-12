"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import GuessGameRow from "@/app/guess/GuessGameRow";
import Button from "@/components/ui/Button";
import { formatDay, puzzlePhase } from "@/lib/puzzleSchedule";
import {
  adminGuessGameInvalidation,
  adminGuessPreviewQuery,
  approveAdminGuessPuzzle,
  deleteAdminGuessPuzzle,
  revertAdminGuessPuzzle,
} from "@/lib/queries/adminGuessGame";
import type { GuessGameResult } from "@/lib/queries/guessGame";

/** How many of the five clues land exact or close against the answer. */
function closeness(row: GuessGameResult) {
  const states = Object.values(row.comparisons).map((c) => c.state);
  return {
    exact: states.filter((state) => state === "exact").length,
    close: states.filter((state) => state === "close").length,
  };
}

/** One Who's on Pole puzzle as a player meets it.
 *
 *  The winning row first, then the eligible drivers whose clues sit closest
 *  to the answer — each drawn as the guess it would be, so the reviewer sees
 *  how much the board gives away. */
export default function GuessPreview({ number }: { number: number }) {
  const client = useQueryClient();
  const router = useRouter();
  const preview = useQuery(adminGuessPreviewQuery(number));
  const [error, setError] = useState("");
  const action = useMutation({
    mutationFn: (run: () => Promise<unknown>) => run(),
    onSuccess: () => {
      client.invalidateQueries(adminGuessGameInvalidation());
      router.push("/admin/puzzles");
    },
    onError: (reason) =>
      setError(reason instanceof Error ? reason.message : "Action failed"),
  });

  if (preview.isLoading) {
    return <div className="h-64 animate-pulse rounded-sm bg-surface-panel" />;
  }
  if (preview.isError || !preview.data) {
    return (
      <p className="rounded-sm border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger-bright">
        {preview.error instanceof Error
          ? preview.error.message
          : "This puzzle could not load."}
      </p>
    );
  }

  const { puzzle, answer, similar } = preview.data;
  const phase = puzzlePhase(puzzle);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/admin/puzzles"
          className="text-xs text-ink-faint hover:text-ink-strong"
        >
          ← Games
        </Link>
        <h2 className="font-mono text-sm font-bold text-ink-strong">
          Pole #{String(puzzle.number).padStart(3, "0")}
        </h2>
        <span className="text-xs text-ink-faint">
          {phase === "draft"
            ? "Draft"
            : `${phase === "live" ? "Live" : "Runs"} ${formatDay(puzzle.published_on ?? "")}`}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {phase === "draft" && (
            <Button
              size="sm"
              disabled={action.isPending}
              onClick={() =>
                action.mutate(() => approveAdminGuessPuzzle(puzzle.number))
              }
            >
              Schedule
            </Button>
          )}
          {phase === "scheduled" && (
            <Button
              size="sm"
              variant="secondary"
              disabled={action.isPending}
              onClick={() =>
                action.mutate(() => revertAdminGuessPuzzle(puzzle.number))
              }
            >
              Unschedule
            </Button>
          )}
          {phase !== "live" && (
            <Button
              size="sm"
              variant="ghost"
              disabled={action.isPending}
              onClick={() => {
                if (window.confirm(`Delete Pole #${puzzle.number}?`))
                  action.mutate(() => deleteAdminGuessPuzzle(puzzle.number));
              }}
            >
              Delete
            </Button>
          )}
        </div>
      </div>

      {error && (
        <p className="rounded-sm border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger-bright">
          {error}
        </p>
      )}

      <section>
        <h3 className="mb-3 font-mono text-[10px] uppercase tracking-wider text-ink-faint">
          Winning row
        </h3>
        <GuessGameRow guess={answer} highContrast={false} reduceMotion />
      </section>

      <section>
        <h3 className="mb-1 font-mono text-[10px] uppercase tracking-wider text-ink-faint">
          Closest decoys
        </h3>
        <p className="mb-4 text-xs text-ink-faint">
          Eligible drivers ranked by how many clues they share with the answer.
          Each row is the guess a player would see.
        </p>
        <div className="grid gap-8">
          {similar.map((row) => {
            const { exact, close } = closeness(row);
            return (
              <div key={row.driver.driver_slug}>
                <p className="mb-1 text-center font-mono text-[10px] text-ink-faint">
                  {exact} exact · {close} close
                </p>
                <GuessGameRow guess={row} highContrast={false} reduceMotion />
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
