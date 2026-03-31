"use client";

import { useQuery } from "@tanstack/react-query";
import { apiHeaders, apiUrl } from "@/lib/api";
import type { StandingsResponse } from "@/lib/types";

type EntityLinkColors = {
  driverColors: Map<string, string>;
  teamColors: Map<string, string>;
};

async function fetchEntityLinkColors(): Promise<EntityLinkColors> {
  const currentYear = new Date().getFullYear();
  const res = await fetch(apiUrl(`/api/results/${currentYear}/standings`), {
    headers: apiHeaders(),
  });
  if (!res.ok) {
    return { driverColors: new Map(), teamColors: new Map() };
  }

  const data = (await res.json()) as StandingsResponse;
  const driverColors = new Map<string, string>();
  const teamColors = new Map<string, string>();

  for (const driver of data.drivers ?? []) {
    if (driver.driver_code && driver.team_color) {
      driverColors.set(driver.driver_code, `#${driver.team_color}`);
    }
  }

  for (const team of data.constructors ?? []) {
    if (team.team_name && team.team_color) {
      teamColors.set(team.team_name, `#${team.team_color}`);
    }
  }

  return { driverColors, teamColors };
}

export function useEntityLinkColors(): EntityLinkColors {
  const { data } = useQuery({
    queryKey: ["chat-entity-link-colors"],
    queryFn: fetchEntityLinkColors,
    staleTime: 1000 * 60 * 60,
  });

  return data ?? { driverColors: new Map(), teamColors: new Map() };
}
