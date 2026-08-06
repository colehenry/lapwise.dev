"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { GameDriver, GameGuessResult } from "@/lib/queries/game";

export type GridAttempt = {
  cellId: string;
  correct: boolean;
  driver: GameDriver;
};

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
  const storageKey = `lapwise:grid-progress:${puzzleId}`;

  useEffect(() => {
    setReady(false);
    try {
      const stored = window.localStorage.getItem(storageKey);
      const parsed: unknown = stored ? JSON.parse(stored) : [];
      setAttempts(Array.isArray(parsed) ? parsed.filter(isAttempt) : []);
    } catch {
      setAttempts([]);
    }
    setReady(true);
  }, [storageKey]);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(attempts));
    } catch {
      // Progress persistence is optional; the current play session still works.
    }
  }, [attempts, ready, storageKey]);

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

  const usedDriverSlugs = useMemo(
    () => new Set(attempts.map((attempt) => attempt.driver.driver_slug)),
    [attempts],
  );
  const filledCells = useMemo(
    () =>
      new Map(
        attempts
          .filter((attempt) => attempt.correct)
          .map((attempt) => [attempt.cellId, attempt.driver]),
      ),
    [attempts],
  );

  return { attempts, filledCells, ready, recordAttempt, usedDriverSlugs };
}
