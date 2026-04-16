"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  ErrorBar,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CHART_AXIS_LABEL_STYLE,
  CHART_COLORS,
  CHART_TYPOGRAPHY,
} from "@/components/chart-primitives";
import DriverMultiSelect from "@/components/charts/DriverMultiSelect";
import {
  sortDriversByClassification,
  useDriverSelection,
} from "@/hooks/useDriverSelection";
import { usePracticeLapTimes } from "@/hooks/usePracticeLapTimes";
import {
  COMPOUND_COLORS,
  formatLapTime,
  getCompoundColor,
} from "@/lib/chart-utils";
import { driverKey, type LapTimesResponse } from "@/lib/types";

const MIN_STINT_LAPS = 5;

interface LongRunPaceChartProps {
  season: number;
  round: number;
  practiceSession: 1 | 2 | 3;
  initialDrivers?: string[];
}

type StintRange = {
  driverIdx: number;
  driverCode: string;
  median: number;
  compound: string;
  min: number;
  max: number;
  lapCount: number;
  errorX: [number, number];
};

interface TooltipPayload {
  payload: StintRange;
}

const CustomTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
}) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="bg-bg-tertiary border border-border-primary rounded-sm p-2 shadow-lg text-xs space-y-1">
      <p className={CHART_TYPOGRAPHY.tooltipTitleClassName}>{d.driverCode}</p>
      <p
        className={CHART_TYPOGRAPHY.tooltipValueClassName}
        style={{ color: getCompoundColor(d.compound) }}
      >
        {d.compound}
      </p>
      <div className="border-t border-border-primary/50 pt-1 space-y-0.5">
        <p className={CHART_TYPOGRAPHY.tooltipValueClassName}>
          Median&nbsp;&nbsp;{formatLapTime(d.median)}
        </p>
        <p className="text-text-muted font-mono text-[10px]">
          Min&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{formatLapTime(d.min)}
        </p>
        <p className="text-text-muted font-mono text-[10px]">
          Max&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{formatLapTime(d.max)}
        </p>
        <p className="text-text-muted font-mono text-[10px]">
          {d.lapCount} laps
        </p>
      </div>
    </div>
  );
};

