"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import Skeleton from "@/components/ui/Skeleton";
import { apiHeaders, apiUrl } from "@/lib/api";
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
      <div className="text-center py-12 text-text-muted">
        No race history available for this circuit.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-sm border border-border-primary bg-bg-tertiary">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-bg-primary border-b border-border-primary">
            <th className="text-left px-3 py-2 text-xs font-mono font-bold uppercase tracking-widest text-text-muted">
              Year
            </th>
            <th className="text-left px-3 py-2 text-xs font-mono font-bold uppercase tracking-widest text-text-muted">
              Race
            </th>
            <th className="text-left px-3 py-2 text-xs font-mono font-bold uppercase tracking-widest text-text-muted">
              Winner
            </th>
            <th className="text-left px-3 py-2 text-xs font-mono font-bold uppercase tracking-widest text-text-muted">
              Team
            </th>
          </tr>
        </thead>
        <tbody>
          {data.races.map((race) => (
            <tr
              key={`${race.year}-${race.round}`}
              className="border-b border-border-primary/50 hover:bg-bg-elevated/50 transition-colors"
            >
              <td className="px-3 py-2 text-text-secondary font-mono text-xs">
                {race.year}
              </td>
              <td className="px-3 py-2">
                <Link
                  href={`/results/${race.year}/${race.round}`}
                  className="text-text-primary hover:text-purple-300 transition-colors"
                >
                  {race.race_name.replace("Grand Prix", "GP")}
                </Link>
              </td>
              <td className="px-3 py-2">
                <Link
                  href={`/drivers/${race.winner_slug || race.winner_code}`}
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
                    href={`/constructors/${race.team_name.replace(/\s+/g, "-")}`}
                    className="text-text-secondary text-xs hover:text-purple-300 transition-colors"
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
