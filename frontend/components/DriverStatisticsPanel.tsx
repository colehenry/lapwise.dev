"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import ArchivePanel from "@/components/archive/ArchivePanel";
import MonoLabel from "@/components/ui/MonoLabel";
import Skeleton from "@/components/ui/Skeleton";
import { apiHeaders, apiUrl } from "@/lib/api";
import type { DriverRaceHistoryResponse } from "@/lib/types";

interface DriverStatisticsPanelProps {
  driverCode: string;
}

import { POSITION_COLORS, SERIES_COLORS } from "@/lib/palette";

export default function DriverStatisticsPanel({
  driverCode,
}: DriverStatisticsPanelProps) {
  const [hoveredStatus, setHoveredStatus] = useState<string | null>(null);
  const { data: raceData, isLoading: raceLoading } =
    useQuery<DriverRaceHistoryResponse>({
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

  if (raceLoading) {
    return (
      <div className="space-y-6">
        <Skeleton variant="rectangular" height="200px" />
        <Skeleton variant="rectangular" height="200px" />
      </div>
    );
  }

  // Finish position distribution
  const races = raceData?.races ?? [];
  const distribution = { P1: 0, P2: 0, P3: 0, "P4-10": 0, "P11+": 0, DNF: 0 };
  const statusBreakdown: Record<string, number> = {};

  for (const race of races) {
    const finished =
      race.status === "Finished" || Boolean(race.status?.startsWith("+"));

    // Status breakdown
    const statusKey = finished ? "Finished" : race.status;
    statusBreakdown[statusKey] = (statusBreakdown[statusKey] || 0) + 1;

    // Position distribution
    if (!race.position || !finished) {
      distribution.DNF += 1;
    } else if (race.position === 1) {
      distribution.P1 += 1;
    } else if (race.position === 2) {
      distribution.P2 += 1;
    } else if (race.position === 3) {
      distribution.P3 += 1;
    } else if (race.position <= 10) {
      distribution["P4-10"] += 1;
    } else {
      distribution["P11+"] += 1;
    }
  }

  const distData = Object.entries(distribution).map(([label, count]) => ({
    label,
    count,
  }));

  const distColors: Record<string, string> = {
    P1: POSITION_COLORS.gold,
    P2: POSITION_COLORS.silver,
    P3: POSITION_COLORS.bronze,
    "P4-10": POSITION_COLORS.points,
    "P11+": POSITION_COLORS.outPoints,
    DNF: "var(--delta-slower)",
  };

  const statusData = Object.entries(statusBreakdown)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  const statusSegments = statusData.map(([status, count], index) => ({
    status,
    count,
    color: SERIES_COLORS[index] ?? "var(--delta-neutral)",
    pct: races.length > 0 ? (count / races.length) * 100 : 0,
  }));
  const primaryStatus = statusSegments[0] ?? null;
  const activeStatus =
    statusSegments.find((segment) => segment.status === hoveredStatus) ??
    primaryStatus;

  return (
    <div className="space-y-8">
      {/* Finish Position Distribution */}
      <ArchivePanel
        title="Finish Position Distribution"
        headerId="stats-finish-position"
      >
        <div className="space-y-3">
          {distData.map((d) => {
            const pct = races.length > 0 ? (d.count / races.length) * 100 : 0;
            return (
              <div key={d.label} className="flex items-center gap-3">
                <span className="text-xs font-mono text-text-secondary w-12 text-right">
                  {d.label}
                </span>
                <div className="flex-1 h-6 bg-bg-elevated rounded-sm overflow-hidden">
                  <div
                    className="h-full rounded-sm transition-all duration-500"
                    style={{
                      width: `${Math.max(pct, 1)}%`,
                      backgroundColor:
                        distColors[d.label] || "var(--pos-outpoints)",
                    }}
                  />
                </div>
                <span className="text-xs font-mono text-text-muted w-16">
                  {d.count} ({pct.toFixed(0)}%)
                </span>
              </div>
            );
          })}
        </div>
      </ArchivePanel>

      {/* Status Breakdown */}
      <ArchivePanel title="Race Outcomes" headerId="stats-status-breakdown">
        <div className="rounded-sm border border-border-primary bg-bg-primary/20 p-4 md:p-5">
          <div className="mb-4 flex items-baseline justify-between gap-4">
            {primaryStatus && (
              <div>
                <div className="font-mono text-2xl font-bold tabular-nums text-text-primary">
                  {primaryStatus.pct.toFixed(0)}%
                </div>
                <MonoLabel>{primaryStatus.status}</MonoLabel>
              </div>
            )}
            <div className="text-right">
              <div className="font-mono text-2xl font-bold tabular-nums text-text-primary">
                {races.length.toLocaleString()}
              </div>
              <MonoLabel>Total Starts</MonoLabel>
            </div>
          </div>

          <div className="relative">
            {activeStatus && hoveredStatus && (
              <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-3 min-w-48 -translate-x-1/2 rounded-sm border border-border-primary bg-bg-tertiary px-3 py-2 shadow-xl">
                <div className="mb-1 flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: activeStatus.color }}
                  />
                  <span className="text-sm font-semibold text-text-primary">
                    {activeStatus.status}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4 font-mono text-xs tabular-nums">
                  <span className="text-text-muted">
                    {activeStatus.count.toLocaleString()} starts
                  </span>
                  <span className="font-bold text-text-primary">
                    {activeStatus.pct.toFixed(1)}%
                  </span>
                </div>
              </div>
            )}
            <div className="flex h-5 overflow-hidden rounded-sm bg-bg-primary">
              {statusSegments.map((segment) => (
                <button
                  key={segment.status}
                  type="button"
                  className="h-full cursor-help transition-opacity hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-white/60"
                  onMouseEnter={() => setHoveredStatus(segment.status)}
                  onMouseLeave={() => setHoveredStatus(null)}
                  onFocus={() => setHoveredStatus(segment.status)}
                  onBlur={() => setHoveredStatus(null)}
                  aria-label={`${segment.status}: ${segment.count.toLocaleString()} starts, ${segment.pct.toFixed(1)} percent`}
                  style={{
                    width: `${segment.pct}%`,
                    backgroundColor: segment.color,
                  }}
                />
              ))}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {statusSegments.map((segment) => (
              <div
                key={segment.status}
                className="grid grid-cols-[auto_1fr_auto] items-center gap-3"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: segment.color }}
                />
                <span className="truncate text-sm font-semibold text-text-primary">
                  {segment.status}
                </span>
                <span className="font-mono text-sm font-bold tabular-nums text-text-secondary">
                  {segment.count.toLocaleString()}
                  <span className="ml-2 text-text-muted">
                    {segment.pct.toFixed(0)}%
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </ArchivePanel>
    </div>
  );
}
