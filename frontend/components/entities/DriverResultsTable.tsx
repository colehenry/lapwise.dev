"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import Skeleton from "@/components/ui/Skeleton";
import { constructorHref } from "@/lib/entityLinks";
import { driverRaceHistoryQuery } from "@/lib/queries/entities";

function positionColor(pos: number | null, status: string): string {
  if (!pos || status === "DNF" || status === "DNS" || status === "DSQ")
    return "text-danger-bright";
  if (pos === 1) return "text-yellow-400";
  if (pos === 2) return "text-gray-300";
  if (pos === 3) return "text-amber-600";
  return "text-ink-strong";
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
  if (delta.startsWith("-")) return "text-danger-bright";
  return "text-ink-faint";
}

interface DriverResultsTableProps {
  driverCode: string;
  includeSprint?: boolean;
}

export default function DriverResultsTable({
  driverCode,
  includeSprint = true,
}: DriverResultsTableProps) {
  const [selectedYear, setSelectedYear] = useState<number | "all">("all");

  const { data, isLoading } = useQuery(driverRaceHistoryQuery(driverCode));

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
      <div className="text-center py-12 text-ink-faint">
        No race results available.
      </div>
    );
  }

  const filteredRaces = data.races.filter(
    (r) =>
      (selectedYear === "all" || r.year === selectedYear) &&
      (includeSprint || r.session_type !== "sprint_race"),
  );

  // Reverse so newest first
  const sortedRaces = [...filteredRaces].reverse();

  return (
    <div>
      {/* Year filter */}
      <div className="mb-4 flex items-center gap-3">
        <label
          htmlFor="year-filter"
          className="text-xs font-mono font-bold uppercase tracking-widest text-ink-faint"
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
          className="bg-surface-panel border border-line-soft rounded-sm px-3 py-1.5 text-sm text-ink-strong focus:border-accent focus:outline-none"
        >
          <option value="all">All Seasons</option>
          {data.available_years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <span className="text-xs text-ink-faint ml-auto">
          {sortedRaces.length} race{sortedRaces.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
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
              <th className="text-center px-3 py-2 text-xs font-mono font-bold uppercase tracking-widest text-ink-faint">
                Grid
              </th>
              <th className="text-center px-3 py-2 text-xs font-mono font-bold uppercase tracking-widest text-ink-faint">
                Finish
              </th>
              <th className="text-center px-3 py-2 text-xs font-mono font-bold uppercase tracking-widest text-ink-faint">
                +/-
              </th>
              <th className="text-right px-3 py-2 text-xs font-mono font-bold uppercase tracking-widest text-ink-faint">
                Pts
              </th>
              <th className="text-left px-3 py-2 text-xs font-mono font-bold uppercase tracking-widest text-ink-faint hidden md:table-cell">
                Team
              </th>
              <th className="text-left px-3 py-2 text-xs font-mono font-bold uppercase tracking-widest text-ink-faint hidden lg:table-cell">
                Status
              </th>
              <th className="text-center px-3 py-2 text-xs font-mono font-bold uppercase tracking-widest text-ink-faint">
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
                  className="border-b border-line-soft/50 hover:bg-surface-raised/50 transition-colors"
                >
                  <td className="px-3 py-2 text-ink-base font-mono text-xs">
                    {race.year}
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      href={
                        race.session_type === "sprint_race"
                          ? `/results/${race.year}/${race.round}/sprint`
                          : `/results/${race.year}/${race.round}`
                      }
                      className="text-ink-strong hover:text-accent-light transition-colors flex items-center gap-1.5"
                    >
                      {race.race_name.replace("Grand Prix", "GP")}
                      {race.session_type === "sprint_race" && (
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-yellow-400 bg-yellow-400/10 border border-yellow-400/30 px-1 py-0.5 rounded-sm leading-none">
                          Sprint
                        </span>
                      )}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-center text-ink-base font-mono">
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
                  <td className="px-3 py-2 text-right font-mono text-ink-base">
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
                        href={
                          constructorHref(race.team_name) ?? "/constructors"
                        }
                        className="text-ink-base text-xs hover:text-accent-light transition-colors"
                      >
                        {race.team_name}
                      </Link>
                    </span>
                  </td>
                  <td className="px-3 py-2 text-ink-faint text-xs hidden lg:table-cell">
                    {race.status}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {race.fastest_lap && (
                      <span className="text-accent-bright" title="Fastest Lap">
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
