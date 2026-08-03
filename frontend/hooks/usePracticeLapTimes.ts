"use client";

import { useQuery } from "@tanstack/react-query";
import { lapTimesQuery, practiceSession } from "@/lib/queries/lapTimes";

export function usePracticeLapTimes(
  season: number,
  round: number,
  practiceNumber: 1 | 2 | 3,
) {
  return useQuery({
    ...lapTimesQuery({
      season,
      round,
      session: practiceSession(practiceNumber),
    }),
    enabled: season >= 2018,
  });
}
