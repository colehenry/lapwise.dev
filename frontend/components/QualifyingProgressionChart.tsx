"use client";

import { useMemo, useState } from "react";
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
import type { SessionResultsResponse } from "@/lib/types";

interface QualifyingProgressionChartProps {
  qualifyingData: SessionResultsResponse | null | undefined;
}

const SEGMENTS = ["Q1", "Q2", "Q3"] as const;

const formatTime = (s: number) => {
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem.toFixed(3).padStart(6, "0")}`;
};

type DriverSlopeData = {
  code: string;
  fullName: string;
  teamColor: string;
  Q1?: number;
  Q2?: number;
  Q3?: number;
  finalPos: number;
};

export default function QualifyingProgressionChart({
  qualifyingData,
}: QualifyingProgressionChartProps) {
  const [highlightQ3Only, setHighlightQ3Only] = useState(true);

  const { chartData, drivers } = useMemo(() => {
    if (!qualifyingData) return { chartData: [], drivers: [] };

    const drivers: DriverSlopeData[] = qualifyingData.results.map((r) => ({
      code: r.driver.driver_code ?? r.driver.full_name,
      fullName: r.driver.full_name,
      teamColor: r.team.team_color ? `#${r.team.team_color}` : "#666",
      Q1: r.q1_time_seconds ?? undefined,
      Q2: r.q2_time_seconds ?? undefined,
      Q3: r.q3_time_seconds ?? undefined,
      finalPos: r.position ?? 99,
    }));

    // Sort by final qualifying position
    drivers.sort((a, b) => a.finalPos - b.finalPos);

    // Build chart data: one point per segment
    const chartData = SEGMENTS.map((seg) => {
      const row: Record<string, number | string> = { segment: seg };
      for (const d of drivers) {
        if (d[seg] != null) row[d.code] = d[seg] as number;
      }
      return row;
    });

    return { chartData, drivers };
  }, [qualifyingData]);

  if (!qualifyingData || drivers.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-text-muted text-sm font-mono">
          No qualifying data available.
        </p>
      </div>
    );
  }

  const q3Drivers = new Set(
    drivers.filter((d) => d.Q3 != null).map((d) => d.code),
  );
  const displayDrivers = highlightQ3Only ? drivers : drivers;

  // Y-axis: compute range from all data
  const allTimes = drivers.flatMap((d) =>
    SEGMENTS.map((s) => d[s]).filter((v): v is number => v != null),
  );
  const minT = allTimes.length ? Math.min(...allTimes) : 0;
  const maxT = allTimes.length ? Math.max(...allTimes) : 1;
  const pad = (maxT - minT) * 0.05;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-[10px] text-text-muted font-mono uppercase tracking-widest">
          Lap time per segment · slope shows improvement
        </p>
        <button
          type="button"
          onClick={() => setHighlightQ3Only((v) => !v)}
          className={`px-3 py-1.5 rounded-sm text-[10px] font-bold font-mono uppercase tracking-widest border transition-colors duration-150 ${
            highlightQ3Only
              ? "bg-purple-500/20 border-purple-500 text-purple-300"
              : "border-border-primary text-text-muted hover:text-text-secondary"
          }`}
        >
          {highlightQ3Only ? "Q3 bright" : "All equal"}
        </button>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart
          data={chartData}
          margin={{ top: 4, right: 20, left: 16, bottom: 4 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={CHART_COLORS.borderPrimary}
          />
          <XAxis
            dataKey="segment"
            tick={{
              fill: CHART_COLORS.textTertiary,
              fontSize: 12,
              fontFamily: "monospace",
              fontWeight: "bold",
            }}
          />
          <YAxis
            domain={[minT - pad, maxT + pad]}
            tick={{
              fill: CHART_COLORS.textTertiary,
              fontSize: 10,
              fontFamily: "monospace",
            }}
            tickFormatter={formatTime}
            width={72}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const sorted = [...payload]
                .filter((p) => p.value != null)
                .sort((a, b) => (a.value as number) - (b.value as number));
              return (
                <div className="bg-bg-tertiary border border-border-primary rounded-sm p-2 shadow-lg text-xs space-y-0.5">
                  <p className="text-text-muted font-mono font-bold mb-1">
                    {label}
                  </p>
                  {sorted.map((p, index) => {
                    const dataKey =
                      typeof p.dataKey === "string" ||
                      typeof p.dataKey === "number"
                        ? p.dataKey
                        : `entry-${index}`;
                    return (
                      <div
                        key={dataKey}
                        className="flex items-center justify-between gap-4"
                      >
                        <span
                          className="font-mono font-bold"
                          style={{ color: p.color }}
                        >
                          {String(dataKey)}
                        </span>
                        <span className="font-mono text-text-secondary">
                          {formatTime(p.value as number)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            }}
          />
          {displayDrivers.map((d) => {
            const isQ3 = q3Drivers.has(d.code);
            return (
              <Line
                key={d.code}
                type="linear"
                dataKey={d.code}
                stroke={d.teamColor}
                strokeWidth={isQ3 ? 2 : 1}
                strokeOpacity={highlightQ3Only ? (isQ3 ? 1 : 0.3) : 1}
                dot={{ r: isQ3 ? 3 : 2, fill: d.teamColor, strokeWidth: 0 }}
                connectNulls={false}
                isAnimationActive={false}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>

      {/* Mini legend for Q3 drivers */}
      <div className="flex flex-wrap gap-2">
        {drivers
          .filter((d) => d.Q3 != null)
          .map((d) => (
            <div key={d.code} className="flex items-center gap-1">
              <div
                className="w-5 h-0.5"
                style={{ backgroundColor: d.teamColor }}
              />
              <span
                className="text-[10px] font-mono font-bold"
                style={{ color: d.teamColor }}
              >
                {d.code}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}
