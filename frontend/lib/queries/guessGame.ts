import { queryOptions } from "@tanstack/react-query";
import { apiUrl, extractErrorMessage } from "@/lib/api";
import { fetchWithAuth } from "@/lib/auth";
import type {
  DriverMedia,
  GameDriver,
  GameDriverCatalogResponse,
} from "./dailyGrid";
import { hours, minutes } from "./durations";
import { getJson } from "./http";

export type GuessGamePuzzle = {
  id: string;
  number: number;
  published_on: string;
  max_guesses: number;
  previous_number: number | null;
  next_number: number | null;
};

export type ComparisonState = "exact" | "close" | "miss";
export type GuessGameComparison = {
  state: ComparisonState;
  direction: "higher" | "lower" | null;
};

export type GuessGameResult = {
  sequence: number;
  correct: boolean;
  driver: GameDriver & { media?: DriverMedia | null };
  values: {
    debut: number;
    last_raced: number;
    country: string;
    constructor: string;
    career_peak: string;
  };
  comparisons: Record<
    "debut" | "last_raced" | "country" | "constructor" | "career_peak",
    GuessGameComparison
  >;
  fact: { id: string; text: string; constructor_color: string | null };
  answer: {
    driver_slug: string;
    full_name: string;
    driver_code: string | null;
  } | null;
  highlights: Array<{ id: string; value: string; label: string }> | null;
};

export type GuessGameSession = {
  session_id: string;
  puzzle_id: string;
  max_guesses: number;
  status: "active" | "won" | "exhausted" | "retired";
  guesses: GuessGameResult[];
  answer: GuessGameResult["answer"];
};

export type DailyGameStats = {
  played: number;
  won: number;
  win_percentage: number;
  current_streak: number;
  max_streak: number;
  distribution: Record<number, number>;
  aggregate_distribution: Record<number, number> | null;
};

export type DailyGameLeaderboard = {
  entries: Array<{
    rank: number;
    display_name: string;
    won: boolean;
    score: number;
    elapsed_ms: number;
  }>;
  total: number;
  offset: number;
  limit: number;
};

export const guessGameKeys = {
  puzzle: ["guess-game", "puzzle"] as const,
  catalog: ["guess-game", "catalog"] as const,
  session: (puzzleId: string, playerId: string) =>
    ["guess-game", "session", puzzleId, playerId] as const,
  stats: (playerId: string) => ["guess-game", "stats", playerId] as const,
  leaderboard: (puzzleId: string) =>
    ["guess-game", "leaderboard", puzzleId] as const,
};

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetchWithAuth(apiUrl(path), init);
  if (!response.ok) {
    throw new Error(
      await extractErrorMessage(response, "The game request failed"),
    );
  }
  return response.json();
}

export function guessGamePuzzleQuery() {
  return queryOptions({
    queryKey: guessGameKeys.puzzle,
    queryFn: () =>
      getJson<GuessGamePuzzle>("/api/guess", "Failed to load game"),
    staleTime: minutes(5),
  });
}

export function guessGameCatalogQuery() {
  return queryOptions({
    queryKey: guessGameKeys.catalog,
    queryFn: () =>
      getJson<GameDriverCatalogResponse>(
        "/api/guess/drivers/catalog",
        "Failed to load drivers",
      ),
    staleTime: hours(1),
  });
}

export function guessGameSessionQuery(puzzleId: string, playerId: string) {
  return queryOptions({
    queryKey: guessGameKeys.session(puzzleId, playerId),
    queryFn: () =>
      requestJson<GuessGameSession>("/api/guess/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ puzzle_id: puzzleId, anon_id: playerId }),
      }),
    enabled: Boolean(puzzleId && playerId),
    staleTime: 0,
    gcTime: 0,
  });
}

export function submitGuessGameGuess(
  sessionId: string,
  driverSlug: string,
  playerId: string,
) {
  return requestJson<GuessGameResult>("/api/guess/guesses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: sessionId,
      driver_slug: driverSlug,
      anon_id: playerId,
    }),
  });
}

export function guessGameStatsQuery(playerId: string) {
  return queryOptions({
    queryKey: guessGameKeys.stats(playerId),
    queryFn: () =>
      requestJson<DailyGameStats>(
        `/api/guess/stats?anon_id=${encodeURIComponent(playerId)}`,
      ),
    enabled: Boolean(playerId),
    staleTime: 0,
  });
}

export function guessGameStatsInvalidation(playerId: string) {
  return { queryKey: guessGameKeys.stats(playerId) };
}

export function guessGameLeaderboardQuery(puzzleId: string) {
  return queryOptions({
    queryKey: guessGameKeys.leaderboard(puzzleId),
    queryFn: () =>
      getJson<DailyGameLeaderboard>(
        `/api/guess/leaderboard?puzzle_id=${encodeURIComponent(puzzleId)}`,
        "Failed to load leaderboard",
        { cache: "no-store" },
      ),
    enabled: Boolean(puzzleId),
    staleTime: 0,
  });
}
