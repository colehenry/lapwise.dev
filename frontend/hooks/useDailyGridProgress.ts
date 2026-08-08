"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CategoryEvidence } from "@/lib/gridEvidence";
import type { GameDriver, GameGuessResult } from "@/lib/queries/dailyGrid";

export type GridMode = "standard" | "rookie";

export const GRID_MODES: GridMode[] = ["standard", "rookie"];

export type GridAttempt = {
  cellId: string;
  correct: boolean;
  driver: GameDriver;
  rowEvidence?: CategoryEvidence | null;
  columnEvidence?: CategoryEvidence | null;
};

// v5 orphans every stored board: the sandbox grids were retired and generated
// boards reissue `grid-001` onward, so v4 progress would attach a solved cell
// to a board that never accepted that driver.
const STORAGE_VERSION = "v5";

function storageKey(puzzleId: string, mode: GridMode) {
  return `lapwise:grid-progress:${STORAGE_VERSION}:${mode}:${puzzleId}`;
}

export function deriveGridProgress(attempts: GridAttempt[]) {
  const placedDriverSlugs = new Set(
    attempts
      .filter((attempt) => attempt.correct)
      .map((attempt) => attempt.driver.driver_slug),
  );
  const filledCells = new Map(
    attempts
      .filter((attempt) => attempt.correct)
      .map((attempt) => [attempt.cellId, attempt.driver]),
  );
  const missesByCell = new Map<string, GridAttempt[]>();
  for (const attempt of attempts) {
    if (attempt.correct) continue;
    missesByCell.set(attempt.cellId, [
      ...(missesByCell.get(attempt.cellId) ?? []),
      attempt,
    ]);
  }
  // Proof for a solved cell, so a placement can be inspected after the fact.
  const solvedByCell = new Map(
    attempts
      .filter((attempt) => attempt.correct)
      .map((attempt) => [attempt.cellId, attempt]),
  );
  return { filledCells, missesByCell, placedDriverSlugs, solvedByCell };
}

function isAttempt(value: unknown): value is GridAttempt {
  if (!value || typeof value !== "object") return false;
  const attempt = value as Partial<GridAttempt>;
  return (
    typeof attempt.cellId === "string" &&
    typeof attempt.correct === "boolean" &&
    !!attempt.driver &&
    typeof attempt.driver.driver_slug === "string" &&
    typeof attempt.driver.full_name === "string"
  );
}

/** Progress is stored per mode, so the two modes hold independent state on the
 *  same board and switching cannot import a half-solved grid. */
export function useDailyGridProgress(puzzleId: string, mode: GridMode) {
  const [attempts, setAttempts] = useState<GridAttempt[]>([]);
  const [ready, setReady] = useState(false);
  const puzzleStorageKey = storageKey(puzzleId, mode);

  useEffect(() => {
    setReady(false);
    try {
      const stored = window.localStorage.getItem(puzzleStorageKey);
      const parsed: unknown = stored ? JSON.parse(stored) : [];
      setAttempts(Array.isArray(parsed) ? parsed.filter(isAttempt) : []);
    } catch {
      setAttempts([]);
    }
    setReady(true);
  }, [puzzleStorageKey]);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(puzzleStorageKey, JSON.stringify(attempts));
    } catch {
      // Progress persistence is optional; the current play session still works.
    }
  }, [attempts, ready, puzzleStorageKey]);

  const recordAttempt = useCallback((result: GameGuessResult) => {
    setAttempts((current) => [
      ...current,
      {
        cellId: `${result.row_id}__${result.column_id}`,
        correct: result.correct,
        driver: result.driver,
        rowEvidence: result.row_evidence,
        columnEvidence: result.column_evidence,
      },
    ]);
  }, []);

  const restart = useCallback(() => {
    setAttempts([]);
  }, []);

  const { filledCells, missesByCell, placedDriverSlugs, solvedByCell } =
    useMemo(() => deriveGridProgress(attempts), [attempts]);

  return {
    attempts,
    filledCells,
    missesByCell,
    placedDriverSlugs,
    ready,
    recordAttempt,
    restart,
    solvedByCell,
  };
}

function isModeFinished(
  puzzleId: string,
  mode: GridMode,
  maxGuesses: number,
): boolean {
  const stored = window.localStorage.getItem(storageKey(puzzleId, mode));
  const parsed: unknown = stored ? JSON.parse(stored) : [];
  if (!Array.isArray(parsed)) return false;
  const attempts = parsed.filter(isAttempt);
  return (
    deriveGridProgress(attempts).filledCells.size === 9 ||
    attempts.length >= maxGuesses
  );
}

/** A board counts as played once either mode has finished it. */
export function isStoredGridFinished(puzzleId: string, maxGuesses = 12) {
  if (typeof window === "undefined") return false;
  try {
    return GRID_MODES.some((mode) =>
      isModeFinished(puzzleId, mode, maxGuesses),
    );
  } catch {
    return false;
  }
}