export default function LongRunPaceChart({
  season,
  round,
  practiceSession,
  initialDrivers,
}: LongRunPaceChartProps) {
  const { data, isLoading } = usePracticeLapTimes(
    season,
    round,
    practiceSession,
  );
  const { selectedDrivers, toggleDriver } = useDriverSelection(data?.drivers, {
    initialDrivers,
  });

  const { allDriverOrder, rangesByCompound, dropdownDrivers } = useMemo(() => {
    if (!data)
      return {
        allDriverOrder: [] as string[],
        rangesByCompound: {} as Record<string, StintRange[]>,
        dropdownDrivers: [] as LapTimesResponse["drivers"],
      };

    const driverCompoundTimes = new Map<string, Map<string, number[]>>();
    const driverMeta: {
      driverCode: string;
      median: number;
      finalPosition: number | null;
    }[] = [];

    for (const driver of data.drivers) {
      const code = driverKey(driver);

      const stints = new Map<number, typeof driver.laps>();
      for (const lap of driver.laps) {
        if (lap.stint == null) continue;
        if (!stints.has(lap.stint)) stints.set(lap.stint, []);
        stints.get(lap.stint)?.push(lap);
      }

      let hasLongRun = false;
      let bestMedian = Number.POSITIVE_INFINITY;

      for (const laps of stints.values()) {
        const valid = laps.filter(
          (l) =>
            l.lap_time_seconds != null && !l.deleted && l.track_status === "1",
        );
        if (valid.length < MIN_STINT_LAPS) continue;
        hasLongRun = true;

        const compound = laps[0].compound ?? "UNKNOWN";
        const times = valid.map((l) => l.lap_time_seconds as number);
        const sorted = [...times].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        if (median < bestMedian) bestMedian = median;

        if (!driverCompoundTimes.has(code))
          driverCompoundTimes.set(code, new Map());
        const compoundMap = driverCompoundTimes.get(code);
        if (!compoundMap) continue;
        const existing = compoundMap.get(compound) ?? [];
        compoundMap.set(compound, [...existing, ...times]);
      }

      if (hasLongRun) {
        driverMeta.push({
          driverCode: code,
          median: bestMedian,
          finalPosition: driver.final_position ?? null,
        });
      }
    }

    // Sort by session classification (final_position), fallback to median pace
    driverMeta.sort((a, b) => {
      const aPos = a.finalPosition ?? 999;
      const bPos = b.finalPosition ?? 999;
      if (aPos !== bPos) return aPos - bPos;
      return a.median - b.median;
    });

    const allDriverOrder = driverMeta.map((d) => d.driverCode);

    const rangesByCompound: Record<string, StintRange[]> = {};
    for (const [code, compoundMap] of driverCompoundTimes) {
      const idx = allDriverOrder.indexOf(code);
      if (idx === -1) continue;
      for (const [compound, times] of compoundMap) {
        const sorted = [...times].sort((a, b) => a - b);
        const n = sorted.length;
        const median = sorted[Math.floor(n / 2)];
        if (!rangesByCompound[compound]) rangesByCompound[compound] = [];
        rangesByCompound[compound].push({
          driverIdx: idx,
          driverCode: code,
          median,
          compound,
          min: sorted[0],
          max: sorted[n - 1],
          lapCount: n,
          errorX: [median - sorted[0], sorted[n - 1] - median],
        });
      }
    }

    // Dropdown: all drivers sorted by final_position
    const dropdownDrivers = sortDriversByClassification(data.drivers);

    return { allDriverOrder, rangesByCompound, dropdownDrivers };
  }, [data]);

  // Apply selection filter and re-index Y positions
  const { visibleDriverOrder, visibleRanges } = useMemo(() => {
    const visibleDriverOrder = allDriverOrder.filter((d) =>
      selectedDrivers.includes(d),
    );
    const visibleRanges: Record<string, StintRange[]> = {};
    for (const [compound, ranges] of Object.entries(rangesByCompound)) {
      const filtered = ranges
        .filter((r) => selectedDrivers.includes(r.driverCode))
        .map((r) => ({
          ...r,
          driverIdx: visibleDriverOrder.indexOf(r.driverCode),
        }))
        .filter((r) => r.driverIdx !== -1);
      if (filtered.length > 0) visibleRanges[compound] = filtered;
    }
    return { visibleDriverOrder, visibleRanges };
  }, [allDriverOrder, rangesByCompound, selectedDrivers]);

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

  if (!data || allDriverOrder.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-text-muted text-sm font-mono">
          No long run stints found (minimum {MIN_STINT_LAPS} consecutive laps on
          green flag).
        </p>
      </div>
    );
  }

  const allRanges = Object.values(visibleRanges).flat();
  const minTime = allRanges.length
    ? Math.min(...allRanges.map((r) => r.min))
    : 0;
  const maxTime = allRanges.length
    ? Math.max(...allRanges.map((r) => r.max))
    : 1;
  const pad = (maxTime - minTime) * 0.1;
  const chartHeight = Math.max(visibleDriverOrder.length * 36 + 70, 120);
  const activeCompounds = Object.keys(visibleRanges).filter(
    (c) => COMPOUND_COLORS[c],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-[10px] text-text-muted font-mono uppercase tracking-widest">
          Stints ≥{MIN_STINT_LAPS} laps · green flag only · line = range · dot =
          median
        </p>
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

          <DriverMultiSelect
            drivers={dropdownDrivers}
            selectedDrivers={selectedDrivers}
            onToggleDriver={toggleDriver}
            isDriverDisabled={(driver) =>
              !allDriverOrder.includes(driverKey(driver))
            }
          />
        </div>
      </div>

      {visibleDriverOrder.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-text-muted text-sm font-mono">
            No drivers selected.
          </p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={chartHeight}>
          <ScatterChart margin={{ top: 4, right: 16, left: 62, bottom: 20 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={CHART_COLORS.borderPrimary}
              horizontal={false}
            />
            <XAxis
              type="number"
              dataKey="median"
              domain={[minTime - pad, maxTime + pad]}
              tick={{
                fill: CHART_COLORS.textTertiary,
                fontSize: 10,
                fontFamily: "monospace",
              }}
              tickFormatter={formatLapTime}
              label={{
                value: "Lap Time",
                position: "insideBottomRight",
                offset: -4,
                style: CHART_AXIS_LABEL_STYLE,
              }}
            />
            <YAxis
              type="number"
              dataKey="driverIdx"
              domain={[-0.5, visibleDriverOrder.length - 0.5]}
              ticks={visibleDriverOrder.map((_, i) => i)}
              tickFormatter={(i: number) => visibleDriverOrder[i] ?? ""}
              tick={{
                fill: CHART_COLORS.textTertiary,
                fontSize: 11,
                fontFamily: "monospace",
                fontWeight: "bold",
              }}
              width={60}
              reversed
              axisLine={false}
              tickLine={false}
            />
            <Tooltip cursor={false} content={<CustomTooltip />} />
            {Object.entries(visibleRanges).map(([compound, ranges]) => {
              const color = getCompoundColor(compound);
              return (
                <Scatter key={compound} data={ranges} fill={color} r={5}>
                  <ErrorBar
                    dataKey="errorX"
                    direction="x"
                    strokeWidth={2}
                    stroke={color}
                    width={4}
                  />
                </Scatter>
              );
            })}
          </ScatterChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
