"use client";

import { useMemo } from "react";
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
import type { SessionResultsResponse } from "@/lib/types";
import { CHART_COLORS } from "./chart-primitives";

interface CrossSessionComparisonProps {
  fp1Data: SessionResultsResponse | null | undefined;
  fp2Data: SessionResultsResponse | null | undefined;
  fp3Data: SessionResultsResponse | null | undefined;
}

const SESSION_COLORS = {
  FP1: "var(--series-2)",
  FP2: "var(--series-1)",
  FP3: "var(--series-5)",
};

const SESSION_OPACITY = { FP1: 0.65, FP2: 0.8, FP3: 1.0 };

const formatTime = (s: number) => {
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem.toFixed(3).padStart(6, "0")}`;
};

type SessionKey = "FP1" | "FP2" | "FP3";

type ChartRow = {
  driver: string;
  teamColor: string;
  FP1?: number;
  FP2?: number;
  FP3?: number;
  fp1Delta?: number;
  fp2Delta?: number;
  fp3Delta?: number;
};

export default function CrossSessionComparison({
  fp1Data,
  fp2Data,
  fp3Data,
}: CrossSessionComparisonProps) {
  const { rows, sessions } = useMemo(() => {
    const sessionMap: Partial<Record<SessionKey, SessionResultsResponse>> = {
      ...(fp1Data ? { FP1: fp1Data } : {}),
      ...(fp2Data ? { FP2: fp2Data } : {}),
      ...(fp3Data ? { FP3: fp3Data } : {}),
    };

    const sessions = Object.keys(sessionMap) as SessionKey[];
    if (sessions.length < 2) return { rows: [], sessions };

    // Build a map of driver → best time per session
    const driverTimes: Record<
      string,
      { teamColor: string } & Partial<Record<SessionKey, number>>
    > = {};

    for (const [key, session] of Object.entries(sessionMap) as [
      SessionKey,
      SessionResultsResponse,
    ][]) {
      for (const result of session.results) {
        const code = result.driver.driver_code ?? result.driver.full_name;
        if (!driverTimes[code]) {
          driverTimes[code] = {
            teamColor: result.team.team_color
              ? `#${result.team.team_color}`
              : "var(--delta-neutral)",
          };
        }
        if (result.time_seconds != null) {
          driverTimes[code][key] = result.time_seconds;
        }
      }
    }

    // Only include drivers who have data in at least 2 sessions
    const rows: ChartRow[] = [];

    for (const [driver, info] of Object.entries(driverTimes)) {
      const sessionCounts = sessions.filter((s) => info[s] != null).length;
      if (sessionCounts < 2) continue;

      // Find baseline (FP1 or earliest available)
      const baseline = info.FP1 ?? info.FP2 ?? info.FP3 ?? 0;

      rows.push({
        driver,
        teamColor: info.teamColor,
        FP1: info.FP1,
        FP2: info.FP2,
        FP3: info.FP3,
        // Delta from FP1 (negative = improvement)
        fp1Delta: info.FP1 != null ? info.FP1 - baseline : undefined,
        fp2Delta: info.FP2 != null ? info.FP2 - baseline : undefined,
        fp3Delta: info.FP3 != null ? info.FP3 - baseline : undefined,
      });
    }

    // Sort by best time (FP3 > FP2 > FP1)
    rows.sort((a, b) => {
      const aT = a.FP3 ?? a.FP2 ?? a.FP1 ?? Infinity;
      const bT = b.FP3 ?? b.FP2 ?? b.FP1 ?? Infinity;
      return aT - bT;
    });

    // Take top 15
    return { rows: rows.slice(0, 15), sessions };
  }, [fp1Data, fp2Data, fp3Data]);

  if (sessions.length < 2) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-text-muted text-sm font-mono">
          Requires at least 2 practice sessions with data.
        </p>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-text-muted text-sm font-mono">
          No comparable driver data across sessions.
        </p>
      </div>
    );
  }

  const chartHeight = Math.max(rows.length * 38 + 60, 200);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-[10px] text-text-muted font-mono uppercase tracking-widest">
          Best lap time per session · sorted by fastest overall
        </p>
        <div className="flex items-center gap-4">
          {sessions.map((s) => (
            <div key={s} className="flex items-center gap-1.5">
              <div
                className="w-3 h-3 rounded-sm flex-shrink-0"
                style={{
                  backgroundColor: SESSION_COLORS[s],
                  opacity: SESSION_OPACITY[s],
                }}
              />
              <span className="text-[10px] font-mono text-text-muted uppercase">
                {s}
              </span>
            </div>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          data={rows}
          layout="vertical"
          margin={{ top: 4, right: 80, left: 40, bottom: 4 }}
          barGap={2}
          barCategoryGap="25%"
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={CHART_COLORS.borderPrimary}
            horizontal={false}
          />
          <XAxis
            type="number"
            dataKey="FP3"
            tick={{
              fill: CHART_COLORS.textTertiary,
              fontSize: 10,
              fontFamily: "monospace",
            }}
            tickFormatter={formatTime}
            domain={["dataMin - 0.5", "dataMax + 0.5"]}
          />
          <YAxis
            type="category"
            dataKey="driver"
            width={38}
            tick={{
              fill: CHART_COLORS.textTertiary,
              fontSize: 11,
              fontFamily: "monospace",
              fontWeight: "bold",
            }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={false}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const row = rows.find((r) => r.driver === label);
              if (!row) return null;
              return (
                <div className="bg-bg-tertiary border border-border-primary rounded-sm p-2 shadow-lg text-xs space-y-0.5">
                  <p className="font-bold text-text-primary font-mono mb-1">
                    {label}
                  </p>
                  {sessions.map(
                    (s) =>
                      row[s] != null && (
                        <div
                          key={s}
                          className="flex items-center justify-between gap-4"
                        >
                          <span
                            className="font-mono"
                            style={{ color: SESSION_COLORS[s] }}
                          >
                            {s}
                          </span>
                          <span className="font-mono text-text-secondary">
                            {formatTime(row[s] as number)}
                          </span>
                        </div>
                      ),
                  )}
                </div>
              );
            }}
          />
          {sessions.map((s) => (
            <Bar
              key={s}
              dataKey={s}
              fill={SESSION_COLORS[s]}
              fillOpacity={SESSION_OPACITY[s]}
              radius={[0, 3, 3, 0]}
              activeBar={false}
            >
              {rows.map((row) => (
                <Cell
                  key={`${s}-${row.driver}`}
                  fill={SESSION_COLORS[s]}
                  fillOpacity={row[s] != null ? SESSION_OPACITY[s] : 0.2}
                />
              ))}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
