"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import Image from "next/image";
import { useCallback, useState } from "react";
import {
  type GridMode,
  useDailyGridProgress,
} from "@/hooks/useDailyGridProgress";
import {
  type DailyGame,
  dailyGameQuery,
  type GameDriver,
  type GameDriverCatalogItem,
  gameDriverCatalogQuery,
  rookieOptionsQuery,
  submitGameGuess,
} from "@/lib/queries/dailyGrid";
import DriverSearchPanel from "./DriverSearchPanel";
import GameCategoryHeader from "./GameCategoryHeader";
import GameDriverCell from "./GameDriverCell";
import GameRulesTooltip from "./GameRulesTooltip";
import PuzzleNavigation from "./PuzzleNavigation";
import RookieOptionRail from "./RookieOptionRail";
import StartingLights from "./StartingLights";

type ShakeState = { cellId: string } | null;

function ModeToggle({
  mode,
  onChange,
  started,
}: {
  mode: GridMode;
  onChange: (mode: GridMode) => void;
  started: boolean;
}) {
  const switchTo: GridMode = mode === "rookie" ? "standard" : "rookie";

  return (
    <button
      type="button"
      aria-pressed={mode === "rookie"}
      onClick={() => {
        // Progress is stored per mode, so switching keeps both boards intact
        // rather than importing a half-solved grid into the other mode.
        if (
          started &&
          !window.confirm(
            `Switch to ${switchTo === "rookie" ? "Rookie" : "Standard"} Mode? This grid keeps separate progress for each mode.`,
          )
        ) {
          return;
        }
        onChange(switchTo);
      }}
      className={`rounded-sm border px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wider transition-colors ${
        mode === "rookie"
          ? "border-purple-400/60 bg-purple-400/10 text-purple-300"
          : "border-border-secondary text-text-muted hover:text-text-primary"
      }`}
    >
      Rookie Mode
    </button>
  );
}

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
  const [mode, setMode] = useState<GridMode>("standard");
  const progress = useDailyGridProgress(puzzle.id, mode);
  const rookie = mode === "rookie";
  const rookieOptions = useQuery(
    rookieOptionsQuery(
      puzzle.number,
      rookie && Boolean(puzzle.has_rookie_mode),
    ),
  );
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
      if (result.correct) {
        setSelectedCell(null);
      } else {
        setShake({ cellId });
        // Rookie Mode keeps the cell open so the proof for the miss stays
        // beside the options it was chosen from.
        if (!rookie) setSelectedCell(null);
      }
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

  const selectedCellId =
    selectedRow === null || selectedColumn === null
      ? null
      : `${puzzle.rows[selectedRow].id}__${puzzle.columns[selectedColumn].id}`;
  const selectedMisses = selectedCellId
    ? (progress.missesByCell.get(selectedCellId) ?? [])
    : [];
  // Derived rather than held in state, so selecting another cell cannot leave
  // the proof from a previous cell's miss on screen.
  const lastMiss = selectedMisses.at(-1) ?? null;

  return (
    <div
      className={`relative mx-auto w-full ${
        rookie
          ? "max-w-[32rem] lg:flex lg:max-w-[50rem] lg:items-start lg:gap-4"
          : "max-w-[32rem]"
      }`}
    >
      <div className="w-full min-w-0">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <p className="font-mono text-xs font-bold uppercase tracking-wider text-text-primary">
              Grid #{String(puzzle.number).padStart(3, "0")}
            </p>
            <GameRulesTooltip />
          </div>
          <div className="flex items-center gap-2">
            {puzzle.has_rookie_mode && (
              <ModeToggle
                mode={mode}
                started={progress.attempts.length > 0}
                onChange={(next) => {
                  setMode(next);
                  setSelectedCell(null);
                  guessMutation.reset();
                }}
              />
            )}
            <StartingLights
              attempts={progress.attempts}
              total={puzzle.max_guesses}
            />
          </div>
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
                      solved={progress.solvedByCell.get(cellId)}
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

          {!rookie &&
            selectedRow !== null &&
            selectedColumn !== null &&
            !finished && (
              <DriverSearchPanel
                catalog={catalog}
                catalogError={catalogError}
                catalogLoading={catalogLoading}
                rowLabel={puzzle.rows[selectedRow].prompt_label}
                columnLabel={puzzle.columns[selectedColumn].prompt_label}
                loading={guessMutation.isPending}
                misses={selectedMisses}
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

      {rookie && (
        <RookieOptionRail
          rowLabel={
            selectedRow === null || finished
              ? undefined
              : puzzle.rows[selectedRow].prompt_label
          }
          columnLabel={
            selectedColumn === null || finished
              ? undefined
              : puzzle.columns[selectedColumn].prompt_label
          }
          error={rookieOptions.isError}
          lastMiss={lastMiss}
          loading={rookieOptions.isLoading}
          misses={selectedMisses}
          options={
            selectedCellId
              ? rookieOptions.data?.options[selectedCellId]
              : undefined
          }
          onSelect={submitDriver}
          placedDriverSlugs={progress.placedDriverSlugs}
          submitting={guessMutation.isPending}
        />
      )}
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
