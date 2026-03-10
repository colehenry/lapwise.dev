"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHART_COLORS } from "@/components/chart-primitives";
import { apiHeaders, apiUrl } from "@/lib/api";
import type {
  CircuitLapTimeTrendResponse,
  LapTimeTrendEntry,
} from "@/lib/types";

function formatLapTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toFixed(3).padStart(6, "0")}`;
}

interface TrendTooltipEntry {
  dataKey: string;
  value: number;
  payload: LapTimeTrendEntry;
}

interface TrendTooltipProps {
  active?: boolean;
  payload?: TrendTooltipEntry[];
}

function TrendTooltip({ active, payload }: TrendTooltipProps) {
  if (!active || !payload || !payload.length) return null;
  const entry = payload[0].payload;
  const teamColor = entry.team_color
    ? `#${entry.team_color}`
    : CHART_COLORS.purple;

  return (
    <div className="bg-bg-tertiary border border-border-primary rounded-lg p-3 shadow-xl">
      <p className="font-bold text-text-primary text-sm mb-1">{entry.year}</p>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between gap-4">
          <span className="text-text-secondary">Fastest Lap</span>
          <span className="font-mono text-text-primary font-bold">
            {formatLapTime(entry.fastest_lap_seconds)}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: teamColor }}
          />
          <span className="text-text-secondary">
            {entry.driver_code || entry.driver_name}
          </span>
        </div>
      </div>
    </div>
  );
}

interface CircuitLapTimeTrendProps {
  circuitId: string;
}

export default function CircuitLapTimeTrend({
  circuitId,
}: CircuitLapTimeTrendProps) {
  const { data, isLoading } = useQuery<CircuitLapTimeTrendResponse | null>({
    queryKey: ["circuit-lap-time-trend", circuitId],
    queryFn: async () => {
      const res = await fetch(
        apiUrl(`/api/circuits/${circuitId}/lap-time-trend`),
        { headers: apiHeaders() },
      );
      if (!res.ok) return null;
      return res.json();
    },
  });

  const domain = useMemo((): [number, number] => {
    if (!data || data.trend.length === 0) return [60, 120];
    const times = data.trend.map((t) => t.fastest_lap_seconds);
    const min = Math.min(...times);
    const max = Math.max(...times);
    return [Math.floor(min - 2), Math.ceil(max + 2)];
  }, [data]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-6 bg-bg-elevated rounded w-40 animate-pulse" />
        <div className="h-48 bg-bg-elevated rounded animate-pulse" />
      </div>
    );
  }

  if (!data || data.trend.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-text-muted text-sm font-mono">
          Lap time data not available for this circuit.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-text-secondary font-mono">
        Fastest Race Lap by Year
      </h3>

      <ResponsiveContainer width="100%" height={280}>
        <LineChart
          data={data.trend}
          margin={{ top: 10, right: 30, left: 50, bottom: 30 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={CHART_COLORS.borderPrimary}
          />
          <XAxis
            dataKey="year"
            stroke={CHART_COLORS.textMuted}
            tick={{ fill: CHART_COLORS.textTertiary, fontSize: 10 }}
            tickLine={false}
            label={{
              value: "Year",
              position: "insideBottom",
              offset: -15,
              style: { fill: CHART_COLORS.textTertiary, fontSize: 11 },
            }}
          />
          <YAxis
            domain={domain}
            stroke={CHART_COLORS.textMuted}
            tick={{ fill: CHART_COLORS.textTertiary, fontSize: 10 }}
            tickLine={false}
            tickFormatter={(v) => formatLapTime(v)}
            label={{
              value: "Lap Time",
              angle: -90,
              position: "center",
              dx: -35,
              style: { fill: CHART_COLORS.textTertiary, fontSize: 11 },
            }}
          />
          <Tooltip content={<TrendTooltip />} />
          <Line
            type="monotone"
            dataKey="fastest_lap_seconds"
            stroke={CHART_COLORS.purple}
            strokeWidth={2}
            dot={{ fill: CHART_COLORS.purple, r: 3 }}
            activeDot={{ r: 5, fill: CHART_COLORS.purple }}
            isAnimationActive={true}
            animationDuration={1200}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
