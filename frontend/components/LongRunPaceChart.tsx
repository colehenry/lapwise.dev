"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { CHART_COLORS } from "@/components/chart-primitives";
import { apiHeaders, apiUrl } from "@/lib/api";
import {
  type DriverLapTimes,
  driverKey,
  type LapTimesResponse,
} from "@/lib/types";

const COMPOUND_COLORS: Record<string, string> = {
  SOFT: "#e8002d",
  MEDIUM: "#ffd700",
  HARD: "#c8c8c8",
  INTERMEDIATE: "#39b54a",
  WET: "#0067ff",
};

const getCompoundColor = (c: string | null | undefined) =>
  COMPOUND_COLORS[c ?? ""] ?? "#888888";

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

const formatTime = (s: number) => {
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem.toFixed(3).padStart(6, "0")}`;
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
      <p className="font-bold text-text-primary font-mono">{d.driverCode}</p>
      <p className="font-mono" style={{ color: getCompoundColor(d.compound) }}>
        {d.compound}
      </p>
      <div className="border-t border-border-primary/50 pt-1 space-y-0.5">
        <p className="text-text-secondary font-mono">
          Median&nbsp;&nbsp;{formatTime(d.median)}
        </p>
        <p className="text-text-muted font-mono text-[10px]">
          Min&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{formatTime(d.min)}
        </p>
        <p className="text-text-muted font-mono text-[10px]">
          Max&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{formatTime(d.max)}
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
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const initialDriverKey = initialDrivers?.join(",") ?? "";

  const { data, isLoading } = useQuery<LapTimesResponse | null>({
    queryKey: ["lap-times", season, round, false, practiceSession],
    queryFn: async () => {
      const res = await fetch(
        apiUrl(
          `/api/results/${season}/${round}/practice/${practiceSession}/lap-times`,
        ),
        { cache: "no-store", headers: apiHeaders() },
      );
      if (!res.ok) return null;
      return res.json();
    },
    enabled: season >= 2018,
  });

  // Default to top 10 by session classification on data load
  useEffect(() => {
    if (data?.drivers) {
      const sorted = [...data.drivers].sort(
        (a, b) => (a.final_position ?? 999) - (b.final_position ?? 999),
      );
      const available = new Set(sorted.map((d) => driverKey(d)));
      const requested = initialDriverKey
        .split(",")
        .filter((key) => available.has(key));
      setSelectedDrivers(
        requested.length > 0
          ? requested
          : sorted.slice(0, 10).map((d) => driverKey(d)),
      );
    }
  }, [data, initialDriverKey]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggleDriver = (key: string) => {
    setSelectedDrivers((prev) =>
      prev.includes(key) ? prev.filter((d) => d !== key) : [...prev, key],
    );
  };

  const { allDriverOrder, rangesByCompound, dropdownDrivers } = useMemo(() => {
    if (!data)
      return {
        allDriverOrder: [] as string[],
        rangesByCompound: {} as Record<string, StintRange[]>,
        dropdownDrivers: [] as DriverLapTimes[],
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
    const dropdownDrivers = [...data.drivers].sort(
      (a, b) => (a.final_position ?? 999) - (b.final_position ?? 999),
    );

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
              <span className="text-[10px] font-mono text-text-muted uppercase">
                {c}
              </span>
            </div>
          ))}

          {/* Driver selector */}
          <div className="relative flex-shrink-0" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setShowDropdown((v) => !v)}
              className="px-3 py-1.5 rounded-sm text-xs font-bold font-mono uppercase tracking-widest border border-border-primary text-text-secondary hover:border-purple-500 hover:text-purple-300 transition-colors"
            >
              Drivers ({selectedDrivers.length})
            </button>
            {showDropdown && (
              <div className="absolute right-0 top-full mt-1 bg-bg-tertiary border border-border-primary rounded-sm shadow-xl z-10 min-w-[220px] max-h-[280px] overflow-y-auto">
                {dropdownDrivers.map((driver) => {
                  const key = driverKey(driver);
                  const isSelected = selectedDrivers.includes(key);
                  const hasStint = allDriverOrder.includes(key);
                  const color = driver.team_color
                    ? `#${driver.team_color}`
                    : "#666";
                  return (
                    <label
                      key={key}
                      className={`flex items-center gap-2 px-3 py-2 hover:bg-bg-elevated cursor-pointer ${!hasStint ? "opacity-40" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={!hasStint}
                        onChange={() => hasStint && toggleDriver(key)}
                        className="w-4 h-4 accent-purple-500"
                      />
                      <span className="text-[10px] font-mono text-text-muted w-5">
                        {driver.final_position ?? "-"}
                      </span>
                      <span
                        className="text-xs font-bold font-mono"
                        style={{ color }}
                      >
                        {driver.driver_code ?? driver.full_name}
                      </span>
                      {!hasStint && (
                        <span className="text-[9px] font-mono text-text-muted ml-auto">
                          no data
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            )}
          </div>
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
              tickFormatter={formatTime}
              label={{
                value: "Lap Time",
                position: "insideBottomRight",
                offset: -4,
                style: { fill: CHART_COLORS.textTertiary, fontSize: 10 },
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
