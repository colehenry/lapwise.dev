import { queryOptions } from "@tanstack/react-query";
import { hours } from "./durations";
import { getJson } from "./http";

export type UpcomingEvent = {
  event_name: string;
  event_type: string;
  event_date: string;
  location: string;
  country: string;
  round_number: number | null;
  circuit_id: number | null;
  circuit_name: string | null;
};

/**
 * The endpoint caps at ten, so the response is a floor on what is left to run
 * and never a season length.
 */
export const UPCOMING_EVENT_LIMIT = 10;

export const eventKeys = {
  upcoming: () => ["upcoming-events"] as const,
};

export function upcomingEventsQuery() {
  return queryOptions({
    queryKey: eventKeys.upcoming(),
    queryFn: () =>
      getJson<UpcomingEvent[]>(
        `/api/events/upcoming?limit=${UPCOMING_EVENT_LIMIT}`,
        "Failed to fetch upcoming events",
      ),
    staleTime: hours(1),
  });
}
