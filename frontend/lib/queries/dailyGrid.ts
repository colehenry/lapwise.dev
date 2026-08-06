import { queryOptions } from "@tanstack/react-query";
import { apiHeaders, apiUrl, extractErrorMessage } from "@/lib/api";
import { hours } from "./durations";
import { getJson } from "./http";

export type GameCategory = {
  id: string;
  label: string;
  prompt_label: string;
  description: string;
  visual: {
    kind: "constructor" | "nationality" | "text";
    value: string;
  };
};

export type DailyGame = {
  id: string;
  number: number;
  published_on: string;
  answer_version: number;
  max_guesses: number;
  previous_number: number | null;
  next_number: number | null;
  rows: GameCategory[];
  columns: GameCategory[];
};

export type GameDriver = {
  driver_slug: string;
  full_name: string;
  driver_code: string | null;
  headshot_url: string | null;
};

export type GameDriverSearchResponse = {
  drivers: GameDriver[];
};

export type GameDriverCatalogItem = GameDriver & {
  race_entries: number;
};

export type GameDriverCatalogResponse = {
  drivers: GameDriverCatalogItem[];
};

export type GameGuess = {
  puzzle_id: string;
  row_id: string;
  column_id: string;
  driver_slug: string;
};

export type GameGuessResult = {
  correct: boolean;
  row_id: string;
  column_id: string;
  driver: GameDriver;
};

export const gameKeys = {
  puzzle: (number?: number) => ["game", "puzzle", number ?? "daily"] as const,
  driverCatalog: ["game", "drivers", "catalog"] as const,
  driverSearch: (query: string) =>
    ["game", "drivers", "search", query] as const,
};

export function dailyGameQuery(number?: number) {
  return queryOptions({
    queryKey: gameKeys.puzzle(number),
    queryFn: () =>
      getJson<DailyGame>(
        number ? `/api/daily/${number}` : "/api/daily",
        "Failed to load this grid",
        {
          cache: "no-store",
        },
      ),
  });
}

export function gameDriverSearchQuery(query: string) {
  const normalized = query.trim();
  return queryOptions({
    queryKey: gameKeys.driverSearch(normalized.toLowerCase()),
    queryFn: () =>
      getJson<GameDriverSearchResponse>(
        `/api/daily/drivers?q=${encodeURIComponent(normalized)}`,
        "Failed to search drivers",
      ),
    enabled: normalized.length >= 2,
    staleTime: hours(1),
  });
}

export function gameDriverCatalogQuery() {
  return queryOptions({
    queryKey: gameKeys.driverCatalog,
    queryFn: () =>
      getJson<GameDriverCatalogResponse>(
        "/api/daily/drivers/catalog",
        "Failed to load the driver catalog",
      ),
    staleTime: hours(1),
  });
}

export async function submitGameGuess(
  guess: GameGuess,
): Promise<GameGuessResult> {
  const headers = new Headers(apiHeaders());
  headers.set("Content-Type", "application/json");
  const response = await fetch(apiUrl("/api/daily/guess"), {
    method: "POST",
    headers,
    body: JSON.stringify(guess),
  });
  if (!response.ok) {
    throw new Error(
      await extractErrorMessage(response, "Failed to submit driver"),
    );
  }
  return response.json();
}
