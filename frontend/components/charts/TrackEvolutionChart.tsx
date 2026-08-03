"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import MobileChartFrame from "@/components/ui/MobileChartFrame";
import {
  sortDriversByClassification,
  useDriverSelection,
} from "@/hooks/useDriverSelection";
import { usePracticeLapTimes } from "@/hooks/usePracticeLapTimes";
import { COMPOUND_COLORS, formatLapTime } from "@/lib/chart-utils";
import { type DriverLapTimes, driverKey } from "@/lib/types";
import {
  CHART_AXIS_LABEL_STYLE,
  CHART_COLORS,
  CHART_TYPOGRAPHY,
} from "./chart-primitives";
import DriverMultiSelect from "./DriverMultiSelect";

interface TrackEvolutionChartProps {
  season: number;
  round: number;
  practiceSession: 1 | 2 | 3;
  initialDrivers?: string[];
}

/** Format session elapsed time as MM:SS for X-axis */
const formatSessionTime = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

const TREND_WINDOW = 7;

export default function TrackEvolutionChart({
  season,
  round,
  practiceSession,
  initialDrivers,
}: TrackEvolutionChartProps) {
  const { data, isLoading } = usePracticeLapTimes(
    season,
    round,
    practiceSession,
  );
  const { selectedDrivers, toggleDriver } = useDriverSelection(data?.drivers, {
    initialDrivers,
  });

  const {
    lapsByCompound,
    movingAvgPoints,
    activeCompounds,
    improvement,
    minSessionTime,
    maxSessionTime,
    minTime,
    maxTime,
    dropdownDrivers,
  } = useMemo(() => {
    const empty = {
      lapsByCompound: {} as Record<string, { x: number; y: number }[]>,
      movingAvgPoints: [] as { x: number; y: number }[],
      activeCompounds: [] as string[],
      improvement: 0,
      minSessionTime: 0,
      maxSessionTime: 1,
      minTime: 0,
      maxTime: 1,
      dropdownDrivers: [] as DriverLapTimes[],
    };
    if (!data) return empty;

    const hasTrackStatus = data.drivers.some((d) =>
      d.laps.some((l) => l.track_status != null),
    );
    const repLaps: { x: number; y: number; compound: string }[] = [];
    let sessionMin = Number.POSITIVE_INFINITY;

    for (const driver of data.drivers) {
      if (!selectedDrivers.includes(driverKey(driver))) continue;

      const stintFirstLap: Record<number, number> = {};
      for (const lap of driver.laps) {
        if (lap.stint == null) continue;
        if (
          !(lap.stint in stintFirstLap) ||
          lap.lap_number < stintFirstLap[lap.stint]
        ) {
          stintFirstLap[lap.stint] = lap.lap_number;
        }
      }
      const outlaps = new Set(Object.values(stintFirstLap));

      for (const lap of driver.laps) {
        if (
          lap.deleted ||
          lap.lap_time_seconds == null ||
          lap.lap_start_time_seconds == null
        )
          continue;
        if (hasTrackStatus && lap.track_status !== "1") continue;
        if (outlaps.has(lap.lap_number)) continue;
        if (lap.lap_time_seconds < sessionMin)
          sessionMin = lap.lap_time_seconds;
        // X = session time when lap was completed
        repLaps.push({
          x: lap.lap_start_time_seconds + lap.lap_time_seconds,
          y: lap.lap_time_seconds,
          compound: lap.compound ?? "UNKNOWN",
        });
      }
    }

    if (repLaps.length === 0)
      return { ...empty, dropdownDrivers: [...data.drivers] };

    const threshold = sessionMin * 1.07;
    const filtered = repLaps.filter((l) => l.y <= threshold);
    if (filtered.length === 0)
      return { ...empty, dropdownDrivers: [...data.drivers] };

    const lapsByCompound: Record<string, { x: number; y: number }[]> = {};
    for (const lap of filtered) {
      if (!lapsByCompound[lap.compound]) lapsByCompound[lap.compound] = [];
      lapsByCompound[lap.compound].push({ x: lap.x, y: lap.y });
    }
    const activeCompounds = Object.keys(lapsByCompound).filter(
      (c) => COMPOUND_COLORS[c],
    );

    // Per-time-bucket median (round to nearest 60s bucket to avoid zigzag)
    const BUCKET = 30; // 30-second buckets
    const lapGroups = new Map<number, number[]>();
    for (const lap of filtered) {
      const bucket = Math.round(lap.x / BUCKET) * BUCKET;
      if (!lapGroups.has(bucket)) lapGroups.set(bucket, []);
      lapGroups.get(bucket)?.push(lap.y);
    }
    const lapAvgsSorted = Array.from(lapGroups.entries())
      .sort(([a], [b]) => a - b)
      .map(([x, times]) => {
        const s = [...times].sort((a, b) => a - b);
        return { x, y: s[Math.floor(s.length / 2)] };
      });

    const movingAvgPoints = lapAvgsSorted.map((_, idx) => {
      const start = Math.max(0, idx - Math.floor(TREND_WINDOW / 2));
      const end = Math.min(
        lapAvgsSorted.length,
        idx + Math.ceil(TREND_WINDOW / 2),
      );
      const slice = lapAvgsSorted.slice(start, end);
      const avg = slice.reduce((s, p) => s + p.y, 0) / slice.length;
      return { x: lapAvgsSorted[idx].x, y: avg };
    });

    const q = Math.max(3, Math.ceil(lapAvgsSorted.length * 0.2));
    const earlyAvg = lapAvgsSorted.slice(0, q).reduce((s, p) => s + p.y, 0) / q;
    const lateAvg = lapAvgsSorted.slice(-q).reduce((s, p) => s + p.y, 0) / q;
    const improvement = earlyAvg - lateAvg;

    const allX = filtered.map((l) => l.x);
    const allTimes = filtered.map((l) => l.y);

    const dropdownDrivers = sortDriversByClassification(data.drivers);

    return {
      lapsByCompound,
      movingAvgPoints,
      activeCompounds,
      improvement,
      minSessionTime: Math.min(...allX),
      maxSessionTime: Math.max(...allX),
      minTime: Math.min(...allTimes),
      maxTime: Math.max(...allTimes),
      dropdownDrivers,
    };
  }, [data, selectedDrivers]);

  if (season < 2018) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-text-muted text-sm font-mono">
          Telemetry data available from 2018 onwards.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="h-5 bg-bg-elevated rounded w-56 animate-pulse" />
        <div className="h-64 bg-bg-elevated rounded animate-pulse" />
      </div>
    );
  }

  if (!data || movingAvgPoints.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-text-muted text-sm font-mono">
          No lap timing data available (session time data required for 2018+).
        </p>
      </div>
    );
  }

  const pad = (maxTime - minTime) * 0.08;
  const absImprovement = Math.abs(improvement);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <p className="text-[10px] text-text-muted font-mono uppercase tracking-widest">
            Track improvement
          </p>
          {absImprovement >= 0.05 ? (
            <span
              className={`text-sm font-bold font-mono ${improvement > 0 ? "text-green-400" : "text-red-400"}`}
            >
              {improvement > 0 ? "+" : ""}
              {improvement.toFixed(3)}s
            </span>
          ) : (
            <span className="text-sm font-bold font-mono text-text-muted">
              Steady
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {activeCompounds.map((c) => (
            <div key={c} className="flex items-center gap-1.5">
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: COMPOUND_COLORS[c] }}
              />
              <span className={CHART_TYPOGRAPHY.keyClassName}>{c}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-0.5 flex-shrink-0 bg-white/80 rounded-full" />
            <span className={CHART_TYPOGRAPHY.keyClassName}>Trend</span>
          </div>

          <DriverMultiSelect
            drivers={dropdownDrivers}
            selectedDrivers={selectedDrivers}
            onToggleDriver={toggleDriver}
          />
        </div>
      </div>

      <MobileChartFrame height={280} logicalWidth={820}>
        <ResponsiveContainer width="100%" height={280}>
          <ScatterChart margin={{ top: 4, right: 16, left: 16, bottom: 20 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={CHART_COLORS.borderPrimary}
            />
            <XAxis
              type="number"
              dataKey="x"
              domain={[minSessionTime, maxSessionTime]}
              tick={{ fill: CHART_COLORS.textTertiary, fontSize: 10 }}
              tickFormatter={formatSessionTime}
              label={{
                value: "Session Time",
                position: "insideBottomRight",
                offset: -4,
                style: CHART_AXIS_LABEL_STYLE,
              }}
            />
            <YAxis
              type="number"
              dataKey="y"
              domain={[minTime - pad, maxTime + pad]}
              tick={{
                fill: CHART_COLORS.textTertiary,
                fontSize: 10,
                fontFamily: "monospace",
              }}
              tickFormatter={formatLapTime}
              width={72}
            />
            <Tooltip
              cursor={false}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0]?.payload as { x: number; y: number };
                if (!p?.y) return null;
                return (
                  <div className="bg-bg-tertiary border border-border-primary rounded-sm p-2 shadow-lg text-xs">
                    <p
                      className={`${CHART_TYPOGRAPHY.tooltipTitleClassName} mb-0.5`}
                    >
                      {formatSessionTime(p.x)}
                    </p>
                    <p className={CHART_TYPOGRAPHY.tooltipValueClassName}>
                      {formatLapTime(p.y)}
                    </p>
                  </div>
                );
              }}
            />
            {activeCompounds.map((c) => (
              <Scatter
                key={c}
                name={c}
                data={lapsByCompound[c]}
                fill={COMPOUND_COLORS[c]}
                fillOpacity={0.35}
                r={2.5}
                isAnimationActive={false}
              />
            ))}
            <Scatter
              data={movingAvgPoints}
              fill="transparent"
              shape={(props: { cx?: number; cy?: number }) => (
                <circle
                  r={0}
                  cx={props.cx ?? 0}
                  cy={props.cy ?? 0}
                  fill="none"
                />
              )}
              line={{ stroke: "rgba(255,255,255,0.85)", strokeWidth: 2.5 }}
              lineType="joint"
              isAnimationActive={false}
              legendType="none"
              name="trend"
            />
          </ScatterChart>
        </ResponsiveContainer>
      </MobileChartFrame>
    </div>
  );
}
