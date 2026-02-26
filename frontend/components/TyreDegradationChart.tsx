"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
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
import type { LapTimesResponse } from "@/lib/types";

interface TyreDegradationChartProps {
  season: number;
  round: number;
  isSprint?: boolean;
}

const COMPOUND_COLORS: Record<string, string> = {
  SOFT: "#ef4444",
  MEDIUM: "#eab308",
  HARD: "#e5e7eb",
  INTERMEDIATE: "#22c55e",
  WET: "#3b82f6",
};

// Format seconds to MM:SS.mmm
const formatLapTime = (seconds: number | null): string => {
  if (seconds === null) return "-";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toFixed(3).padStart(6, "0")}`;
};

interface AxisTickProps {
  x?: number;
  y?: number;
  payload?: { value: number };
}
const CustomYAxisTick = (props: AxisTickProps) => {
  const { x, y, payload } = props;
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dx={-5}
        textAnchor="end"
        fill={CHART_COLORS.textTertiary}
        fontSize={11}
      >
        {formatLapTime(payload?.value ?? null)}
      </text>
    </g>
  );
};

interface DegradationTooltipEntry {
  dataKey: string;
  value: number;
  color: string;
  name: string;
}
interface DegradationTooltipProps {
  active?: boolean;
  payload?: DegradationTooltipEntry[];
  label?: string | number;
}
const DegradationTooltip = ({
  active,
  payload,
  label,
}: DegradationTooltipProps) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-bg-tertiary border border-border-primary rounded-lg p-3 shadow-xl">
      <p className="font-bold text-text-primary mb-1 text-sm">
        Tyre Age: {label} {label === 1 ? "lap" : "laps"}
      </p>
      {payload.map((entry: DegradationTooltipEntry) => (
        <div key={entry.dataKey} className="flex items-center gap-2 text-xs">
          <div
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-text-secondary">{entry.name}</span>
          <span className="font-mono text-text-primary ml-auto">
            {formatLapTime(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
};

type CompoundDataPoint = {
  tyre_life: number;
  [key: string]: number | null | undefined;
};

export default function TyreDegradationChart({
  season,
  round,
  isSprint = false,
}: TyreDegradationChartProps) {
  const [selectedCompounds, setSelectedCompounds] = useState<string[]>([]);
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>([]);
  const [showDriverDropdown, setShowDriverDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setShowDriverDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const { data, isLoading: loading } = useQuery<LapTimesResponse | null>({
    queryKey: ["tyre-degradation", season, round, isSprint],
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

  // Auto-select top 3 drivers when data loads
  useEffect(() => {
    if (data?.drivers) {
      const sorted = [...data.drivers].sort(
        (a, b) => (a.final_position || 999) - (b.final_position || 999),
      );
      setSelectedDrivers(sorted.slice(0, 3).map((d) => d.driver_code));
    }
  }, [data]);

  // Auto-select all available compounds when data loads
  useEffect(() => {
    if (data?.drivers) {
      const compounds = new Set<string>();
      for (const driver of data.drivers) {
        for (const lap of driver.laps) {
          if (lap.compound) compounds.add(lap.compound);
        }
      }
      setSelectedCompounds(Array.from(compounds));
    }
  }, [data]);

  // Available compounds
  const availableCompounds = useMemo(() => {
    if (!data) return [];
    const compounds = new Set<string>();
    for (const driver of data.drivers) {
      for (const lap of driver.laps) {
        if (lap.compound) compounds.add(lap.compound);
      }
    }
    return Array.from(compounds);
  }, [data]);

  // Build chart data: group laps by compound + tyre_life
  const chartData = useMemo(() => {
    if (!data)
      return { data: [] as CompoundDataPoint[], lineKeys: [] as string[] };

    const filteredDrivers = data.drivers.filter((d) =>
      selectedDrivers.includes(d.driver_code),
    );

    // Map: compound -> tyre_life -> driver_code -> lap_times[]
    const compoundMap = new Map<string, Map<number, Map<string, number[]>>>();

    for (const driver of filteredDrivers) {
      for (const lap of driver.laps) {
        if (
          !lap.compound ||
          !selectedCompounds.includes(lap.compound) ||
          lap.tyre_life == null ||
          lap.lap_time_seconds == null ||
          lap.pit_duration_seconds != null
        ) {
          continue;
        }

        // Normalize pit laps out
        const normalizedTime = lap.lap_time_seconds;

        if (!compoundMap.has(lap.compound)) {
          compoundMap.set(lap.compound, new Map());
        }
        const tyreMap = compoundMap.get(lap.compound) ?? new Map();
        if (!tyreMap.has(lap.tyre_life)) {
          tyreMap.set(lap.tyre_life, new Map());
        }
        const driverMap = tyreMap.get(lap.tyre_life) ?? new Map();
        if (!driverMap.has(driver.driver_code)) {
          driverMap.set(driver.driver_code, []);
        }
        driverMap.get(driver.driver_code)?.push(normalizedTime);
      }
    }

    // Build data points grouped by tyre_life
    // One line per compound, showing average lap time across selected drivers
    const allTyreLives = new Set<number>();
    const lineKeys: string[] = [];

    for (const [compound] of compoundMap) {
      lineKeys.push(compound);
      const tyreMap = compoundMap.get(compound) ?? new Map();
      for (const life of tyreMap.keys()) {
        allTyreLives.add(life);
      }
    }

    const sortedLives = Array.from(allTyreLives).sort((a, b) => a - b);

    const points: CompoundDataPoint[] = sortedLives.map((life) => {
      const point: CompoundDataPoint = { tyre_life: life };

      for (const compound of lineKeys) {
        const tyreMap = compoundMap.get(compound);
        const driverMap = tyreMap?.get(life);

        if (driverMap && driverMap.size > 0) {
          // Average across all drivers for this compound+life
          let sum = 0;
          let count = 0;
          for (const times of driverMap.values()) {
            for (const t of times) {
              sum += t;
              count++;
            }
          }
          point[compound] = sum / count;
        }
      }

      return point;
    });

    return { data: points, lineKeys };
  }, [data, selectedDrivers, selectedCompounds]);

  // Y-axis domain
  const yDomain = useMemo((): [number, number] => {
    if (chartData.data.length === 0) return [120, 80];

    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;

    for (const point of chartData.data) {
      for (const key of chartData.lineKeys) {
        const val = point[key];
        if (val != null && typeof val === "number") {
          min = Math.min(min, val);
          max = Math.max(max, val);
        }
      }
    }

    const padding = (max - min) * 0.1;
    return [max + padding, min - padding];
  }, [chartData]);

  const sortedDrivers = useMemo(() => {
    if (!data) return [];
    return [...data.drivers].sort(
      (a, b) => (a.final_position || 999) - (b.final_position || 999),
    );
  }, [data]);

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-6 bg-bg-elevated rounded w-56 animate-pulse" />
        <div className="h-64 bg-bg-elevated rounded animate-pulse" />
      </div>
    );
  }

  if (!data || data.drivers.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-text-muted text-sm">
          {season < 2018
            ? "Tyre data is only available from 2018 onwards."
            : "No tyre degradation data available for this session."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-bold text-text-secondary font-mono">
          {data.event_name.replace("Grand Prix", "GP")} - Tyre Degradation
        </h3>

        <div className="flex items-center gap-2">
          {/* Compound Filter */}
          <div className="flex items-center gap-1">
            {availableCompounds.map((compound) => (
              <button
                key={compound}
                type="button"
                onClick={() =>
                  setSelectedCompounds((prev) =>
                    prev.includes(compound)
                      ? prev.filter((c) => c !== compound)
                      : [...prev, compound],
                  )
                }
                className={`px-2 py-1 rounded-sm text-[10px] font-bold font-mono uppercase tracking-widest transition-colors border ${
                  selectedCompounds.includes(compound)
                    ? "border-current opacity-100"
                    : "border-transparent opacity-40"
                }`}
                style={{
                  color: COMPOUND_COLORS[compound] || "#999",
                }}
              >
                {compound}
              </button>
            ))}
          </div>

          {/* Driver dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setShowDriverDropdown(!showDriverDropdown)}
              className="px-3 py-1.5 rounded-sm text-xs font-bold font-mono uppercase tracking-widest border border-border-secondary text-text-secondary hover:border-purple-500 hover:text-purple-300 transition-colors"
            >
              Drivers ({selectedDrivers.length})
            </button>
            {showDriverDropdown && (
              <div className="absolute right-0 top-full mt-1 bg-bg-tertiary border border-border-primary rounded-sm shadow-xl z-10 min-w-[220px] max-h-[260px] overflow-y-auto">
                {sortedDrivers.map((driver) => (
                  <label
                    key={driver.driver_code}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-bg-elevated cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedDrivers.includes(driver.driver_code)}
                      onChange={() =>
                        setSelectedDrivers((prev) =>
                          prev.includes(driver.driver_code)
                            ? prev.filter((d) => d !== driver.driver_code)
                            : [...prev, driver.driver_code],
                        )
                      }
                      className="w-3.5 h-3.5 accent-purple-500"
                    />
                    <span className="text-xs text-text-muted w-4 font-mono">
                      {driver.final_position || "-"}
                    </span>
                    <span
                      className="text-sm font-semibold"
                      style={{
                        color: driver.team_color
                          ? `#${driver.team_color}`
                          : "#999",
                      }}
                    >
                      {driver.full_name}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="relative" style={{ minHeight: "300px" }}>
        {chartData.data.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart
              data={chartData.data}
              margin={{ top: 10, right: 20, left: 60, bottom: 30 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={CHART_COLORS.borderPrimary}
              />
              <XAxis
                dataKey="tyre_life"
                stroke={CHART_COLORS.textTertiary}
                label={{
                  value: "Tyre Age (laps)",
                  position: "insideBottom",
                  offset: -20,
                  style: { fontWeight: "bold", fill: "white", fontSize: 12 },
                }}
                tick={{ fill: CHART_COLORS.textTertiary, fontSize: 11 }}
              />
              <YAxis
                stroke={CHART_COLORS.textTertiary}
                label={{
                  value: "Lap Time",
                  angle: -90,
                  position: "center",
                  dx: -45,
                  style: { fontWeight: "bold", fill: "white", fontSize: 12 },
                }}
                tick={<CustomYAxisTick />}
                domain={yDomain}
                reversed={true}
              />
              <Tooltip content={<DegradationTooltip />} />
              {chartData.lineKeys.map((compound) => (
                <Line
                  key={compound}
                  type="monotone"
                  dataKey={compound}
                  name={compound}
                  stroke={COMPOUND_COLORS[compound] || "#999"}
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: COMPOUND_COLORS[compound] || "#999" }}
                  activeDot={{ r: 5 }}
                  connectNulls={false}
                  isAnimationActive={true}
                  animationDuration={1200}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-text-muted text-sm font-mono">
              Select compounds and drivers to view degradation curves.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
