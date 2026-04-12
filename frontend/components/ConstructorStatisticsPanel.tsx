"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import ArchivePanel from "@/components/archive/ArchivePanel";
import { CHART_COLORS, CHART_TYPOGRAPHY } from "@/components/chart-primitives";
import Skeleton from "@/components/ui/Skeleton";
import { apiHeaders, apiUrl } from "@/lib/api";
import type { ConstructorRaceHistoryResponse } from "@/lib/types";

interface ConstructorStatisticsPanelProps {
  teamName: string;
}

const ChartTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string }>;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-bg-tertiary border border-border-primary rounded-sm p-3 shadow-xl">
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2">
          <span className={CHART_TYPOGRAPHY.tooltipValueClassName}>
            {entry.name}
          </span>
          <span className="font-mono text-xs font-bold text-text-primary tabular-nums">
            {entry.value}
          </span>
        </div>
      ))}
    </div>
  );
};

export default function ConstructorStatisticsPanel({
  teamName,
}: ConstructorStatisticsPanelProps) {
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

  if (raceLoading) {
    return (
      <div className="space-y-6">
        <Skeleton variant="rectangular" height="200px" />
        <Skeleton variant="rectangular" height="200px" />
      </div>
    );
  }

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
      {/* Wins & Podiums per Season */}
      {winPodiumData.length > 0 && (
        <ArchivePanel
          title="Wins & Podiums per Season"
          headerId="constructor-wins-podiums"
        >
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={winPodiumData}>
              <XAxis
                dataKey="year"
                tick={{ fill: CHART_COLORS.textTertiary, fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: CHART_COLORS.borderPrimary }}
                interval={Math.max(0, Math.ceil(winPodiumData.length / 15) - 1)}
              />
              <YAxis
                tick={{ fill: CHART_COLORS.textTertiary, fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: CHART_COLORS.borderPrimary }}
              />
              <Tooltip content={<ChartTooltip />} cursor={false} />
              <Bar
                dataKey="podiums"
                fill="#a855f7"
                radius={[4, 4, 0, 0]}
                name="Podiums"
                activeBar={false}
              />
              <Bar
                dataKey="wins"
                fill="#facc15"
                radius={[4, 4, 0, 0]}
                name="Wins"
                activeBar={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </ArchivePanel>
      )}

      {/* Best Finish Distribution */}
      <ArchivePanel
        title="Finish Distribution"
        headerId="constructor-finish-dist"
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
      </ArchivePanel>
    </div>
  );
}
