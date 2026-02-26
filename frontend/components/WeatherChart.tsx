"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHART_COLORS } from "@/components/chart-primitives";
import { apiHeaders, apiUrl } from "@/lib/api";

type WeatherDataPoint = {
  session_time_seconds: number;
  air_temp: number | null;
  track_temp: number | null;
  humidity: number | null;
  rainfall: boolean | null;
};

type WeatherResponse = {
  year: number;
  round: number;
  event_name: string;
  weather: WeatherDataPoint[];
};

interface WeatherChartProps {
  season: number;
  round: number;
}

type ChartPoint = {
  time_min: number;
  air_temp: number | null;
  track_temp: number | null;
  humidity: number | null;
  rainfall: number; // 0 or 1 for area fill
};

interface WeatherTooltipEntry {
  dataKey: string;
  value: number;
  color: string;
  name: string;
  payload: ChartPoint;
}
interface WeatherTooltipProps {
  active?: boolean;
  payload?: WeatherTooltipEntry[];
  label?: number;
}
const WeatherTooltip = ({ active, payload, label }: WeatherTooltipProps) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-bg-tertiary border border-border-primary rounded-lg p-3 shadow-xl">
      <p className="font-bold text-text-primary text-sm mb-1">
        {label != null
          ? `${Math.floor(label)}m ${Math.round((label % 1) * 60)}s`
          : ""}
      </p>
      <div className="space-y-1 text-xs">
        {payload.map((entry: WeatherTooltipEntry) => {
          if (entry.dataKey === "rainfall") return null;
          return (
            <div key={entry.dataKey} className="flex justify-between gap-4">
              <div className="flex items-center gap-1.5">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-text-secondary">{entry.name}</span>
              </div>
              <span className="font-mono text-text-primary">
                {entry.dataKey === "humidity"
                  ? `${entry.value?.toFixed(0)}%`
                  : `${entry.value?.toFixed(1)}°C`}
              </span>
            </div>
          );
        })}
        {payload.some((e) => e.payload.rainfall > 0) && (
          <div className="flex items-center gap-1.5 text-blue-400">
            <div className="w-2 h-2 rounded-full bg-blue-400" />
            <span>Rain</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default function WeatherChart({ season, round }: WeatherChartProps) {
  const { data, isLoading: loading } = useQuery<WeatherResponse | null>({
    queryKey: ["weather", season, round],
    queryFn: async () => {
      const response = await fetch(
        apiUrl(`/api/results/${season}/${round}/weather`),
        { cache: "no-store", headers: apiHeaders() },
      );
      if (!response.ok) return null;
      return response.json();
    },
    enabled: season >= 2018,
  });

  const chartData = useMemo((): ChartPoint[] => {
    if (!data || !data.weather.length) return [];

    return data.weather.map((w) => ({
      time_min: w.session_time_seconds / 60,
      air_temp: w.air_temp,
      track_temp: w.track_temp,
      humidity: w.humidity,
      rainfall: w.rainfall ? 1 : 0,
    }));
  }, [data]);

  // Temperature domain
  const tempDomain = useMemo((): [number, number] => {
    if (chartData.length === 0) return [10, 50];

    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;

    for (const pt of chartData) {
      if (pt.air_temp != null) {
        min = Math.min(min, pt.air_temp);
        max = Math.max(max, pt.air_temp);
      }
      if (pt.track_temp != null) {
        min = Math.min(min, pt.track_temp);
        max = Math.max(max, pt.track_temp);
      }
    }

    return [Math.floor(min - 2), Math.ceil(max + 2)];
  }, [chartData]);

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-6 bg-bg-elevated rounded w-40 animate-pulse" />
        <div className="h-48 bg-bg-elevated rounded animate-pulse" />
      </div>
    );
  }

  if (!data || chartData.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-text-muted text-sm">
          {season < 2018
            ? "Weather data is only available from 2018 onwards."
            : "No weather data available for this session."}
        </p>
      </div>
    );
  }

  const hasRainfall = chartData.some((p) => p.rainfall > 0);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-text-secondary font-mono">
        {data.event_name.replace("Grand Prix", "GP")} - Weather
      </h3>

      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart
          data={chartData}
          margin={{ top: 10, right: 20, left: 50, bottom: 20 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={CHART_COLORS.borderPrimary}
          />
          <XAxis
            dataKey="time_min"
            stroke={CHART_COLORS.textTertiary}
            tick={{ fill: CHART_COLORS.textTertiary, fontSize: 10 }}
            tickFormatter={(v) => `${Math.floor(v)}m`}
            label={{
              value: "Session Time",
              position: "insideBottom",
              offset: -15,
              style: {
                fill: CHART_COLORS.textTertiary,
                fontSize: 11,
              },
            }}
          />
          <YAxis
            yAxisId="temp"
            stroke={CHART_COLORS.textTertiary}
            domain={tempDomain}
            tick={{ fill: CHART_COLORS.textTertiary, fontSize: 10 }}
            tickFormatter={(v) => `${v}°C`}
            label={{
              value: "Temperature",
              angle: -90,
              position: "center",
              dx: -35,
              style: {
                fill: CHART_COLORS.textTertiary,
                fontSize: 11,
              },
            }}
          />
          <Tooltip content={<WeatherTooltip />} />

          {/* Rainfall indicator as subtle area fill */}
          {hasRainfall && (
            <Area
              yAxisId="temp"
              type="step"
              dataKey="rainfall"
              fill="rgba(59, 130, 246, 0.1)"
              stroke="none"
              baseLine={0}
              isAnimationActive={false}
            />
          )}

          <Line
            yAxisId="temp"
            type="monotone"
            dataKey="air_temp"
            name="Air Temp"
            stroke="#f97316"
            strokeWidth={2}
            dot={false}
            isAnimationActive={true}
            animationDuration={1200}
          />
          <Line
            yAxisId="temp"
            type="monotone"
            dataKey="track_temp"
            name="Track Temp"
            stroke="#ef4444"
            strokeWidth={2}
            dot={false}
            isAnimationActive={true}
            animationDuration={1200}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 bg-orange-500 rounded" />
          <span className="text-[10px] font-mono text-text-muted">
            AIR TEMP
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 bg-red-500 rounded" />
          <span className="text-[10px] font-mono text-text-muted">
            TRACK TEMP
          </span>
        </div>
        {hasRainfall && (
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-blue-500/20 rounded-sm border border-blue-500/30" />
            <span className="text-[10px] font-mono text-text-muted">
              RAINFALL
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
