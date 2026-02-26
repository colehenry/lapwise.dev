"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import Skeleton from "@/components/ui/Skeleton";
import { apiHeaders, apiUrl } from "@/lib/api";
import type { DriverRaceHistoryResponse } from "@/lib/types";

function positionColor(pos: number | null, status: string): string {
  if (!pos || status === "DNF" || status === "DNS" || status === "DSQ")
    return "text-red-400";
  if (pos === 1) return "text-yellow-400";
  if (pos === 2) return "text-gray-300";
  if (pos === 3) return "text-amber-600";
  return "text-text-primary";
}

function positionDelta(
  grid: number | null,
  finish: number | null,
): string | null {
  if (grid === null || finish === null) return null;
  const delta = grid - finish;
  if (delta > 0) return `+${delta}`;
  if (delta < 0) return `${delta}`;
  return "0";
}

function deltaColor(delta: string | null): string {
  if (!delta) return "";
  if (delta.startsWith("+")) return "text-green-400";
  if (delta.startsWith("-")) return "text-red-400";
  return "text-text-muted";
}

interface DriverResultsTableProps {
  driverCode: string;
}

export default function DriverResultsTable({
  driverCode,
}: DriverResultsTableProps) {
  const [selectedYear, setSelectedYear] = useState<number | "all">("all");

  const { data, isLoading } = useQuery<DriverRaceHistoryResponse>({
    queryKey: ["driver-race-history", driverCode, "all"],
    queryFn: async () => {
      const res = await fetch(
        apiUrl(`/api/drivers/${driverCode}/race-history?all=true`),
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

  // Reverse so newest first
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
          className="bg-bg-tertiary border border-border-primary rounded px-3 py-1.5 text-sm text-text-primary focus:border-purple-500 focus:outline-none"
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
      <div className="overflow-x-auto rounded-lg border border-border-primary">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-bg-tertiary border-b border-border-primary">
              <th className="text-left px-3 py-2 text-xs font-mono font-bold uppercase tracking-widest text-text-muted">
                Year
              </th>
              <th className="text-left px-3 py-2 text-xs font-mono font-bold uppercase tracking-widest text-text-muted">
                Race
              </th>
              <th className="text-center px-3 py-2 text-xs font-mono font-bold uppercase tracking-widest text-text-muted">
                Grid
              </th>
              <th className="text-center px-3 py-2 text-xs font-mono font-bold uppercase tracking-widest text-text-muted">
                Finish
              </th>
              <th className="text-center px-3 py-2 text-xs font-mono font-bold uppercase tracking-widest text-text-muted">
                +/-
              </th>
              <th className="text-right px-3 py-2 text-xs font-mono font-bold uppercase tracking-widest text-text-muted">
                Pts
              </th>
              <th className="text-left px-3 py-2 text-xs font-mono font-bold uppercase tracking-widest text-text-muted hidden md:table-cell">
                Team
              </th>
              <th className="text-left px-3 py-2 text-xs font-mono font-bold uppercase tracking-widest text-text-muted hidden lg:table-cell">
                Status
              </th>
              <th className="text-center px-3 py-2 text-xs font-mono font-bold uppercase tracking-widest text-text-muted">
                FL
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedRaces.map((race, idx) => {
              const delta = positionDelta(race.grid_position, race.position);
              return (
                <tr
                  key={`${race.year}-${race.round}-${idx}`}
                  className="border-b border-border-primary/50 hover:bg-bg-tertiary/50 transition-colors"
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
                  <td className="px-3 py-2 text-center text-text-secondary font-mono">
                    {race.grid_position ?? "-"}
                  </td>
                  <td
                    className={`px-3 py-2 text-center font-bold font-mono ${positionColor(race.position, race.status)}`}
                  >
                    {race.position ? `P${race.position}` : race.status}
                  </td>
                  <td
                    className={`px-3 py-2 text-center font-mono text-xs ${deltaColor(delta)}`}
                  >
                    {delta ?? "-"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-text-secondary">
                    {race.points ?? 0}
                  </td>
                  <td className="px-3 py-2 hidden md:table-cell">
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
                  <td className="px-3 py-2 text-text-muted text-xs hidden lg:table-cell">
                    {race.status}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {race.fastest_lap && (
                      <span className="text-purple-400" title="Fastest Lap">
                        &#9889;
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
