import { queryOptions } from "@tanstack/react-query";
import { minutes } from "./durations";
import { getJsonOrNull } from "./http";

/**
 * The concealed board and, when the session lifecycle writes them, the
 * personal and aggregate lines. Every nullable field is null today; a null
 * hides its own line rather than showing a placeholder.
 */
export type DailySummary = {
  number: number;
  published_on: string;
  max_guesses: number;
  rows: number;
  columns: number;
  play_count: number | null;
  perfect_rate: number | null;
  has_played: boolean | null;
  streak: number | null;
  last_seven: boolean[] | null;
};

export const dailySummaryKeys = {
  summary: () => ["daily-summary"] as const,
};

export function dailySummaryQuery() {
  return queryOptions({
    queryKey: dailySummaryKeys.summary(),
    queryFn: () => getJsonOrNull<DailySummary>("/api/daily/summary"),
    staleTime: minutes(5),
  });
}
