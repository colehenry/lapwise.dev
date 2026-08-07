import { queryOptions } from "@tanstack/react-query";
import { apiHeaders, apiUrl, extractErrorMessage } from "@/lib/api";
import type { CategoryEvidence } from "@/lib/gridEvidence";
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
  // Absent on responses cached from before Rookie Mode shipped.
  has_rookie_mode?: boolean;
  rows: GameCategory[];
  columns: GameCategory[];
};

/** Resolved driver imagery. `focal_*` are CSS position percentages, so they
 *  must be applied with `object-fit: cover` and `object-position`. */
export type DriverMedia = {
  url: string;
  focal_x: number | null;
  focal_y: number | null;
  attribution_text: string | null;
  license_code: string | null;
  license_url: string | null;
  is_owned: boolean;
};

export type GameDriver = {
  driver_slug: string;
  full_name: string;
  driver_code: string | null;
  headshot_url: string | null;
  // Optional: responses cached from before the media library shipped omit it.
  media?: DriverMedia | null;
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
  // Proof for each header, returned only after a guess is committed.
  row_evidence?: CategoryEvidence | null;
  column_evidence?: CategoryEvidence | null;
};

/** Per-cell option lists keyed by `row__column`. Carries no evidence: proof
 *  attached to an unplayed option is the answer. */
export type RookieOptionsResponse = {
  puzzle_id: string;
  options: Record<string, GameDriver[]>;
};

export const gameKeys = {
  puzzle: (number?: number) => ["game", "puzzle", number ?? "daily"] as const,
  driverCatalog: ["game", "drivers", "catalog"] as const,
  driverSearch: (query: string) =>
    ["game", "drivers", "search", query] as const,
  rookieOptions: (number: number) => ["game", "rookie", number] as const,
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

export function rookieOptionsQuery(number: number, enabled: boolean) {
  return queryOptions({
    queryKey: gameKeys.rookieOptions(number),
    queryFn: () =>
      getJson<RookieOptionsResponse>(
        `/api/daily/${number}/rookie-options`,
        "Failed to load the driver options",
      ),
    enabled,
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
