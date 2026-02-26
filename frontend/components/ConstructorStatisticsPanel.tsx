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
  ConstructorRaceHistoryResponse,
  ConstructorSeasonHistoryResponse,
} from "@/lib/types";

interface ConstructorStatisticsPanelProps {
  teamName: string;
}

export default function ConstructorStatisticsPanel({
  teamName,
}: ConstructorStatisticsPanelProps) {
  const { data: seasonData, isLoading: seasonLoading } =
    useQuery<ConstructorSeasonHistoryResponse>({
      queryKey: ["constructor-season-history", teamName],
      queryFn: async () => {
        const res = await fetch(
          apiUrl(`/api/constructors/${teamName}/season-history`),
          { headers: apiHeaders() },
        );
        if (!res.ok) throw new Error("Failed to fetch season history");
        return res.json();
      },
    });

  const { data: raceData, isLoading: raceLoading } =
    useQuery<ConstructorRaceHistoryResponse>({
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
  }));

  // Win/podium counts per season
  const seasonStats: Record<number, { wins: number; podiums: number }> = {};
  for (const race of raceData?.races ?? []) {
    if (!seasonStats[race.year]) {
      seasonStats[race.year] = { wins: 0, podiums: 0 };
    }
    if (race.best_position === 1) seasonStats[race.year].wins += 1;
    if (race.best_position && race.best_position <= 3)
      seasonStats[race.year].podiums += 1;
  }

  const winPodiumData = Object.entries(seasonStats)
    .map(([year, stats]) => ({
      year: Number(year),
      wins: stats.wins,
      podiums: stats.podiums,
    }))
    .sort((a, b) => a.year - b.year);

  // Best finish distribution
  const races = raceData?.races ?? [];
  const distribution = { P1: 0, P2: 0, P3: 0, "P4-10": 0, "P11+": 0 };
  for (const race of races) {
    const pos = race.best_position;
    if (!pos) continue;
    if (pos === 1) distribution.P1 += 1;
    else if (pos === 2) distribution.P2 += 1;
    else if (pos === 3) distribution.P3 += 1;
    else if (pos <= 10) distribution["P4-10"] += 1;
    else distribution["P11+"] += 1;
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
  };

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

      {/* Wins & Podiums per Season */}
      {winPodiumData.length > 0 && (
        <div className="bg-bg-tertiary border border-border-primary rounded-lg p-6">
          <h3 className="text-lg font-bold text-white mb-4">
            Wins & Podiums per Season
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={winPodiumData}>
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
              />
              <Bar
                dataKey="podiums"
                fill="#a855f7"
                radius={[4, 4, 0, 0]}
                name="Podiums"
              />
              <Bar
                dataKey="wins"
                fill="#facc15"
                radius={[4, 4, 0, 0]}
                name="Wins"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Best Finish Distribution */}
      <div className="bg-bg-tertiary border border-border-primary rounded-lg p-6">
        <h3 className="text-lg font-bold text-white mb-4">
          Best Finish Distribution
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
    </div>
  );
}
