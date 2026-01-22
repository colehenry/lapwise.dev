"use client";

import { useEffect, useRef, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { apiHeaders, apiUrl } from "@/lib/api";

// Type definitions
type LapData = {
  lap_number: number;
  lap_time_seconds: number | null;
  compound: string | null;
  tyre_life: number | null;
  track_status: string | null;
};

type DriverLapTimes = {
  driver_code: string;
  full_name: string;
  team_color: string | null;
  final_position: number | null;
  laps: LapData[];
};

type LapTimesResponse = {
  year: number;
  round: number;
  event_name: string;
  drivers: DriverLapTimes[];
};

type ChartDataPoint = {
  lap_number: number;
  [key: string]: number | string | null | undefined | LapData;
};

type ViewMode = "lapTime" | "gapToLeader";

interface LapTimeByLapGraphProps {
  season: number;
  round: number;
  isSprint?: boolean;
}

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
      <text x={0} y={0} dx={-5} textAnchor="end" fill="#999" fontSize={11}>
        {formatLapTime(payload.value)}
      </text>
    </g>
  );
};

// Custom X-axis Tick Component
const CustomXAxisTick = (props: any) => {
  const { x, y, payload } = props;
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={16} textAnchor="middle" fill="#999" fontSize={12}>
        {payload.value}
      </text>
    </g>
  );
};

// Custom Dot Component
const CustomDot = (props: any) => {
  const { cx, cy, stroke } = props;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={3}
      fill={stroke}
      stroke={stroke}
      strokeWidth={1}
    />
  );
};

