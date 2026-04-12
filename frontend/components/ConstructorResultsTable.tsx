"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import Skeleton from "@/components/ui/Skeleton";
import { apiHeaders, apiUrl } from "@/lib/api";
import type { ConstructorRaceHistoryResponse } from "@/lib/types";

function positionColor(pos: number | null): string {
  if (!pos) return "text-text-muted";
  if (pos === 1) return "text-yellow-400";
  if (pos === 2) return "text-gray-300";
  if (pos === 3) return "text-amber-600";
  return "text-text-primary";
}

interface ConstructorResultsTableProps {
  teamName: string;
}

export default function ConstructorResultsTable({
  teamName,
}: ConstructorResultsTableProps) {
  const [selectedYear, setSelectedYear] = useState<number | "all">("all");

  const { data, isLoading } = useQuery<ConstructorRaceHistoryResponse>({
    queryKey: ["constructor-race-history", teamName, "all"],
    queryFn: async () => {
      const res = await fetch(
        apiUrl(`/api/constructors/${teamName}/race-history?all=true`),
        { headers: apiHeaders() },
      );
      if (!res.ok) throw new Error("Failed to fetch race history");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton variant="rectangular" height="40px" />
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
        No race results available.
      </div>
    );
  }

  const filteredRaces =
    selectedYear === "all"
      ? data.races
      : data.races.filter((r) => r.year === selectedYear);

  const sortedRaces = [...filteredRaces].reverse();

  return (
    <div>
      {/* Year filter */}
      <div className="mb-4 flex items-center gap-3">
        <label
          htmlFor="year-filter"
          className="text-xs font-mono font-bold uppercase tracking-widest text-text-muted"
        >
          Season
        </label>
        <select
          id="year-filter"
          value={selectedYear}
          onChange={(e) =>
            setSelectedYear(
              e.target.value === "all" ? "all" : Number(e.target.value),
            )
          }
          className="bg-bg-tertiary border border-border-primary rounded-sm px-3 py-1.5 text-sm text-text-primary focus:border-purple-500 focus:outline-none"
        >
          <option value="all">All Seasons</option>
          {data.available_years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <span className="text-xs text-text-muted ml-auto">
          {sortedRaces.length} race{sortedRaces.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
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
                Driver 1
              </th>
              <th className="text-left px-3 py-2 text-xs font-mono font-bold uppercase tracking-widest text-text-muted">
                Driver 2
              </th>
              <th className="text-center px-3 py-2 text-xs font-mono font-bold uppercase tracking-widest text-text-muted">
                Best
              </th>
              <th className="text-right px-3 py-2 text-xs font-mono font-bold uppercase tracking-widest text-text-muted">
                Pts
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedRaces.map((race, idx) => (
              <tr
                key={`${race.year}-${race.round}-${idx}`}
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
                  {race.driver_1_name && (
                    <span className="flex items-center gap-1.5">
                      <span
                        className={`font-mono font-bold ${positionColor(race.driver_1_position)}`}
                      >
                        {race.driver_1_position
                          ? `P${race.driver_1_position}`
                          : race.driver_1_status || "-"}
                      </span>
                      <span className="text-text-secondary text-xs">
                        {race.driver_1_name}
                      </span>
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {race.driver_2_name && (
                    <span className="flex items-center gap-1.5">
                      <span
                        className={`font-mono font-bold ${positionColor(race.driver_2_position)}`}
                      >
                        {race.driver_2_position
                          ? `P${race.driver_2_position}`
                          : race.driver_2_status || "-"}
                      </span>
                      <span className="text-text-secondary text-xs">
                        {race.driver_2_name}
                      </span>
                    </span>
                  )}
                </td>
                <td
                  className={`px-3 py-2 text-center font-bold font-mono ${positionColor(race.best_position)}`}
                >
                  {race.best_position ? `P${race.best_position}` : "-"}
                </td>
                <td className="px-3 py-2 text-right font-mono text-text-secondary">
                  {race.total_points}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
