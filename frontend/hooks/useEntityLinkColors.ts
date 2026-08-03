"use client";

import { useQuery } from "@tanstack/react-query";
import {
  currentStandingsSeason,
  EMPTY_ENTITY_COLORS,
  type EntityColors,
  seasonStandingsQuery,
  selectEntityColors,
} from "@/lib/queries/standings";

/**
 * Current-season driver and team colors, derived from the shared standings
 * cache entry rather than a second request for the same resource.
 */
export function useEntityLinkColors(): EntityColors {
  const { data } = useQuery({
    ...seasonStandingsQuery(currentStandingsSeason()),
    select: selectEntityColors,
  });

  return data ?? EMPTY_ENTITY_COLORS;
}
