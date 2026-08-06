"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { GameDriver, GameGuessResult } from "@/lib/queries/dailyGrid";

export type GridAttempt = {
  cellId: string;
  correct: boolean;
  driver: GameDriver;
};

const STORAGE_VERSION = "v3";

function storageKey(puzzleId: string) {
  return `lapwise:grid-progress:${STORAGE_VERSION}:${puzzleId}`;
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
  const missesByCell = new Map<string, GameDriver[]>();
  for (const attempt of attempts) {
    if (attempt.correct) continue;
    missesByCell.set(attempt.cellId, [
      ...(missesByCell.get(attempt.cellId) ?? []),
      attempt.driver,
    ]);
  }
  return { filledCells, missesByCell, placedDriverSlugs };
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

export function useDailyGridProgress(puzzleId: string) {
  const [attempts, setAttempts] = useState<GridAttempt[]>([]);
  const [ready, setReady] = useState(false);
  const puzzleStorageKey = storageKey(puzzleId);

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
      },
    ]);
  }, []);

  const restart = useCallback(() => {
    setAttempts([]);
  }, []);

  const { filledCells, missesByCell, placedDriverSlugs } = useMemo(
    () => deriveGridProgress(attempts),
    [attempts],
  );

  return {
    attempts,
    filledCells,
    missesByCell,
    placedDriverSlugs,
    ready,
    recordAttempt,
    restart,
  };
}

export function isStoredGridFinished(puzzleId: string, maxGuesses = 12) {
  if (typeof window === "undefined") return false;
  try {
    const stored = window.localStorage.getItem(storageKey(puzzleId));
    const parsed: unknown = stored ? JSON.parse(stored) : [];
    if (!Array.isArray(parsed)) return false;
    const attempts = parsed.filter(isAttempt);
    return (
      deriveGridProgress(attempts).filledCells.size === 9 ||
      attempts.length >= maxGuesses
    );
  } catch {
    return false;
  }
}
