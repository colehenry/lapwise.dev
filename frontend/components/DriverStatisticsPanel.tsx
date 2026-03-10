"use client";

import { useQuery } from "@tanstack/react-query";
import { TrianglePattern } from "@/components/Patterns";
import Skeleton from "@/components/ui/Skeleton";
import { apiHeaders, apiUrl } from "@/lib/api";
import type { DriverRaceHistoryResponse } from "@/lib/types";

interface DriverStatisticsPanelProps {
  driverCode: string;
}

export default function DriverStatisticsPanel({
  driverCode,
}: DriverStatisticsPanelProps) {
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
    // Status breakdown
    const statusKey =
      race.status === "Finished" || race.status?.startsWith("+")
        ? "Finished"
        : race.status;
    statusBreakdown[statusKey] = (statusBreakdown[statusKey] || 0) + 1;

    // Position distribution
    if (!race.position || race.status === "DNF" || race.status === "DNS") {
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
    P1: "#facc15",
    P2: "#d1d5db",
    P3: "#d97706",
    "P4-10": "#a855f7",
    "P11+": "#6b7280",
    DNF: "#ef4444",
  };

  const statusData = Object.entries(statusBreakdown)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  return (
    <div className="space-y-8">
      {/* Finish Position Distribution */}
      <div className="bg-bg-tertiary border border-border-primary rounded-sm shadow-sm overflow-hidden">
        <div className="relative h-10 bg-bg-primary border-b border-border-primary px-4 flex items-center overflow-hidden">
          <TrianglePattern id="stats-finish-position" />
          <span className="relative z-10 text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono">
            Finish Position Distribution
          </span>
        </div>
        <div className="p-6">
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
                        backgroundColor: distColors[d.label] || "#6b7280",
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
        </div>
      </div>

      {/* Status Breakdown */}
      <div className="bg-bg-tertiary border border-border-primary rounded-sm shadow-sm overflow-hidden">
        <div className="relative h-10 bg-bg-primary border-b border-border-primary px-4 flex items-center overflow-hidden">
          <TrianglePattern id="stats-status-breakdown" />
          <span className="relative z-10 text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono">
            Status Breakdown
          </span>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {statusData.map(([status, count]) => (
              <div
                key={status}
                className="bg-bg-elevated rounded-sm p-4 border border-border-primary/50"
              >
                <p className="text-text-muted text-xs mb-1 truncate">
                  {status}
                </p>
                <p className="text-white text-xl font-bold">{count}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
