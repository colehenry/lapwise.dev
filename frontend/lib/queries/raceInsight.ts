import { queryOptions } from "@tanstack/react-query";
import type { RaceCornerInsight } from "@/lib/ai/race-corner-insight";
import { minutes } from "./durations";

interface RaceCornerInsightResponse {
  insight: RaceCornerInsight | null;
}

export const raceInsightKeys = {
  session: (sessionId: number) => ["race-corner-insight", sessionId] as const,
};

export function raceCornerInsightQuery(sessionId: number | null) {
  return queryOptions({
    queryKey: raceInsightKeys.session(sessionId ?? 0),
    queryFn: async (): Promise<RaceCornerInsightResponse | null> => {
      const response = await fetch(
        `/api/ai/race-insight?session_id=${sessionId as number}`,
        { cache: "no-store" },
      );
      return response.ok ? response.json() : null;
    },
    enabled: sessionId !== null,
    staleTime: minutes(5),
  });
}
