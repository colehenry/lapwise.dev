"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHART_COLORS, CustomDot } from "@/components/chart-primitives";
import { apiHeaders, apiUrl } from "@/lib/api";
import type {
  DriverLapTimes,
  LapData,
  LapTimesResponse,
  TrackStatusEvent,
} from "@/lib/types";

type ChartDataPoint = {
  lap_number: number;
  [key: string]: number | string | null | undefined | LapData;
};

type ViewMode = "lapTime" | "gapToLeader" | "position";

// Track status band type for SC/VSC/Red Flag visualization
type StatusBand = {
  startLap: number;
  endLap: number;
  status: string; // "4"=SC, "5"=Red, "6"=VSC
};

interface LapTimeByLapGraphProps {
  season: number;
  round: number;
  isSprint?: boolean;
}

// Compound colors for tyre-colored styling
const COMPOUND_COLORS: Record<string, string> = {
  SOFT: "#ef4444",
  MEDIUM: "#eab308",
  HARD: "#e5e7eb",
  INTERMEDIATE: "#22c55e",
  WET: "#3b82f6",
};

// Track status band colors
const STATUS_BAND_COLORS: Record<string, { fill: string; label: string }> = {
  "4": { fill: "rgba(234, 179, 8, 0.12)", label: "SC" },
  "5": { fill: "rgba(239, 68, 68, 0.15)", label: "Red Flag" },
  "6": { fill: "rgba(249, 115, 22, 0.10)", label: "VSC" },
};