// Custom Tooltip Component
const CustomTooltip = ({ active, payload, label, viewMode }: any) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-[#1e1e28] border border-[#2a2a35] rounded-lg p-3 shadow-xl">
      <p className="font-bold text-white mb-2">Lap {label}</p>
      {payload.map((entry: any) => {
        const lapData = entry.payload[`_data_${entry.dataKey}`];

        return (
          <div key={entry.dataKey} className="mb-2">
            <div className="flex items-center gap-2 mb-1">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="font-bold text-white text-sm">{entry.name}</span>
            </div>
            <div className="ml-5 text-xs text-gray-300 space-y-0.5">
              <div>
                <span className="text-gray-400">
                  {viewMode === "gapToLeader" ? "Gap:" : "Time:"}
                </span>{" "}
                <span className="font-mono text-white">
                  {viewMode === "gapToLeader" && entry.value === 0
                    ? "Leader"
                    : viewMode === "gapToLeader"
                      ? `+${entry.value.toFixed(3)}s`
                      : formatLapTime(entry.value)}
                </span>
              </div>
              {lapData?.compound && (
                <div>
                  <span className="text-gray-400">Tyre:</span>{" "}
                  <span
                    className={`font-semibold ${
                      lapData.compound === "SOFT"
                        ? "text-red-400"
                        : lapData.compound === "MEDIUM"
                          ? "text-yellow-400"
                          : lapData.compound === "HARD"
                            ? "text-gray-100"
                            : lapData.compound === "INTERMEDIATE"
                              ? "text-green-400"
                              : "text-blue-400"
                    }`}
                  >
                    {lapData.compound}
                  </span>
                </div>
              )}
              {lapData?.tyre_life !== null &&
                lapData?.tyre_life !== undefined && (
                  <div>
                    <span className="text-gray-400">Tyre age:</span>{" "}
                    <span className="text-white">
                      {lapData.tyre_life}{" "}
                      {lapData.tyre_life === 1 ? "lap" : "laps"}
                    </span>
                  </div>
                )}
              {lapData?.track_status && lapData.track_status !== "1" && (
                <div>
                  <span className="text-gray-400">Track status:</span>{" "}
                  <span
                    className={`font-semibold ${
                      lapData.track_status.includes("2")
                        ? "text-yellow-400"
                        : lapData.track_status.includes("4")
                          ? "text-green-400"
                          : "text-gray-300"
                    }`}
                  >
                    {lapData.track_status.includes("2")
                      ? "Yellow Flag"
                      : lapData.track_status.includes("4")
                        ? "Green Flag"
                        : `Status ${lapData.track_status}`}
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default function LapTimeByLapGraph({
  season,
  round,
  isSprint = false,
}: LapTimeByLapGraphProps) {
  const [data, setData] = useState<LapTimesResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
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

  // Fetch data when season or round changes
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const endpoint = isSprint
          ? `/api/results/${season}/${round}/sprint/lap-times`
          : `/api/results/${season}/${round}/lap-times`;
        const response = await fetch(apiUrl(endpoint), {
          cache: "no-store",
          headers: apiHeaders(),
        });

        if (!response.ok) {
          console.error(`Failed to fetch lap times: ${response.status}`);
          setData(null);
          return;
        }

        const lapTimesData = await response.json();
        setData(lapTimesData);

        // Auto-select top 3 finishers
        if (lapTimesData.drivers) {
          const sorted = [...lapTimesData.drivers].sort(
            (a, b) => (a.final_position || 999) - (b.final_position || 999),
          );
          setSelectedDrivers(sorted.slice(0, 3).map((d) => d.driver_code));
        }
      } catch (error) {
        console.error("Failed to fetch lap times:", error);
        setData(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [season, round, isSprint]);

  // Calculate gap to leader data
  const getGapToLeaderData = (): ChartDataPoint[] => {
    if (!data || !data.drivers) return [];

    const filteredDrivers = data.drivers.filter((driver) =>
      selectedDrivers.includes(driver.driver_code),
    );

    if (filteredDrivers.length === 0) return [];

    // Get max lap count
    const maxLaps = Math.max(...filteredDrivers.map((d) => d.laps.length));

    // Calculate cumulative times for each driver
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
          cumulative[lapNum - 1] = -1; // Mark as invalid
        }
      }

      cumulativeTimes.set(driver.driver_code, cumulative);
    }

    // Create data points for each lap
    const chartData: ChartDataPoint[] = [];

    for (let lapNum = 1; lapNum <= maxLaps; lapNum++) {
      // Find leader (minimum cumulative time) for this lap
      let leaderTime = Number.POSITIVE_INFINITY;

      for (const driver of filteredDrivers) {
        const cumulative = cumulativeTimes.get(driver.driver_code);
        if (cumulative && cumulative[lapNum - 1] > 0) {
          leaderTime = Math.min(leaderTime, cumulative[lapNum - 1]);
        }
      }

      // Skip lap if no valid leader time
      if (leaderTime === Number.POSITIVE_INFINITY) continue;

      const dataPoint: ChartDataPoint = {
        lap_number: lapNum,
      };

      for (const driver of filteredDrivers) {
        const cumulative = cumulativeTimes.get(driver.driver_code);
        const lap = driver.laps.find((l) => l.lap_number === lapNum);

        if (cumulative && cumulative[lapNum - 1] > 0 && lap) {
          const gap = cumulative[lapNum - 1] - leaderTime;
          dataPoint[driver.driver_code] = gap;
          // Store full lap data for tooltip
          dataPoint[`_data_${driver.driver_code}`] = lap;
        }
      }

      chartData.push(dataPoint);
    }

    return chartData;
  };

  // Transform data for Recharts
  const getChartData = (): ChartDataPoint[] => {
    if (!data || !data.drivers) return [];

    if (viewMode === "gapToLeader") {
      return getGapToLeaderData();
    }

    const filteredDrivers = data.drivers.filter((driver) =>
      selectedDrivers.includes(driver.driver_code),
    );

    if (filteredDrivers.length === 0) return [];

    // Get max lap count
    const maxLaps = Math.max(...filteredDrivers.map((d) => d.laps.length));

    // Create data points for each lap
    const chartData: ChartDataPoint[] = [];

    for (let lapNum = 1; lapNum <= maxLaps; lapNum++) {
      const dataPoint: ChartDataPoint = {
        lap_number: lapNum,
      };

      for (const driver of filteredDrivers) {
        const lap = driver.laps.find((l) => l.lap_number === lapNum);
        if (lap && lap.lap_time_seconds !== null) {
          dataPoint[driver.driver_code] = lap.lap_time_seconds;
          // Store full lap data for tooltip
          dataPoint[`_data_${driver.driver_code}`] = lap;
        }
      }

      chartData.push(dataPoint);
    }

    return chartData;
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
    if (!hex) return "#999999";
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
      // Find which teammate this is (by final position)
      const sortedTeammates = [...sameTeamDrivers].sort(
        (a, b) => (a.final_position || 999) - (b.final_position || 999),
      );
      const index = sortedTeammates.findIndex(
        (d) => d.driver_code === driver.driver_code,
      );
      if (index > 0) {
        // Second teammate gets darker color
        return darkenColor(driver.team_color, 0.3);
      }
    }

    return driver.team_color ? `#${driver.team_color}` : "#999999";
  };

  if (loading) {
    return (
      <div
        className="bg-[#1e1e28] rounded-lg border border-[#2a2a35] shadow-lg p-6"
        style={{ minHeight: "540px" }}
      >
        <div className="h-8 mb-4 flex items-center">
          <div className="h-6 bg-[#2a2a35] rounded w-64 animate-pulse" />
        </div>
        <div className="relative" style={{ height: "400px" }}>
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-center text-gray-400">Loading lap times...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data || !data.drivers) {
    return (
      <div
        className="bg-[#1e1e28] rounded-lg border border-[#2a2a35] shadow-lg p-6"
        style={{ minHeight: "540px" }}
      >
        <div className="h-8 mb-4 flex items-center">
          <div className="h-6 bg-[#2a2a35] rounded w-64" />
        </div>
        <div className="relative" style={{ height: "400px" }}>
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-center text-gray-400">
              Lap time data not available for this session.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const chartData = getChartData();
  const drivers = getDrivers();

  // Calculate dynamic Y-axis domain (high numbers at top, low at bottom)
  const getYAxisDomain = (): [number, number] => {
    if (chartData.length === 0) return [120, 80];

    let minTime = Number.POSITIVE_INFINITY;
    let maxTime = Number.NEGATIVE_INFINITY;

    for (const dataPoint of chartData) {
      for (const key in dataPoint) {
        if (
          key !== "lap_number" &&
          !key.startsWith("_data_") &&
          typeof dataPoint[key] === "number"
        ) {
          const value = dataPoint[key] as number;
          if (value < minTime) minTime = value;
          if (value > maxTime) maxTime = value;
        }
      }
    }

    // Add 5% padding
    const padding = (maxTime - minTime) * 0.05;

    // For gap to leader, force minimum to 0 (leader is always at 0)
    // Return [max, 0] so that 0 appears at top with reversed=true
    if (viewMode === "gapToLeader") {
      return [maxTime + padding, 0];
    }

    // For lap time, use normal padding
    return [maxTime + padding, minTime - padding];
  };

  return (
    <div
      className="bg-[#1e1e28] rounded-lg border border-[#2a2a35] shadow-lg p-6"
      style={{ minHeight: "540px" }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white">
          {data.event_name} -{" "}
          {viewMode === "lapTime" ? "Lap Times" : "Gap to Leader"}
        </h3>

        {/* Filter Buttons */}
        <div className="flex gap-2 relative" ref={dropdownRef}>
          {/* View Mode Toggle */}
          <div className="flex gap-1 bg-[#15151e] border border-[#2a2a35] rounded p-1">
            <button
              type="button"
              onClick={() => setViewMode("lapTime")}
              className={`px-3 py-1 rounded text-sm font-semibold transition-all ${
                viewMode === "lapTime"
                  ? "bg-[#a020f0] text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Lap Time
            </button>
            <button
              type="button"
              onClick={() => setViewMode("gapToLeader")}
              className={`px-3 py-1 rounded text-sm font-semibold transition-all ${
                viewMode === "gapToLeader"
                  ? "bg-[#a020f0] text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Gap to Leader
            </button>
          </div>

          {/* Driver Selection Button */}
          <button
            type="button"
            onClick={() => setShowDropdown(!showDropdown)}
            className="px-3 py-1.5 bg-[#15151e] border border-[#2a2a35] rounded text-sm font-semibold text-white hover:border-[#a020f0] transition-all"
          >
            Select Drivers ({selectedDrivers.length})
          </button>

          {/* Dropdown Menu */}
          {showDropdown && (
            <div className="absolute right-0 top-full mt-1 bg-[#1e1e28] border border-[#2a2a35] rounded-lg shadow-xl z-10 min-w-[250px] max-h-[300px] overflow-y-auto">
              {drivers.map((driver) => {
                const isSelected = selectedDrivers.includes(driver.driver_code);
                const teamColor = driver.team_color
                  ? `#${driver.team_color}`
                  : "#999";

                return (
                  <label
                    key={driver.driver_code}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-[#2a2a35] cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleDriver(driver.driver_code)}
                      className="w-4 h-4 accent-[#a020f0]"
                    />
                    <span className="text-sm text-gray-500 w-5">
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
                    .map((driver) => {
                      return (
                        <filter
                          key={`glow-${driver.driver_code}`}
                          id={`glow-${driver.driver_code}`}
                          x="-50%"
                          y="-50%"
                          width="200%"
                          height="200%"
                        >
                          <feGaussianBlur
                            stdDeviation="2"
                            result="coloredBlur"
                          />
                          <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                          </feMerge>
                        </filter>
                      );
                    })}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a35" />
                <XAxis
                  dataKey="lap_number"
                  stroke="#999"
                  label={{
                    value: "Lap Number",
                    position: "insideBottom",
                    offset: -20,
                    style: { fontWeight: "bold", fill: "white" },
                  }}
                  tick={<CustomXAxisTick />}
                />
                <YAxis
                  stroke="#999"
                  label={{
                    value:
                      viewMode === "lapTime" ? "Lap Time" : "Gap to Leader",
                    angle: -90,
                    position: "center",
                    dx: -45,
                    style: { fontWeight: "bold", fill: "white" },
                  }}
                  tick={<CustomYAxisTick />}
                  domain={getYAxisDomain()}
                  reversed={true}
                />
                <Tooltip content={<CustomTooltip viewMode={viewMode} />} />
                {drivers
                  .filter((driver) =>
                    selectedDrivers.includes(driver.driver_code),
                  )
                  .map((driver) => {
                    return (
                      <Line
                        key={driver.driver_code}
                        type="linear"
                        dataKey={driver.driver_code}
                        name={driver.full_name}
                        stroke={getDriverColor(driver)}
                        strokeWidth={2}
                        dot={<CustomDot />}
                        activeDot={{ r: 6 }}
                        filter={`url(#glow-${driver.driver_code})`}
                        isAnimationActive={true}
                        animationDuration={1500}
                        animationBegin={0}
                        animationEasing="ease-in-out"
                        connectNulls={false}
                      />
                    );
                  })}
              </LineChart>
            </ResponsiveContainer>

            {/* Custom Legend */}
            <div className="absolute bottom-16 left-35 bg-[#1e1e28]/90 border border-[#2a2a35] rounded-lg p-3 backdrop-blur-sm pointer-events-none">
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
                        <span className="text-sm font-bold text-white">
                          {driver.full_name}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-center text-gray-400">
              No lap time data available. Select at least one driver to view lap
              times.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
