import { queryOptions } from "@tanstack/react-query";
import { apiUrl, extractErrorMessage } from "@/lib/api";
import { fetchWithAuth } from "@/lib/auth";
import { minutes } from "./durations";

export type DailyGameSummaryItem = {
  game: "grid" | "guess";
  name: string;
  href: "/daily" | "/guess";
  state: "not_started" | "in_progress" | "complete";
  puzzle_number: number | null;
  published_on: string | null;
};

export type DailyGamesSummary = { games: DailyGameSummaryItem[] };

export const dailyGamesKeys = {
  summary: (playerId: string) => ["daily-games", "summary", playerId] as const,
};

async function fetchDailyGamesSummary(playerId: string) {
  const query = playerId ? `?anon_id=${encodeURIComponent(playerId)}` : "";
  const response = await fetchWithAuth(apiUrl(`/api/games/summary${query}`));
  if (!response.ok) {
    throw new Error(
      await extractErrorMessage(response, "Failed to load Daily Games"),
    );
  }
  return response.json() as Promise<DailyGamesSummary>;
}

export function dailyGamesSummaryQuery(playerId: string) {
  return queryOptions({
    queryKey: dailyGamesKeys.summary(playerId),
    queryFn: () => fetchDailyGamesSummary(playerId),
    staleTime: minutes(5),
  });
}
