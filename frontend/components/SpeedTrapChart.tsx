"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHART_COLORS } from "@/components/chart-primitives";
import { apiHeaders, apiUrl } from "@/lib/api";
import type { LapTimesResponse } from "@/lib/types";

interface SpeedTrapChartProps {
  season: number;
  round: number;
  isSprint?: boolean;
}

type SpeedTrapType = "speed_st" | "speed_i1" | "speed_i2" | "speed_fl";

const TRAP_LABELS: Record<SpeedTrapType, string> = {
  speed_st: "Speed Trap",
  speed_i1: "Intermediate 1",
  speed_i2: "Intermediate 2",
  speed_fl: "Finish Line",
};

type DriverSpeed = {
  driver_code: string;
  full_name: string;
  team_color: string;
  max_speed: number;
  isFastest: boolean;
};

const SpeedTooltip = ({ active, payload }: any) => {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0]?.payload as DriverSpeed | undefined;
  if (!data) return null;

  return (
    <div className="bg-bg-tertiary border border-border-primary rounded-lg p-3 shadow-xl">
      <p className="font-bold text-text-primary text-sm">{data.full_name}</p>
      <p className="font-mono text-text-secondary text-xs mt-1">
        {data.max_speed.toFixed(1)} km/h
      </p>
      {data.isFastest && (
        <p className="text-purple-400 text-xs font-bold mt-1">Fastest</p>
      )}
    </div>
  );
};

export default function SpeedTrapChart({
  season,
  round,
  isSprint = false,
}: SpeedTrapChartProps) {
  const [trapType, setTrapType] = useState<SpeedTrapType>("speed_st");

  const { data, isLoading: loading } = useQuery<LapTimesResponse | null>({
    queryKey: ["speed-trap", season, round, isSprint],
    queryFn: async () => {
      const endpoint = isSprint
        ? `/api/results/${season}/${round}/sprint/lap-times`
        : `/api/results/${season}/${round}/lap-times`;
      const response = await fetch(apiUrl(endpoint), {
        cache: "no-store",
        headers: apiHeaders(),
      });
      if (!response.ok) return null;
      return response.json();
    },
    enabled: season >= 2018,
  });

  // Compute max speed per driver for the selected trap type
  const chartData = useMemo((): DriverSpeed[] => {
    if (!data) return [];

    const speeds: DriverSpeed[] = [];

    for (const driver of data.drivers) {
      let maxSpeed = 0;

      for (const lap of driver.laps) {
        const speed = lap[trapType];
        if (speed != null && speed > maxSpeed) {
          maxSpeed = speed;
        }
      }

      if (maxSpeed > 0) {
        speeds.push({
          driver_code: driver.driver_code,
          full_name: driver.full_name,
          team_color: driver.team_color ? `#${driver.team_color}` : "#666",
          max_speed: maxSpeed,
          isFastest: false,
        });
      }
    }

    // Sort by speed descending
    speeds.sort((a, b) => b.max_speed - a.max_speed);

    // Mark fastest
    if (speeds.length > 0) {
      speeds[0].isFastest = true;
    }

    return speeds;
  }, [data, trapType]);

  // Check which trap types have data
  const availableTraps = useMemo((): SpeedTrapType[] => {
    if (!data) return [];
    const traps: SpeedTrapType[] = [];
    for (const trap of [
      "speed_st",
      "speed_i1",
      "speed_i2",
      "speed_fl",
    ] as SpeedTrapType[]) {
      const hasData = data.drivers.some((d) =>
        d.laps.some((l) => l[trap] != null && (l[trap] ?? 0) > 0),
      );
      if (hasData) traps.push(trap);
    }
    return traps;
  }, [data]);

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-6 bg-bg-elevated rounded w-48 animate-pulse" />
        <div className="h-80 bg-bg-elevated rounded animate-pulse" />
      </div>
    );
  }

  if (!data || chartData.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-text-muted text-sm">
          {season < 2018
            ? "Speed trap data is only available from 2018 onwards."
            : "No speed trap data available for this session."}
        </p>
      </div>
    );
  }

  const minSpeed = Math.min(...chartData.map((d) => d.max_speed));
  const domainMin = Math.floor(minSpeed * 0.97);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-bold text-text-secondary font-mono">
          {data.event_name.replace("Grand Prix", "GP")} - Top Speeds
        </h3>

        {/* Trap type selector */}
        <div className="flex items-center gap-1">
          {availableTraps.map((trap) => (
            <button
              key={trap}
              type="button"
              onClick={() => setTrapType(trap)}
              className={`px-3 py-1.5 rounded-sm text-xs font-bold font-mono uppercase tracking-widest transition-colors duration-150 ${
                trapType === trap
                  ? "bg-purple-500/20 border border-purple-500 text-purple-300"
                  : "border border-transparent text-text-muted hover:text-text-secondary"
              }`}
            >
              {TRAP_LABELS[trap]}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer
        width="100%"
        height={Math.max(chartData.length * 28 + 40, 200)}
      >
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 5, right: 40, left: 50, bottom: 5 }}
          barSize={20}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={CHART_COLORS.borderPrimary}
            horizontal={false}
          />
          <XAxis
            type="number"
            domain={[domainMin, "dataMax"]}
            tick={{ fill: CHART_COLORS.textTertiary, fontSize: 11 }}
            tickFormatter={(v) => `${v}`}
            label={{
              value: "km/h",
              position: "insideBottomRight",
              offset: -5,
              style: { fill: CHART_COLORS.textTertiary, fontSize: 11 },
            }}
          />
          <YAxis
            type="category"
            dataKey="driver_code"
            width={48}
            tick={{
              fill: CHART_COLORS.textTertiary,
              fontSize: 11,
              fontFamily: "monospace",
              fontWeight: "bold",
            }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<SpeedTooltip />} />
          <Bar dataKey="max_speed" radius={[0, 3, 3, 0]}>
            {chartData.map((entry) => (
              <Cell
                key={entry.driver_code}
                fill={entry.team_color}
                fillOpacity={entry.isFastest ? 1 : 0.6}
                stroke={entry.isFastest ? "#a855f7" : "none"}
                strokeWidth={entry.isFastest ? 2 : 0}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
