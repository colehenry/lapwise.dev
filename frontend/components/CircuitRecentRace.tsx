"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { TrianglePattern } from "@/components/Patterns";
import Skeleton from "@/components/ui/Skeleton";
import { apiHeaders, apiUrl } from "@/lib/api";
import { constructorHref, driverHref } from "@/lib/entityLinks";
import type { CircuitRecentRaceResponse } from "@/lib/types";

function formatLapTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toFixed(3).padStart(6, "0")}`;
}

interface CircuitRecentRaceProps {
  circuitId: string;
}

export default function CircuitRecentRace({
  circuitId,
}: CircuitRecentRaceProps) {
  const { data, isLoading } = useQuery<CircuitRecentRaceResponse | null>({
    queryKey: ["circuit-recent-race", circuitId],
    queryFn: async () => {
      const res = await fetch(
        apiUrl(`/api/circuits/${circuitId}/recent-race`),
        {
          headers: apiHeaders(),
        },
      );
      if (!res.ok) return null;
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="bg-bg-tertiary border border-border-primary rounded-sm shadow-sm overflow-hidden">
        <div className="relative h-10 bg-bg-primary border-b border-border-primary px-4 flex items-center overflow-hidden">
          <span className="relative z-10 text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono">
            Most Recent Race
          </span>
        </div>
        <div className="p-6">
          <Skeleton variant="rectangular" height="120px" />
        </div>
      </div>
    );
  }

  if (!data || data.podium.length === 0) return null;

  return (
    <div className="bg-bg-tertiary border border-border-primary rounded-sm shadow-sm overflow-hidden">
      <div className="relative h-10 bg-bg-primary border-b border-border-primary px-4 flex items-center overflow-hidden">
        <TrianglePattern id="recent-race-triangles" />
        <span className="relative z-10 text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono">
          Most Recent Race
        </span>
      </div>
      <div className="p-6">
        {/* Event header */}
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-white">{data.event_name}</h3>
            <span className="text-xs text-text-muted font-mono">
              {data.year} Round {data.round}
            </span>
          </div>
          <Link
            href={`/results/${data.year}/${data.round}`}
            className="text-xs text-purple-400 hover:text-purple-300 font-mono uppercase tracking-widest transition-colors"
          >
            Full Results
          </Link>
        </div>

        {/* Podium */}
        <div className="space-y-2 mb-4">
          {data.podium.map((entry) => {
            const teamColor = entry.team_color
              ? `#${entry.team_color}`
              : "#999";
            const driverUrl = driverHref({
              driver_slug: entry.driver_slug,
              driver_code: entry.driver_code,
              full_name: entry.driver_name,
            });
            return (
              <div key={entry.position} className="flex items-center gap-3">
                <span
                  className={`w-6 text-center font-bold font-mono text-sm ${
                    entry.position === 1 ? "text-yellow-400" : "text-text-muted"
                  }`}
                >
                  {entry.position}
                </span>
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: teamColor }}
                />
                {driverUrl ? (
                  <Link
                    href={driverUrl}
                    className="text-sm text-text-secondary hover:text-purple-300 transition-colors font-medium"
                  >
                    {entry.driver_name}
                  </Link>
                ) : (
                  <span className="text-sm text-text-secondary font-medium">
                    {entry.driver_name}
                  </span>
                )}
                <Link
                  href={constructorHref(entry.team_name) ?? "/constructors"}
                  className="text-xs text-text-muted ml-auto hover:text-purple-300 transition-colors"
                >
                  {entry.team_name}
                </Link>
              </div>
            );
          })}
        </div>

        {/* Conditions row */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 pt-3 border-t border-border-primary">
          {data.fastest_lap_time && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-text-muted font-mono uppercase tracking-widest">
                FL
              </span>
              <span className="text-xs text-purple-300 font-mono font-bold">
                {formatLapTime(data.fastest_lap_time)}
              </span>
            </div>
          )}
          {data.avg_air_temp != null && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-text-muted font-mono uppercase tracking-widest">
                Air
              </span>
              <span className="text-xs text-orange-400 font-mono font-bold">
                {data.avg_air_temp}°C
              </span>
            </div>
          )}
          {data.avg_track_temp != null && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-text-muted font-mono uppercase tracking-widest">
                Track
              </span>
              <span className="text-xs text-red-400 font-mono font-bold">
                {data.avg_track_temp}°C
              </span>
            </div>
          )}
          {data.had_rainfall && (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-[10px] text-blue-400 font-mono uppercase tracking-widest font-bold">
                Wet
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
