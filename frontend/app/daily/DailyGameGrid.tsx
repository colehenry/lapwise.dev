"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import Image from "next/image";
import { useCallback, useState } from "react";
import { useDailyGridProgress } from "@/hooks/useDailyGridProgress";
import {
  type DailyGame,
  dailyGameQuery,
  type GameDriver,
  type GameDriverCatalogItem,
  gameDriverCatalogQuery,
  submitGameGuess,
} from "@/lib/queries/dailyGrid";
import DriverSearchPanel from "./DriverSearchPanel";
import GameCategoryHeader from "./GameCategoryHeader";
import GameDriverCell from "./GameDriverCell";
import GameRulesTooltip from "./GameRulesTooltip";
import PuzzleNavigation from "./PuzzleNavigation";
import StartingLights from "./StartingLights";

type ShakeState = { cellId: string } | null;

function GameBoard({
  catalog,
  catalogError,
  catalogLoading,
  puzzle,
}: {
  catalog?: GameDriverCatalogItem[];
  catalogError: boolean;
  catalogLoading: boolean;
  puzzle: DailyGame;
}) {
  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const [shake, setShake] = useState<ShakeState>(null);
  const [announcement, setAnnouncement] = useState("");
  const progress = useDailyGridProgress(puzzle.id);
  const guessMutation = useMutation({ mutationFn: submitGameGuess });
  const selectedRow =
    selectedCell === null
      ? null
      : Math.floor(selectedCell / puzzle.columns.length);
  const selectedColumn =
    selectedCell === null ? null : selectedCell % puzzle.columns.length;
  const remaining = Math.max(puzzle.max_guesses - progress.attempts.length, 0);
  const finished = progress.filledCells.size === 9 || remaining === 0;

  const closeSearch = useCallback(() => setSelectedCell(null), []);

  const submitDriver = async (driver: GameDriver): Promise<boolean> => {
    if (selectedRow === null || selectedColumn === null || finished)
      return false;
    if (progress.placedDriverSlugs.has(driver.driver_slug)) return false;

    const row = puzzle.rows[selectedRow];
    const column = puzzle.columns[selectedColumn];
    const cellId = `${row.id}__${column.id}`;
    try {
      const result = await guessMutation.mutateAsync({
        puzzle_id: puzzle.id,
        row_id: row.id,
        column_id: column.id,
        driver_slug: driver.driver_slug,
      });
      progress.recordAttempt(result);
      setAnnouncement(
        result.correct
          ? `${driver.full_name} is correct.`
          : `${driver.full_name} is not correct for this cell.`,
      );
      if (!result.correct) {
        setShake({ cellId });
      }
      setSelectedCell(null);
      return true;
    } catch (error) {
      setAnnouncement(
        error instanceof Error
          ? error.message
          : "The guess could not be submitted.",
      );
      return false;
    }
  };

  return (
    <div className="relative mx-auto w-full max-w-[32rem]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <p className="font-mono text-xs font-bold uppercase tracking-wider text-text-primary">
            Grid #{String(puzzle.number).padStart(3, "0")}
          </p>
          <GameRulesTooltip />
        </div>
        <StartingLights
          attempts={progress.attempts}
          total={puzzle.max_guesses}
        />
      </div>

      <div className="relative">
        <div className="grid grid-cols-[4.5rem_repeat(3,minmax(0,1fr))] sm:grid-cols-[6rem_repeat(3,minmax(0,1fr))]">
          <div className="flex min-h-16 items-center justify-center border border-border-primary bg-bg-secondary sm:min-h-20">
            <Image
              src="/favicon.ico"
              alt="Lapwise"
              width={44}
              height={44}
              className="h-9 w-9 rounded-md sm:h-11 sm:w-11"
            />
          </div>

          {puzzle.columns.map((column) => (
            <GameCategoryHeader key={column.id} category={column} />
          ))}

          {puzzle.rows.map((row, rowIndex) => (
            <div key={row.id} className="contents">
              <GameCategoryHeader category={row} orientation="row" />
              {puzzle.columns.map((column, columnIndex) => {
                const cellIndex =
                  rowIndex * puzzle.columns.length + columnIndex;
                const cellId = `${row.id}__${column.id}`;
                return (
                  <GameDriverCell
                    key={cellId}
                    rowLabel={row.prompt_label}
                    columnLabel={column.prompt_label}
                    disabled={finished || !progress.ready}
                    driver={progress.filledCells.get(cellId)}
                    finished={finished}
                    misses={progress.missesByCell.get(cellId) ?? []}
                    shaking={shake?.cellId === cellId}
                    onAnimationEnd={() => {
                      if (shake?.cellId === cellId) setShake(null);
                    }}
                    onSelect={() => {
                      setSelectedCell(cellIndex);
                      setAnnouncement("");
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>

        {selectedRow !== null && selectedColumn !== null && !finished && (
          <DriverSearchPanel
            catalog={catalog}
            catalogError={catalogError}
            catalogLoading={catalogLoading}
            rowLabel={puzzle.rows[selectedRow].prompt_label}
            columnLabel={puzzle.columns[selectedColumn].prompt_label}
            loading={guessMutation.isPending}
            misses={
              progress.missesByCell.get(
                `${puzzle.rows[selectedRow].id}__${puzzle.columns[selectedColumn].id}`,
              ) ?? []
            }
            onClose={closeSearch}
            onSubmit={submitDriver}
            placedDriverSlugs={progress.placedDriverSlugs}
          />
        )}
      </div>

      <PuzzleNavigation
        previousNumber={puzzle.previous_number}
        nextNumber={puzzle.next_number}
        onRestart={() => {
          progress.restart();
          closeSearch();
          guessMutation.reset();
          setAnnouncement("Grid restarted.");
        }}
      />

      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}

export default function DailyGameGrid({
  puzzleNumber,
}: {
  puzzleNumber?: number;
}) {
  const puzzle = useQuery(dailyGameQuery(puzzleNumber));
  const driverCatalog = useQuery(gameDriverCatalogQuery());

  if (puzzle.isLoading) {
    return (
      <div className="mx-auto aspect-square w-full max-w-[31rem] animate-pulse rounded-md border border-border-primary bg-bg-secondary" />
    );
  }
  if (puzzle.isError || !puzzle.data) {
    return (
      <div className="mx-auto flex min-h-64 max-w-[31rem] flex-col items-center justify-center rounded-md border border-border-primary bg-bg-secondary p-6 text-center">
        <p className="font-bold text-text-primary">The grid could not load.</p>
        <button
          type="button"
          className="mt-3 text-sm text-text-secondary underline underline-offset-4"
          onClick={() => puzzle.refetch()}
        >
          Try again
        </button>
      </div>
    );
  }
  return (
    <GameBoard
      key={puzzle.data.id}
      catalog={driverCatalog.data?.drivers}
      catalogError={driverCatalog.isError}
      catalogLoading={driverCatalog.isLoading}
      puzzle={puzzle.data}
    />
  );
}
