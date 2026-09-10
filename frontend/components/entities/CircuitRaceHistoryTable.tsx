"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import Skeleton from "@/components/ui/Skeleton";
import { apiHeaders, apiUrl } from "@/lib/api";
import { constructorHref, driverHref } from "@/lib/entityLinks";
import type { CircuitRaceHistoryResponse } from "@/lib/types";

interface CircuitRaceHistoryTableProps {
  circuitId: string;
}

export default function CircuitRaceHistoryTable({
  circuitId,
}: CircuitRaceHistoryTableProps) {
  const { data, isLoading } = useQuery<CircuitRaceHistoryResponse>({
    queryKey: ["circuit-race-history", circuitId],
    queryFn: async () => {
      const res = await fetch(
        apiUrl(`/api/circuits/${circuitId}/race-history`),
        { headers: apiHeaders() },
      );
      if (!res.ok) throw new Error("Failed to fetch circuit race history");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 10 }, (_, i) => (
          <Skeleton
            key={`skel-${
              // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
              i
            }`}
            variant="rectangular"
            height="36px"
          />
        ))}
      </div>
    );
  }

  if (!data || data.races.length === 0) {
    return (
      <div className="text-center py-12 text-ink-faint">
        No race history available for this circuit.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-sm border border-line-soft bg-surface-panel">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-surface-page border-b border-line-soft">
            <th className="text-left px-3 py-2 text-xs font-mono font-bold uppercase tracking-widest text-ink-faint">
              Year
            </th>
            <th className="text-left px-3 py-2 text-xs font-mono font-bold uppercase tracking-widest text-ink-faint">
              Race
            </th>
            <th className="text-left px-3 py-2 text-xs font-mono font-bold uppercase tracking-widest text-ink-faint">
              Winner
            </th>
            <th className="text-left px-3 py-2 text-xs font-mono font-bold uppercase tracking-widest text-ink-faint">
              Team
            </th>
          </tr>
        </thead>
        <tbody>
          {data.races.map((race) => (
            <tr
              key={`${race.year}-${race.round}`}
              className="border-b border-line-soft/50 hover:bg-surface-raised/50 transition-colors"
            >
              <td className="px-3 py-2 text-ink-base font-mono text-xs">
                {race.year}
              </td>
              <td className="px-3 py-2">
                <Link
                  href={`/results/${race.year}/${race.round}`}
                  className="text-ink-strong hover:text-accent-light transition-colors"
                >
                  {race.race_name.replace("Grand Prix", "GP")}
                </Link>
              </td>
              <td className="px-3 py-2">
                <Link
                  href={
                    driverHref({
                      driver_slug: race.winner_slug,
                      driver_code: race.winner_code,
                      full_name: race.winner_name,
                    }) ?? "/drivers"
                  }
                  className="text-yellow-400 hover:text-yellow-300 transition-colors font-medium"
                >
                  {race.winner_name}
                </Link>
              </td>
              <td className="px-3 py-2">
                <span className="flex items-center gap-1.5">
                  {race.team_color && (
                    <span
                      className="w-2 h-2 rounded-full inline-block"
                      style={{ backgroundColor: `#${race.team_color}` }}
                    />
                  )}
                  <Link
                    href={constructorHref(race.team_name) ?? "/constructors"}
                    className="text-ink-base text-xs hover:text-accent-light transition-colors"
                  >
                    {race.team_name}
                  </Link>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
