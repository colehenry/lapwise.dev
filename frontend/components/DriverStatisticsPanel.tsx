"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Skeleton from "@/components/ui/Skeleton";
import { apiHeaders, apiUrl } from "@/lib/api";
import type {
  DriverRaceHistoryResponse,
  DriverSeasonHistoryResponse,
} from "@/lib/types";

interface DriverStatisticsPanelProps {
  driverCode: string;
}

export default function DriverStatisticsPanel({
  driverCode,
}: DriverStatisticsPanelProps) {
  const { data: seasonData, isLoading: seasonLoading } =
    useQuery<DriverSeasonHistoryResponse>({
      queryKey: ["driver-season-history", driverCode],
      queryFn: async () => {
        const res = await fetch(
          apiUrl(`/api/drivers/${driverCode}/season-history`),
          { headers: apiHeaders() },
        );
        if (!res.ok) throw new Error("Failed to fetch season history");
        return res.json();
      },
    });

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

  if (seasonLoading || raceLoading) {
    return (
      <div className="space-y-6">
        <Skeleton variant="rectangular" height="300px" />
        <Skeleton variant="rectangular" height="200px" />
      </div>
    );
  }

  // Points per season chart data
  const seasonChartData = (seasonData?.seasons ?? []).map((s) => ({
    year: s.year,
    points: s.total_points,
    color: s.team_color ? `#${s.team_color}` : "#a855f7",
    team: s.team_name,
  }));

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
      {/* Points per Season */}
      <div className="bg-bg-tertiary border border-border-primary rounded-lg p-6">
        <h3 className="text-lg font-bold text-white mb-4">Points per Season</h3>
        {seasonChartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={seasonChartData}>
              <XAxis
                dataKey="year"
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "#334155" }}
              />
              <YAxis
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "#334155" }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1e293b",
                  border: "1px solid #334155",
                  borderRadius: 8,
                  color: "#fff",
                  fontSize: 12,
                }}
                formatter={(value) => [`${value ?? 0} pts`, "Points"]}
              />
              <Bar dataKey="points" radius={[4, 4, 0, 0]}>
                {seasonChartData.map((entry) => (
                  <Cell key={entry.year} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-text-muted text-sm">No season data available.</p>
        )}
      </div>

      {/* Finish Position Distribution */}
      <div className="bg-bg-tertiary border border-border-primary rounded-lg p-6">
        <h3 className="text-lg font-bold text-white mb-4">
          Finish Position Distribution
        </h3>
        <div className="space-y-3">
          {distData.map((d) => {
            const pct = races.length > 0 ? (d.count / races.length) * 100 : 0;
            return (
              <div key={d.label} className="flex items-center gap-3">
                <span className="text-xs font-mono text-text-secondary w-12 text-right">
                  {d.label}
                </span>
                <div className="flex-1 h-6 bg-bg-elevated rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
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

      {/* Status Breakdown */}
      <div className="bg-bg-tertiary border border-border-primary rounded-lg p-6">
        <h3 className="text-lg font-bold text-white mb-4">Status Breakdown</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statusData.map(([status, count]) => (
            <div
              key={status}
              className="bg-bg-elevated rounded-lg p-4 border border-border-primary/50"
            >
              <p className="text-text-muted text-xs mb-1 truncate">{status}</p>
              <p className="text-white text-xl font-bold">{count}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
