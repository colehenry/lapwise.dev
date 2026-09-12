"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatDay } from "@/lib/puzzleSchedule";
import {
  adminGridInvalidation,
  adminGridQueueQuery,
  approveAdminGridPuzzle,
  deleteAdminGridDrafts,
  deleteAdminGridPuzzle,
  generateAdminGridPuzzles,
  moveAdminGridPuzzle,
  revertAdminGridPuzzle,
} from "@/lib/queries/adminGrid";
import {
  addManualAdminGuessPuzzle,
  adminGuessGameInvalidation,
  adminGuessGameQueueQuery,
  approveAdminGuessPuzzle,
  deleteAdminGuessDrafts,
  deleteAdminGuessPuzzle,
  moveAdminGuessPuzzle,
  randomizeAdminGuessPuzzles,
  revertAdminGuessPuzzle,
} from "@/lib/queries/adminGuessGame";
import type { Game } from "./dragTypes";
import GridDrafts from "./GridDrafts";
import GuessDrafts from "./GuessDrafts";
import RolloverNotice from "./RolloverNotice";
import ScheduleBoard from "./ScheduleBoard";

export default function AdminPuzzlesPage() {
  const client = useQueryClient();
  const router = useRouter();
  const grid = useQuery(adminGridQueueQuery());
  const guess = useQuery(adminGuessGameQueueQuery());
  const openBoard = (number: number | "new") =>
    router.push(`/admin/puzzles/board/${number}`);
  const openPole = (number: number) =>
    router.push(`/admin/puzzles/pole/${number}`);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const action = useMutation({
    mutationFn: (run: () => Promise<unknown>) => run(),
    onSuccess: () => {
      client.invalidateQueries(adminGridInvalidation());
      client.invalidateQueries(adminGuessGameInvalidation());
    },
    onError: (reason) =>
      setError(reason instanceof Error ? reason.message : "Action failed"),
  });
  const run = (operation: () => Promise<unknown>) => {
    setError("");
    setNotice("");
    action.mutate(operation);
  };
  const scheduled = (label: string) => (result: { published_on: string }) => {
    setNotice(`${label} runs ${formatDay(result.published_on)}`);
    return result;
  };

  const gridPuzzles = grid.data?.puzzles ?? [];
  const guessPuzzles = guess.data?.puzzles ?? [];
  const busy = action.isPending;

  return (
    <div className="space-y-4">
      <RolloverNotice />

      {(error || grid.isError || guess.isError) && (
        <p className="rounded-sm border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger-bright">
          {error || "The schedule could not load."}
        </p>
      )}
      {notice && <p className="text-sm text-emerald-300">{notice}</p>}

      {grid.isLoading || guess.isLoading ? (
        <div className="h-40 animate-pulse rounded-sm bg-surface-panel" />
      ) : (
        <ScheduleBoard
          grid={gridPuzzles}
          guess={guessPuzzles}
          onOpenGrid={openBoard}
          onOpenGuess={openPole}
          onDrop={(game: Game, number, day) =>
            run(() =>
              (game === "grid"
                ? moveAdminGridPuzzle(number, day)
                : moveAdminGuessPuzzle(number, day)
              ).then(scheduled(`#${number}`)),
            )
          }
          onUnschedule={(game, number) =>
            run(() =>
              game === "grid"
                ? revertAdminGridPuzzle(number)
                : revertAdminGuessPuzzle(number),
            )
          }
        />
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <GridDrafts
          drafts={gridPuzzles.filter((puzzle) => !puzzle.published_on)}
          busy={busy}
          onNew={() => openBoard("new")}
          onOpen={openBoard}
          onApprove={(number) =>
            run(() =>
              approveAdminGridPuzzle(number).then(scheduled(`Grid #${number}`)),
            )
          }
          onDelete={(number) => run(() => deleteAdminGridPuzzle(number))}
          onDeleteAll={() => {
            if (window.confirm("Delete every Grid draft?"))
              run(deleteAdminGridDrafts);
          }}
          onGenerate={(request) =>
            run(() =>
              generateAdminGridPuzzles(request).then((result) => {
                setNotice(
                  `${result.created.length} of ${result.requested} boards passed validation`,
                );
              }),
            )
          }
        />
        <GuessDrafts
          drafts={guessPuzzles.filter((puzzle) => !puzzle.published_on)}
          busy={busy}
          onOpen={openPole}
          onAdd={(slug) =>
            run(() => addManualAdminGuessPuzzle(slug).then(scheduled(slug)))
          }
          onRandomize={(count) => run(() => randomizeAdminGuessPuzzles(count))}
          onApprove={(number) =>
            run(() =>
              approveAdminGuessPuzzle(number).then(
                scheduled(`Pole #${number}`),
              ),
            )
          }
          onDelete={(number) => run(() => deleteAdminGuessPuzzle(number))}
          onDeleteAll={() => {
            if (window.confirm("Delete every Who's on Pole draft?"))
              run(deleteAdminGuessDrafts);
          }}
        />
      </div>
    </div>
  );
}
