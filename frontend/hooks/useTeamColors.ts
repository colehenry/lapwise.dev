"use client";

import { useQuery } from "@tanstack/react-query";
import { apiHeaders, apiUrl } from "@/lib/api";

type ConstructorRow = {
  team_name: string;
  team_color: string | null;
};

async function fetchTeamColors(): Promise<Map<string, string>> {
  const currentYear = new Date().getFullYear();
  const res = await fetch(apiUrl(`/api/results/${currentYear}/standings`), {
    headers: apiHeaders(),
  });
  if (!res.ok) return new Map();
  const data = await res.json();
  const map = new Map<string, string>();
  for (const c of (data.constructors ?? []) as ConstructorRow[]) {
    if (c.team_color) {
      map.set(c.team_name, `#${c.team_color}`);
    }
  }
  return map;
}

/**
 * Returns a Map of team_name → hex color string fetched from the current
 * season's constructor standings. Results are cached for 1 hour.
 */
export function useTeamColors(): Map<string, string> {
  const { data } = useQuery({
    queryKey: ["team-colors-current-season"],
    queryFn: fetchTeamColors,
    staleTime: 1000 * 60 * 60,
  });
  return data ?? new Map();
}
