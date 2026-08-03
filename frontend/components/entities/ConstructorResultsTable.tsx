"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import Skeleton from "@/components/ui/Skeleton";
import { apiHeaders, apiUrl } from "@/lib/api";
import { driverHref } from "@/lib/entityLinks";
import type {
  ConstructorRaceHistory,
  ConstructorRaceHistoryResponse,
} from "@/lib/types";

function positionColor(pos: number | null): string {
  if (!pos) return "text-text-muted";
  if (pos === 1) return "text-yellow-400";
  if (pos === 2) return "text-gray-300";
  if (pos === 3) return "text-amber-600";
  return "text-text-primary";
}

interface ConstructorResultsTableProps {
  teamName: string;
  includeSprint?: boolean;
}

function DriverResultCell({
  race,
  slot,
}: {
  race: ConstructorRaceHistory;
  slot: 1 | 2;
}) {
  const name = slot === 1 ? race.driver_1_name : race.driver_2_name;
  if (!name) return null;

  const position = slot === 1 ? race.driver_1_position : race.driver_2_position;
  const status = slot === 1 ? race.driver_1_status : race.driver_2_status;
  const href = driverHref({
    driver_slug: slot === 1 ? race.driver_1_slug : race.driver_2_slug,
    driver_code: slot === 1 ? race.driver_1_code : race.driver_2_code,
    full_name: name,
  });

  return (
    <span className="flex items-center gap-1.5">
      <span className={`font-mono font-bold ${positionColor(position)}`}>
        {position ? `P${position}` : status || "-"}
      </span>
      {href ? (
        <Link
          href={href}
          className="text-text-secondary text-xs hover:text-purple-300 transition-colors"
        >
          {name}
        </Link>
      ) : (
        <span className="text-text-secondary text-xs">{name}</span>
      )}
    </span>
  );
}

export default function ConstructorResultsTable({
  teamName,
  includeSprint = true,
}: ConstructorResultsTableProps) {
  const [selectedYear, setSelectedYear] = useState<number | "all">("all");

  const { data, isLoading } = useQuery<ConstructorRaceHistoryResponse>({
    queryKey: ["constructor-race-history", teamName, "all", includeSprint],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const params = new URLSearchParams({ all: "true" });
      if (!includeSprint) params.set("include_sprint", "false");
      const encodedTeamName = encodeURIComponent(teamName);
      const res = await fetch(
        apiUrl(`/api/constructors/${encodedTeamName}/race-history?${params}`),
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
                  <DriverResultCell race={race} slot={1} />
                </td>
                <td className="px-3 py-2">
                  <DriverResultCell race={race} slot={2} />
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