// Helper to format seconds to MM:SS.mmm
const formatLapTime = (seconds: number | null): string => {
  if (seconds === null) return "-";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toFixed(3).padStart(6, "0")}`;
};

// Custom Y-axis Tick Component - formats seconds to MM:SS.mmm
const CustomYAxisTick = (props: any) => {
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
        {formatLapTime(payload.value)}
      </text>
    </g>
  );
};

// Custom Y-axis tick for position mode (P1, P2, etc.)
const PositionYAxisTick = (props: any) => {
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
        P{payload.value}
      </text>
    </g>
  );
};

// Gap mode Y-axis tick
const GapYAxisTick = (props: any) => {
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
        {payload.value === 0 ? "Leader" : `+${payload.value.toFixed(1)}s`}
      </text>
    </g>
  );
};

// Custom X-axis Tick Component
const CustomXAxisTick = (props: any) => {
  const { x, y, payload } = props;
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={16}
        textAnchor="middle"
        fill={CHART_COLORS.textTertiary}
        fontSize={12}
      >
        {payload.value}
      </text>
    </g>
  );
};

// Pit stop dot marker
const PitStopDot = (props: any) => {
  const { cx, cy } = props;
  if (cx === undefined || cy === undefined) return null;
  return (
    <g>
      <circle
        cx={cx}
        cy={cy}
        r={6}
        fill="none"
        stroke="#f97316"
        strokeWidth={2}
      />
      <text
        x={cx}
        y={cy - 10}
        textAnchor="middle"
        fill="#f97316"
        fontSize={9}
        fontWeight="bold"
      >
        PIT
      </text>
    </g>
  );
};

// Custom Tooltip Component
const CustomTooltip = ({ active, payload, label, viewMode }: any) => {
  if (!active || !payload || !payload.length) return null;

  // In position mode, deduplicate entries per driver (multiple stints share same dataKey pattern)
  const seenDrivers = new Set<string>();
  const uniqueEntries = payload.filter((entry: any) => {
    // Extract driver code from dataKey (format: "VER" or "VER_stint_1")
    const driverCode = entry.dataKey.includes("_stint_")
      ? entry.dataKey.split("_stint_")[0]
      : entry.dataKey;
    if (seenDrivers.has(driverCode)) return false;
    seenDrivers.add(driverCode);
    return true;
  });

  return (
    <div className="bg-bg-tertiary border border-border-primary rounded-lg p-3 shadow-xl max-w-xs">
      <p className="font-bold text-text-primary mb-2">Lap {label}</p>
      {uniqueEntries.map((entry: any) => {
        const driverCode = entry.dataKey.includes("_stint_")
          ? entry.dataKey.split("_stint_")[0]
          : entry.dataKey;
        const lapData = entry.payload[`_data_${driverCode}`] as
          | LapData
          | undefined;

        return (
          <div key={driverCode} className="mb-2">
            <div className="flex items-center gap-2 mb-1">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="font-bold text-text-primary text-sm">
                {entry.name?.includes("(")
                  ? entry.name.split(" (")[0]
                  : entry.name}
              </span>
            </div>
            <div className="ml-5 text-xs text-text-secondary space-y-0.5">
              {viewMode === "position" && entry.value != null && (
                <div>
                  <span className="text-text-muted">Position:</span>{" "}
                  <span className="font-mono text-text-primary font-semibold">
                    P{entry.value}
                  </span>
                </div>
              )}
              {viewMode !== "position" && (
                <div>
                  <span className="text-text-muted">
                    {viewMode === "gapToLeader" ? "Gap:" : "Time:"}
                  </span>{" "}
                  <span className="font-mono text-text-primary">
                    {viewMode === "gapToLeader" && entry.value === 0
                      ? "Leader"
                      : viewMode === "gapToLeader"
                        ? `+${entry.value.toFixed(3)}s`
                        : formatLapTime(entry.value)}
                  </span>
                </div>
              )}
              {lapData?.compound && (
                <div>
                  <span className="text-text-muted">Tyre:</span>{" "}
                  <span
                    style={{
                      color: COMPOUND_COLORS[lapData.compound] || "#999",
                    }}
                    className="font-semibold"
                  >
                    {lapData.compound}
                    {lapData.tyre_life != null &&
                      ` (${lapData.tyre_life} laps)`}
                  </span>
                </div>
              )}
              {lapData?.pit_duration_seconds != null && (
                <div>
                  <span className="text-text-muted">Pit stop:</span>{" "}
                  <span className="font-mono text-orange-400">
                    {lapData.pit_duration_seconds.toFixed(1)}s
                  </span>
                </div>
              )}
              {lapData?.sector1_time_seconds != null && (
                <div className="flex gap-2">
                  <span className="text-text-muted">S1</span>
                  <span className="font-mono text-text-primary">
                    {lapData.sector1_time_seconds.toFixed(3)}
                  </span>
                  <span className="text-text-muted">S2</span>
                  <span className="font-mono text-text-primary">
                    {lapData.sector2_time_seconds?.toFixed(3) ?? "-"}
                  </span>
                  <span className="text-text-muted">S3</span>
                  <span className="font-mono text-text-primary">
                    {lapData.sector3_time_seconds?.toFixed(3) ?? "-"}
                  </span>
                </div>
              )}
              {lapData?.position != null && viewMode !== "position" && (
                <div>
                  <span className="text-text-muted">Pos:</span>{" "}
                  <span className="text-text-primary">P{lapData.position}</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// Convert track status events to lap-number-based bands
function computeStatusBands(
  trackStatusEvents: TrackStatusEvent[],
  drivers: DriverLapTimes[],
  totalLaps: number | null,
): StatusBand[] {
  if (!trackStatusEvents.length || !drivers.length) return [];

  // Build a map of session_time -> lap_number using the race leader's data
  // Sort drivers by position, take first one with laps
  const sortedDrivers = [...drivers].sort(
    (a, b) => (a.final_position || 999) - (b.final_position || 999),
  );
  const leader = sortedDrivers.find((d) => d.laps.length > 0);
  if (!leader) return [];

  // Build sorted lap start times for the leader
  const lapStartTimes = leader.laps
    .filter((l) => l.lap_time_seconds != null)
    .sort((a, b) => a.lap_number - b.lap_number);

  // Convert session time to approximate lap number
  const sessionTimeToLap = (sessionTime: number): number => {
    // Estimate based on cumulative lap times
    let cumulative = 0;
    for (const lap of lapStartTimes) {
      cumulative += lap.lap_time_seconds ?? 0;
      if (cumulative >= sessionTime) return lap.lap_number;
    }
    return lapStartTimes.length > 0
      ? lapStartTimes[lapStartTimes.length - 1].lap_number
      : 1;
  };

  // Find SC/VSC/Red flag periods
  const bands: StatusBand[] = [];
  let currentBand: { startTime: number; status: string } | null = null;

  for (const event of trackStatusEvents) {
    const isNeutralizing = ["4", "5", "6"].includes(event.status);
    const isClearing = ["1", "7"].includes(event.status);

    if (isNeutralizing && !currentBand) {
      currentBand = {
        startTime: event.session_time_seconds,
        status: event.status,
      };
    } else if (isClearing && currentBand) {
      const startLap = sessionTimeToLap(currentBand.startTime);
      const endLap = sessionTimeToLap(event.session_time_seconds);
      if (endLap >= startLap) {
        bands.push({
          startLap: Math.max(1, startLap - 0.5),
          endLap: endLap + 0.5,
          status: currentBand.status,
        });
      }
      currentBand = null;
    } else if (isNeutralizing && currentBand) {
      // Status changed type (e.g. VSC -> SC), close current and start new
      const startLap = sessionTimeToLap(currentBand.startTime);
      const endLap = sessionTimeToLap(event.session_time_seconds);
      if (endLap >= startLap) {
        bands.push({
          startLap: Math.max(1, startLap - 0.5),
          endLap: endLap + 0.5,
          status: currentBand.status,
        });
      }
      currentBand = {
        startTime: event.session_time_seconds,
        status: event.status,
      };
    }
  }

  // If a band is still open at session end, close it at the last lap
  if (currentBand && totalLaps) {
    const startLap = sessionTimeToLap(currentBand.startTime);
    bands.push({
      startLap: Math.max(1, startLap - 0.5),
      endLap: totalLaps + 0.5,
      status: currentBand.status,
    });
  }

  return bands;
}

export default function LapTimeByLapGraph({
  season,
  round,
  isSprint = false,
}: LapTimeByLapGraphProps) {
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<ViewMode>("lapTime");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const { data, isLoading: loading } = useQuery<LapTimesResponse | null>({
    queryKey: ["lap-times", season, round, isSprint],
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

  // Auto-select top 3 finishers when data loads
  useEffect(() => {
    if (data?.drivers) {
      const sorted = [...data.drivers].sort(
        (a, b) => (a.final_position || 999) - (b.final_position || 999),
      );
      setSelectedDrivers(sorted.slice(0, 3).map((d) => d.driver_code));
    }
  }, [data]);

  // Compute track status bands
  const statusBands = useMemo(() => {
    if (!data) return [];
    return computeStatusBands(
      data.track_status_events || [],
      data.drivers,
      data.total_laps ?? null,
    );
  }, [data]);

  // Normalize pit lap times: subtract pit duration from lap time
  const getNormalizedLapTime = (lap: LapData): number | null => {
    if (lap.lap_time_seconds == null) return null;
    if (lap.pit_duration_seconds != null && lap.pit_duration_seconds > 0) {
      return lap.lap_time_seconds - lap.pit_duration_seconds;
    }
    return lap.lap_time_seconds;
  };

  // Check if a lap is a pit lap
  const isPitLap = (lap: LapData): boolean => {
    return lap.pit_duration_seconds != null && lap.pit_duration_seconds > 0;
  };

  // Calculate gap to leader data
  const getGapToLeaderData = (): ChartDataPoint[] => {
    if (!data || !data.drivers) return [];

    const filteredDrivers = data.drivers.filter((driver) =>
      selectedDrivers.includes(driver.driver_code),
    );

    if (filteredDrivers.length === 0) return [];

    // Get max lap count
    const maxLaps = Math.max(...filteredDrivers.map((d) => d.laps.length));

    // Calculate cumulative times for each driver (using normalized lap times)
    const cumulativeTimes = new Map<string, number[]>();

    for (const driver of filteredDrivers) {
      const cumulative: number[] = [];
      let total = 0;

      for (let lapNum = 1; lapNum <= maxLaps; lapNum++) {
        const lap = driver.laps.find((l) => l.lap_number === lapNum);
        if (lap && lap.lap_time_seconds !== null) {
          total += lap.lap_time_seconds;
          cumulative[lapNum - 1] = total;
        } else {
          cumulative[lapNum - 1] = -1;
        }
      }

      cumulativeTimes.set(driver.driver_code, cumulative);
    }

    const chartData: ChartDataPoint[] = [];

    for (let lapNum = 1; lapNum <= maxLaps; lapNum++) {
      let leaderTime = Number.POSITIVE_INFINITY;

      for (const driver of filteredDrivers) {
        const cumulative = cumulativeTimes.get(driver.driver_code);
        if (cumulative && cumulative[lapNum - 1] > 0) {
          leaderTime = Math.min(leaderTime, cumulative[lapNum - 1]);
        }
      }

      if (leaderTime === Number.POSITIVE_INFINITY) continue;

      const dataPoint: ChartDataPoint = { lap_number: lapNum };

      for (const driver of filteredDrivers) {
        const cumulative = cumulativeTimes.get(driver.driver_code);
        const lap = driver.laps.find((l) => l.lap_number === lapNum);

        if (cumulative && cumulative[lapNum - 1] > 0 && lap) {
          const gap = cumulative[lapNum - 1] - leaderTime;
          dataPoint[driver.driver_code] = gap;
          dataPoint[`_data_${driver.driver_code}`] = lap;
        }
      }

      chartData.push(dataPoint);
    }

    return chartData;
  };

  // Position chart data
  const getPositionData = (): ChartDataPoint[] => {
    if (!data || !data.drivers) return [];

    const filteredDrivers = data.drivers.filter((driver) =>
      selectedDrivers.includes(driver.driver_code),
    );

    if (filteredDrivers.length === 0) return [];

    const maxLaps = Math.max(...filteredDrivers.map((d) => d.laps.length));
    const chartData: ChartDataPoint[] = [];

    for (let lapNum = 1; lapNum <= maxLaps; lapNum++) {
      const dataPoint: ChartDataPoint = { lap_number: lapNum };

      for (const driver of filteredDrivers) {
        const lap = driver.laps.find((l) => l.lap_number === lapNum);
        if (lap && lap.position != null) {
          dataPoint[driver.driver_code] = lap.position;
          dataPoint[`_data_${driver.driver_code}`] = lap;
        }
      }

      chartData.push(dataPoint);
    }

    return chartData;
  };

  // Transform data for Recharts (lap time mode with pit normalization)
  const getLapTimeData = (): ChartDataPoint[] => {
    if (!data || !data.drivers) return [];

    const filteredDrivers = data.drivers.filter((driver) =>
      selectedDrivers.includes(driver.driver_code),
    );

    if (filteredDrivers.length === 0) return [];

    const maxLaps = Math.max(...filteredDrivers.map((d) => d.laps.length));
    const chartData: ChartDataPoint[] = [];

    for (let lapNum = 1; lapNum <= maxLaps; lapNum++) {
      const dataPoint: ChartDataPoint = { lap_number: lapNum };

      for (const driver of filteredDrivers) {
        const lap = driver.laps.find((l) => l.lap_number === lapNum);
        if (lap && lap.lap_time_seconds !== null) {
          // Use normalized time (pit duration subtracted) for the chart line
          const displayTime = getNormalizedLapTime(lap);
          if (displayTime !== null) {
            dataPoint[driver.driver_code] = displayTime;
          }
          // Store full lap data for tooltip (including raw lap time)
          dataPoint[`_data_${driver.driver_code}`] = lap;
          // Mark pit laps
          if (isPitLap(lap)) {
            dataPoint[`_pit_${driver.driver_code}`] = displayTime;
          }
        }
      }

      chartData.push(dataPoint);
    }

    return chartData;
  };

  const getChartData = (): ChartDataPoint[] => {
    if (viewMode === "gapToLeader") return getGapToLeaderData();
    if (viewMode === "position") return getPositionData();
    return getLapTimeData();
  };

  // Get drivers for dropdown (sorted by final position)
  const getDrivers = () => {
    if (!data || !data.drivers) return [];
    return [...data.drivers].sort(
      (a, b) => (a.final_position || 999) - (b.final_position || 999),
    );
  };

  // Toggle driver selection
  const toggleDriver = (driverCode: string) => {
    setSelectedDrivers((prev) => {
      if (prev.includes(driverCode)) {
        return prev.filter((d) => d !== driverCode);
      }
      return [...prev, driverCode];
    });
  };

  // Darken color for teammates (reduce brightness by 30%)
  const darkenColor = (hex: string | null, amount = 0.3): string => {
    if (!hex) return CHART_COLORS.textTertiary;
    const color = hex.startsWith("#") ? hex : `#${hex}`;
    const num = Number.parseInt(color.slice(1), 16);
    const r = Math.floor(((num >> 16) & 0xff) * (1 - amount));
    const g = Math.floor(((num >> 8) & 0xff) * (1 - amount));
    const b = Math.floor((num & 0xff) * (1 - amount));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
  };

  // Get color for driver (with teammate differentiation)
  const getDriverColor = (driver: DriverLapTimes) => {
    const drivers = data?.drivers || [];
    const sameTeamDrivers = drivers.filter(
      (d) => d.team_color === driver.team_color,
    );

    if (sameTeamDrivers.length > 1) {
      const sortedTeammates = [...sameTeamDrivers].sort(
        (a, b) => (a.final_position || 999) - (b.final_position || 999),
      );
      const index = sortedTeammates.findIndex(
        (d) => d.driver_code === driver.driver_code,
      );
      if (index > 0) {
        return darkenColor(driver.team_color, 0.3);
      }
    }

    return driver.team_color
      ? `#${driver.team_color}`
      : CHART_COLORS.textTertiary;
  };

  if (loading) {
    return (
      <div style={{ minHeight: "540px" }}>
        <div className="h-8 mb-4 flex items-center">
          <div className="h-6 bg-bg-elevated rounded w-96 animate-pulse" />
        </div>
        <div className="relative" style={{ height: "400px" }}>
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-center text-text-muted font-mono tracking-widest text-xs uppercase">
              Loading lap times...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!data || !data.drivers) {
    const isPre2018 = season < 2018;
    return (
      <div style={{ minHeight: "540px" }}>
        <div className="h-8 mb-4 flex items-center">
          <h3 className="text-sm font-bold text-text-secondary font-mono">
            Lap Time Analysis
          </h3>
        </div>
        <div className="relative" style={{ height: "400px" }}>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center max-w-md">
              <p className="text-text-muted mb-2">
                {isPre2018
                  ? "Lap timing data is not available for races before 2018."
                  : "Lap time data not available for this session."}
              </p>
              {isPre2018 && (
                <p className="text-sm text-text-muted">
                  Historical telemetry data (lap times, weather, track status)
                  is only available from the 2018 season onwards.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const chartData = getChartData();
  const drivers = getDrivers();

  const viewLabels: Record<ViewMode, string> = {
    lapTime: "Lap Times",
    gapToLeader: "Gap to Leader",
    position: "Position Battle",
  };

  // Calculate dynamic Y-axis domain
  const getYAxisDomain = (): [number, number] => {
    if (chartData.length === 0) {
      if (viewMode === "position") return [20, 1];
      return [120, 80];
    }

    if (viewMode === "position") {
      // Show P1 at top, max position at bottom
      let maxPos = 1;
      for (const dataPoint of chartData) {
        for (const key in dataPoint) {
          if (
            key !== "lap_number" &&
            !key.startsWith("_") &&
            typeof dataPoint[key] === "number"
          ) {
            maxPos = Math.max(maxPos, dataPoint[key] as number);
          }
        }
      }
      return [Math.min(maxPos + 1, 20), 1];
    }

    let minTime = Number.POSITIVE_INFINITY;
    let maxTime = Number.NEGATIVE_INFINITY;

    for (const dataPoint of chartData) {
      for (const key in dataPoint) {
        if (
          key !== "lap_number" &&
          !key.startsWith("_") &&
          typeof dataPoint[key] === "number"
        ) {
          const value = dataPoint[key] as number;
          if (value < minTime) minTime = value;
          if (value > maxTime) maxTime = value;
        }
      }
    }

    const padding = (maxTime - minTime) * 0.05;

    if (viewMode === "gapToLeader") {
      return [maxTime + padding, 0];
    }

    return [maxTime + padding, minTime - padding];
  };

  // Get Y-axis tick formatter based on view mode
  const getYAxisTick = () => {
    if (viewMode === "position") return <PositionYAxisTick />;
    if (viewMode === "gapToLeader") return <GapYAxisTick />;
    return <CustomYAxisTick />;
  };

  const getYAxisLabel = () => {
    if (viewMode === "position") return "Position";
    if (viewMode === "gapToLeader") return "Gap to Leader";
    return "Lap Time";
  };

  // Build Line components: one per driver (simple for gap/position modes)
  // For lap time mode, we just use the team color (pit normalization handles spikes)
  const renderLines = () => {
    return drivers
      .filter((driver) => selectedDrivers.includes(driver.driver_code))
      .map((driver) => {
        const color = getDriverColor(driver);
        return (
          <Line
            key={driver.driver_code}
            type="linear"
            dataKey={driver.driver_code}
            name={driver.full_name}
            stroke={color}
            strokeWidth={2}
            dot={viewMode === "position" ? false : <CustomDot />}
            activeDot={{ r: 6, fill: color, stroke: color }}
            filter={`url(#glow-${driver.driver_code})`}
            isAnimationActive={true}
            animationDuration={1500}
            animationBegin={0}
            animationEasing="ease-in-out"
            connectNulls={false}
          />
        );
      });
  };

  return (
    <div style={{ minHeight: "540px" }}>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-sm font-bold text-text-secondary font-mono">
          {data.event_name.replace("Grand Prix", "GP")} - {viewLabels[viewMode]}
        </h3>

        {/* Filter Buttons */}
        <div className="flex gap-2 relative flex-wrap" ref={dropdownRef}>
          {/* View Mode Toggle */}
          <div className="flex items-center gap-1">
            {(["lapTime", "gapToLeader", "position"] as ViewMode[]).map(
              (mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-1.5 rounded-sm text-xs font-bold font-mono uppercase tracking-widest transition-colors duration-150 ${
                    viewMode === mode
                      ? "bg-purple-500/20 border border-purple-500 text-purple-300"
                      : "border border-transparent text-text-muted hover:text-text-secondary"
                  }`}
                >
                  {mode === "lapTime"
                    ? "Lap Time"
                    : mode === "gapToLeader"
                      ? "Gap"
                      : "Position"}
                </button>
              ),
            )}
          </div>

          {/* Driver Selection Button */}
          <button
            type="button"
            onClick={() => setShowDropdown(!showDropdown)}
            className="px-4 py-1.5 rounded-sm text-xs font-bold font-mono uppercase tracking-widest border border-border-secondary text-text-secondary hover:border-purple-500 hover:text-purple-300 transition-colors duration-150"
          >
            Select ({selectedDrivers.length})
          </button>

          {/* Dropdown Menu */}
          {showDropdown && (
            <div className="absolute right-0 top-full mt-1 bg-bg-tertiary border border-border-primary rounded-sm shadow-xl z-10 min-w-[250px] max-h-[300px] overflow-y-auto">
              {drivers.map((driver) => {
                const isSelected = selectedDrivers.includes(driver.driver_code);
                const teamColor = driver.team_color
                  ? `#${driver.team_color}`
                  : CHART_COLORS.textTertiary;

                return (
                  <label
                    key={driver.driver_code}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-bg-elevated cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleDriver(driver.driver_code)}
                      className="w-4 h-4 accent-purple-500"
                    />
                    <span className="text-sm text-text-muted w-5 font-mono">
                      {driver.final_position || "-"}
                    </span>
                    <span
                      className="text-sm font-semibold"
                      style={{ color: teamColor }}
                    >
                      {driver.full_name}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="relative" style={{ minHeight: "400px" }}>
        {chartData.length > 0 ? (
          <>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart
                data={chartData}
                margin={{ top: 20, right: 20, left: 60, bottom: 20 }}
              >
                <defs>
                  {drivers
                    .filter((driver) =>
                      selectedDrivers.includes(driver.driver_code),
                    )
                    .map((driver) => (
                      <filter
                        key={`glow-${driver.driver_code}`}
                        id={`glow-${driver.driver_code}`}
                        x="-50%"
                        y="-50%"
                        width="200%"
                        height="200%"
                      >
                        <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                        <feMerge>
                          <feMergeNode in="coloredBlur" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                    ))}
                </defs>

                {/* Track Status Bands (SC/VSC/Red Flag) */}
                {statusBands.map((band, bandIdx) => {
                  const bandStyle = STATUS_BAND_COLORS[band.status];
                  if (!bandStyle) return null;
                  return (
                    <ReferenceArea
                      key={`band-${bandIdx}-${band.status}-${band.startLap}-${band.endLap}`}
                      x1={band.startLap}
                      x2={band.endLap}
                      fill={bandStyle.fill}
                      fillOpacity={1}
                      stroke="none"
                      label={{
                        value: bandStyle.label,
                        position: "insideTopLeft",
                        fill:
                          band.status === "4"
                            ? "#eab308"
                            : band.status === "5"
                              ? "#ef4444"
                              : "#f97316",
                        fontSize: 10,
                        fontWeight: "bold",
                        opacity: 0.7,
                      }}
                    />
                  );
                })}

                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={CHART_COLORS.borderPrimary}
                />
                <XAxis
                  dataKey="lap_number"
                  stroke={CHART_COLORS.textTertiary}
                  label={{
                    value: "Lap Number",
                    position: "insideBottom",
                    offset: -20,
                    style: { fontWeight: "bold", fill: "white" },
                  }}
                  tick={<CustomXAxisTick />}
                />
                <YAxis
                  stroke={CHART_COLORS.textTertiary}
                  label={{
                    value: getYAxisLabel(),
                    angle: -90,
                    position: "center",
                    dx: -45,
                    style: { fontWeight: "bold", fill: "white" },
                  }}
                  tick={getYAxisTick()}
                  domain={getYAxisDomain()}
                  reversed={true}
                  allowDecimals={viewMode !== "position"}
                />
                <Tooltip content={<CustomTooltip viewMode={viewMode} />} />
                {renderLines()}

                {/* Pit stop marker lines (only in lap time mode) */}
                {viewMode === "lapTime" &&
                  drivers
                    .filter((driver) =>
                      selectedDrivers.includes(driver.driver_code),
                    )
                    .map((driver) => (
                      <Line
                        key={`pit-${driver.driver_code}`}
                        type="linear"
                        dataKey={`_pit_${driver.driver_code}`}
                        stroke="none"
                        dot={<PitStopDot />}
                        activeDot={false}
                        isAnimationActive={false}
                        legendType="none"
                        tooltipType="none"
                      />
                    ))}
              </LineChart>
            </ResponsiveContainer>

            {/* Custom Legend */}
            <div className="absolute top-8 left-25 bg-bg-primary/90 border border-border-primary rounded-sm p-3 backdrop-blur-sm pointer-events-none">
              <div className="flex flex-col gap-1">
                {drivers
                  .filter((driver) =>
                    selectedDrivers.includes(driver.driver_code),
                  )
                  .map((driver) => {
                    const color = getDriverColor(driver);
                    return (
                      <div
                        key={driver.driver_code}
                        className="flex items-center gap-2"
                      >
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-xs font-bold text-text-primary font-mono">
                          {driver.full_name}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Status Band Legend (if bands exist) */}
            {statusBands.length > 0 && (
              <div className="absolute top-8 right-8 bg-bg-primary/90 border border-border-primary rounded-sm px-3 py-2 backdrop-blur-sm pointer-events-none">
                <div className="flex flex-col gap-1">
                  {Object.entries(STATUS_BAND_COLORS).map(([status, style]) => {
                    if (!statusBands.some((b) => b.status === status))
                      return null;
                    return (
                      <div key={status} className="flex items-center gap-2">
                        <div
                          className="w-4 h-3 rounded-sm"
                          style={{
                            backgroundColor:
                              status === "4"
                                ? "#eab308"
                                : status === "5"
                                  ? "#ef4444"
                                  : "#f97316",
                            opacity: 0.5,
                          }}
                        />
                        <span className="text-xs text-text-secondary font-mono">
                          {style.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-center text-text-muted font-mono tracking-widest text-xs uppercase">
              No lap time data available. Select at least one driver to view lap
              times.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
