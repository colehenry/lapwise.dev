"use client";

import { useState } from "react";
import type { ChampionshipPointsMode } from "@/components/ChampionshipScoringControl";
import type {
  ConstructorStanding,
  DriverStanding,
  StandingsResponse,
} from "@/lib/types";

export function orderRows<T extends DriverStanding | ConstructorStanding>(
  rows: T[] | undefined,
  mode: ChampionshipPointsMode,
) {
  return (rows ?? []).slice().sort((a, b) => {
    if (a.position == null && b.position == null) return 0;
    if (a.position == null) return 1;
    if (b.position == null) return -1;
    return mode === "scored"
      ? b.points_scored - a.points_scored
      : a.position - b.position;
  });
}

export function useChampionshipDisplay(
  standings: StandingsResponse | undefined,
) {
  const [driverMode, setDriverMode] =
    useState<ChampionshipPointsMode>("championship");
  const [constructorMode, setConstructorMode] =
    useState<ChampionshipPointsMode>("championship");
  return {
    drivers: {
      mode: driverMode,
      setMode: setDriverMode,
      rows: orderRows(standings?.drivers, driverMode),
    },
    constructors: {
      mode: constructorMode,
      setMode: setConstructorMode,
      rows: orderRows(standings?.constructors, constructorMode),
    },
  };
}

export function displayedPosition(
  row: DriverStanding | ConstructorStanding,
  index: number,
  mode: ChampionshipPointsMode,
) {
  if (row.position == null) return "—";
  return mode === "scored" ? index + 1 : row.position;
}

export function displayedPoints(
  row: DriverStanding | ConstructorStanding,
  mode: ChampionshipPointsMode,
) {
  if (
    mode === "scored" ||
    (row.championship_points == null &&
      (row.classification_status === "excluded" ||
        row.classification_status === "disqualified"))
  ) {
    return row.points_scored;
  }
  return row.total_points;
}
