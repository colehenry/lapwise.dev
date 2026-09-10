import { queryOptions } from "@tanstack/react-query";
import { minutes } from "./durations";
import { getJson } from "./http";

/** A span of `text` naming an entity, for the client to tint. */
export type HeadlineToken = {
  start: number;
  end: number;
  kind: "driver" | "team";
  code: string;
};

export type HeadlineValidity = {
  kind: "next_race" | "season_end" | "date";
  date: string | null;
};

export type Headline = {
  id: string;
  category: string;
  kicker: string;
  text: string;
  tokens: HeadlineToken[];
  weight: number;
  valid_until: HeadlineValidity;
  href: string | null;
};

export type HeadlinesResponse = {
  season: number;
  round: number | null;
  headlines: Headline[];
};

export const headlineKeys = {
  season: (season: number) => ["headlines", season] as const,
};

export function headlinesQuery(season: number | null) {
  return queryOptions({
    queryKey: headlineKeys.season(season ?? 0),
    queryFn: () =>
      getJson<HeadlinesResponse>(
        `/api/headlines?season=${season}`,
        "Failed to fetch headlines",
      ),
    enabled: season !== null,
    staleTime: minutes(10),
  });
}
