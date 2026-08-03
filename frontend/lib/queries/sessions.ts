import { queryOptions } from "@tanstack/react-query";
import type { SessionResultsResponse } from "@/lib/types";
import { getJsonOrNull } from "./http";

export type RoundTabKind =
  | "race"
  | "qualifying"
  | "sprint"
  | "sprint-qualifying"
  | "practice";

export type RoundAvailability = {
  season: number;
  round: number;
  event_name: string;
  date: string;
  circuit_id: number | null;
  circuit_name: string | null;
  session_types: string[];
  practice_numbers: number[];
  has_sprint: boolean;
  summary_session_types: string[];
};

export type SessionSummariesResponse = {
  summaries: { session_type: string }[];
};

/**
 * Race-weekend resources. Availability metadata describes which sessions a
 * weekend has, so the page loads the selected session instead of probing every
 * session type to find out which tabs exist.
 */
export const sessionKeys = {
  availability: (season: number, round: number) =>
    ["round-availability", season, round] as const,
  session: (
    season: number,
    round: number,
    tab: RoundTabKind,
    practiceNumber: number | null,
  ) => ["round-session", season, round, tab, practiceNumber] as const,
  summaries: (season: number, round: number) =>
    ["round-summaries", season, round] as const,
};

/** Session type as stored on the server, for matching summaries. */
export function serverSessionType(
  tab: RoundTabKind,
  practiceNumber: number,
): string {
  if (tab === "sprint") return "sprint_race";
  if (tab === "sprint-qualifying") return "sprint_qualifying";
  if (tab === "practice") return `fp${practiceNumber}`;
  return tab;
}

function sessionPath(
  season: number,
  round: number,
  tab: RoundTabKind,
  practiceNumber: number,
): string {
  const base = `/api/results/${season}/${round}`;
  if (tab === "race") return base;
  if (tab === "practice") return `${base}/practice/${practiceNumber}`;
  return `${base}/${tab}`;
}

export function roundAvailabilityQuery(season: number, round: number) {
  return queryOptions({
    queryKey: sessionKeys.availability(season, round),
    queryFn: () =>
      getJsonOrNull<RoundAvailability>(
        `/api/results/${season}/${round}/availability`,
      ),
    enabled: Number.isFinite(season) && Number.isFinite(round),
  });
}

export function roundSessionQuery(
  season: number,
  round: number,
  tab: RoundTabKind,
  practiceNumber: 1 | 2 | 3 = 1,
) {
  return queryOptions({
    queryKey: sessionKeys.session(
      season,
      round,
      tab,
      tab === "practice" ? practiceNumber : null,
    ),
    queryFn: () =>
      getJsonOrNull<SessionResultsResponse>(
        sessionPath(season, round, tab, practiceNumber),
        { cache: "no-store" },
      ),
    enabled: Number.isFinite(season) && Number.isFinite(round),
  });
}

export function roundSummariesQuery(season: number, round: number) {
  return queryOptions({
    queryKey: sessionKeys.summaries(season, round),
    queryFn: () =>
      getJsonOrNull<SessionSummariesResponse>(
        `/api/results/${season}/${round}/summaries`,
        { cache: "no-store" },
      ),
    enabled: Number.isFinite(season) && Number.isFinite(round),
  });
}

/** Tabs a weekend can show, in display order. */
export function availableTabs(
  availability: RoundAvailability | null | undefined,
): RoundTabKind[] {
  if (!availability) return ["race"];
  const types = new Set(availability.session_types);
  const tabs: RoundTabKind[] = [];
  if (types.has("race")) tabs.push("race");
  if (types.has("qualifying")) tabs.push("qualifying");
  if (types.has("sprint_race")) tabs.push("sprint");
  if (types.has("sprint_qualifying")) tabs.push("sprint-qualifying");
  if (availability.practice_numbers.length > 0) tabs.push("practice");
  return tabs.length > 0 ? tabs : ["race"];
}

/** Latest practice session a weekend offers, FP3 before FP2 before FP1. */
export function defaultPracticeNumber(
  availability: RoundAvailability | null | undefined,
): 1 | 2 | 3 {
  const numbers = availability?.practice_numbers ?? [];
  if (numbers.includes(3)) return 3;
  if (numbers.includes(2)) return 2;
  return 1;
}
