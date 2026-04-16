"use client";

import { useQuery } from "@tanstack/react-query";
import { apiHeaders, apiUrl } from "@/lib/api";
import type { LapTimesResponse } from "@/lib/types";

export function usePracticeLapTimes(
  season: number,
  round: number,
  practiceSession: 1 | 2 | 3,
) {
  return useQuery<LapTimesResponse | null>({
    queryKey: ["lap-times", season, round, false, practiceSession],
    queryFn: async () => {
      const res = await fetch(
        apiUrl(
          `/api/results/${season}/${round}/practice/${practiceSession}/lap-times`,
        ),
        { cache: "no-store", headers: apiHeaders() },
      );
      if (!res.ok) return null;
      return res.json();
    },
    enabled: season >= 2018,
  });
}
