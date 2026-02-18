"use client";

import { useQuery } from "@tanstack/react-query";
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
import { CHART_COLORS, CustomDot } from "@/components/chart-primitives";
import { apiHeaders, apiUrl } from "@/lib/api";

// Type definitions
type ProgressionRound = {
  round: string; // Round identifier: "21" for race, "21-sprint" for sprint
  cumulative_points: number;
  event_name: string | null;
};

type DriverProgression = {
  driver_code: string;
  full_name: string;
  team_color: string | null;
  final_position: number;
  progression: ProgressionRound[];
};

type ConstructorProgression = {
  team_name: string;
  team_color: string | null;
  final_position: number;
  progression: ProgressionRound[];
};

type ProgressionResponse = {
  year: number;
  type: "drivers" | "constructors";
  drivers?: DriverProgression[];
  constructors?: ConstructorProgression[];
};

type ChartDataPoint = {
  round: string;
  event_name?: string | null;
  [key: string]: number | string | null | undefined;
};

interface PointsByRoundGraphProps {
  season: string;
}

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

// Custom Tooltip Component
const CustomTooltip = ({ active, payload, label, mode }: any) => {
  if (!active || !payload || !payload.length) return null;

  // Skip tooltip for round 0
  if (label === "0") return null;

  // Get event name from first payload entry
  const eventName = (
    payload[0]?.payload?.event_name || `Round ${label}`
  ).replace("Grand Prix", "GP");
  const isSprint = label?.endsWith("-sprint");
  const displayName = isSprint ? `${eventName}: Sprint` : eventName;

  return (
    <div className="bg-bg-tertiary border border-border-primary rounded-lg p-3 shadow-xl">
      <p className="font-bold text-white mb-2">{displayName}</p>
      {payload.map((entry: any) => {
        const currentPoints = entry.value;
        const previousPoints = entry.payload[`_prev_${entry.dataKey}`] || 0;
        const pointsGained = currentPoints - previousPoints;

        return (
          <div key={entry.dataKey} className="flex items-center gap-2 mb-1">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="font-bold text-white text-sm">
              {mode === "drivers" ? entry.dataKey : entry.name}:{" "}
              {entry.value.toFixed(0)} pts{" "}
              <span>
                (
                <span
                  className={
                    pointsGained === 0 ? "text-blue-500" : "text-green-500"
                  }
                >
                  {pointsGained === 0 ? "-" : `+${pointsGained.toFixed(0)}`}
                </span>
                )
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
};

export default function PointsByRoundGraph({
  season,
}: PointsByRoundGraphProps) {
  const [mode, setMode] = useState<"drivers" | "constructors">("drivers");
  const [selectedEntities, setSelectedEntities] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState<boolean>(false);
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

  const { data, isLoading: loading } = useQuery({
    queryKey: ["points-progression", season, mode],
    queryFn: async () => {
      const response = await fetch(
        apiUrl(`/api/results/${season}/points-progression?mode=${mode}`),
        { headers: apiHeaders() },
      );
      return response.json() as Promise<ProgressionResponse>;
    },
  });

  // Auto-select top 3 when data loads or mode changes
  useEffect(() => {
    if (!data) return;
    if (mode === "drivers" && data.drivers) {
      const sorted = [...data.drivers].sort((a, b) => {
        const aFinal =
          a.progression[a.progression.length - 1]?.cumulative_points || 0;
        const bFinal =
          b.progression[b.progression.length - 1]?.cumulative_points || 0;
        return bFinal - aFinal;
      });
      setSelectedEntities(sorted.slice(0, 3).map((d) => d.driver_code));
    } else if (mode === "constructors" && data.constructors) {
      const sorted = [...data.constructors].sort((a, b) => {
        const aFinal =
          a.progression[a.progression.length - 1]?.cumulative_points || 0;
        const bFinal =
          b.progression[b.progression.length - 1]?.cumulative_points || 0;
        return bFinal - aFinal;
      });
      setSelectedEntities(sorted.slice(0, 3).map((c) => c.team_name));
    }
  }, [data, mode]);

  // Transform data for Recharts
  const getChartData = (): ChartDataPoint[] => {
    if (!data) return [];

    const entities =
      mode === "drivers" ? data.drivers || [] : data.constructors || [];
    const filteredEntities = entities.filter((entity) => {
      const key =
        mode === "drivers"
          ? (entity as DriverProgression).driver_code
          : (entity as ConstructorProgression).team_name;
      return selectedEntities.includes(key);
    });

    if (filteredEntities.length === 0) return [];

    const allProgressionPoints = filteredEntities[0]?.progression || [];
    const chartData: ChartDataPoint[] = [];

    for (let i = 0; i < allProgressionPoints.length; i++) {
      const progressionPoint = allProgressionPoints[i];
      const dataPoint: ChartDataPoint = {
        round: progressionPoint.round,
        event_name: progressionPoint.event_name,
      };

      for (const entity of filteredEntities) {
        const key =
          mode === "drivers"
            ? (entity as DriverProgression).driver_code
            : (entity as ConstructorProgression).team_name;

        const matchingPoint = entity.progression.find(
          (p) => p.round === progressionPoint.round,
        );
        const currentPoints = matchingPoint?.cumulative_points || 0;
        dataPoint[key] = currentPoints;

        if (i > 0) {
          const prevPoint = entity.progression.find(
            (p) => p.round === allProgressionPoints[i - 1].round,
          );
          dataPoint[`_prev_${key}`] = prevPoint?.cumulative_points || 0;
        } else {
          dataPoint[`_prev_${key}`] = 0;
        }
      }

      chartData.push(dataPoint);
    }

    return chartData;
  };

  const getEntities = () => {
    if (!data) return [];
    const entities =
      mode === "drivers" ? data.drivers || [] : data.constructors || [];
    return [...entities].sort((a, b) => a.final_position - b.final_position);
  };

  const toggleEntity = (key: string) => {
    setSelectedEntities((prev) => {
      if (prev.includes(key)) {
        return prev.filter((e) => e !== key);
      }
      return [...prev, key];
    });
  };

  // Darken color for teammates (reduce brightness by 20%)
  const darkenColor = (hex: string | null, amount = 0.2): string => {
    if (!hex) return CHART_COLORS.textTertiary;
    const color = hex.startsWith("#") ? hex : `#${hex}`;
    const num = Number.parseInt(color.slice(1), 16);
    const r = Math.floor(((num >> 16) & 0xff) * (1 - amount));
    const g = Math.floor(((num >> 8) & 0xff) * (1 - amount));
    const b = Math.floor((num & 0xff) * (1 - amount));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
  };

  const getEntityColor = (
    entity: DriverProgression | ConstructorProgression,
  ) => {
    if (mode === "constructors") {
      return entity.team_color
        ? `#${entity.team_color}`
        : CHART_COLORS.textTertiary;
    }

    const drivers = data?.drivers || [];
    const driverEntity = entity as DriverProgression;
    const sameTeamDrivers = drivers.filter(
      (d) => d.team_color === driverEntity.team_color,
    );

    if (sameTeamDrivers.length > 1) {
      const sortedTeammates = [...sameTeamDrivers].sort((a, b) => {
        const aFinal =
          a.progression[a.progression.length - 1]?.cumulative_points || 0;
        const bFinal =
          b.progression[b.progression.length - 1]?.cumulative_points || 0;
        return bFinal - aFinal;
      });
      const index = sortedTeammates.findIndex(
        (d) => d.driver_code === driverEntity.driver_code,
      );
      if (index > 0) {
        return darkenColor(driverEntity.team_color, 0.3);
      }
    }

    return driverEntity.team_color
      ? `#${driverEntity.team_color}`
      : CHART_COLORS.textTertiary;
  };

  if (loading) {
    return (
      <div
        className="bg-bg-tertiary rounded-lg border border-border-primary shadow-lg p-6"
        style={{ minHeight: "540px" }}
      >
        <div className="h-8 mb-4 flex items-center">
          <div className="h-6 bg-bg-elevated rounded w-96 animate-pulse" />
        </div>
        <div className="relative" style={{ height: "400px" }}>
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-center text-gray-400">
              Loading progression data...
            </p>
          </div>
        </div>
      </div>
    );
  }

  const chartData = getChartData();
  const entities = getEntities();

  const getYAxisMax = (): number => {
    if (chartData.length === 0) return 500;

    let maxPoints = 0;
    for (const dataPoint of chartData) {
      for (const key in dataPoint) {
        if (key !== "round" && key !== "event_name") {
          const value = dataPoint[key];
          if (typeof value === "number" && value > maxPoints) {
            maxPoints = value;
          }
        }
      }
    }

    return Math.ceil(maxPoints / 50) * 50;
  };

  return (
    <div
      className="bg-bg-tertiary rounded-lg border border-border-primary shadow-lg p-6"
      style={{ minHeight: "540px" }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white">
          {season} {mode === "drivers" ? "Drivers'" : "Constructors'"} Total
          Points by Round
        </h3>

        {/* Filter Buttons */}
        <div className="flex gap-2 relative" ref={dropdownRef}>
          {/* Mode Selector */}
          <div className="flex gap-1 bg-bg-secondary border border-border-primary rounded p-1">
            <button
              type="button"
              onClick={() => setMode("drivers")}
              className={`px-3 py-1 rounded text-sm font-semibold transition-all ${
                mode === "drivers"
                  ? "bg-purple-500 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Drivers
            </button>
            <button
              type="button"
              onClick={() => setMode("constructors")}
              className={`px-3 py-1 rounded text-sm font-semibold transition-all ${
                mode === "constructors"
                  ? "bg-purple-500 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Constructors
            </button>
          </div>

          {/* Dropdown Button */}
          <button
            type="button"
            onClick={() => setShowDropdown(!showDropdown)}
            className="px-3 py-1.5 bg-bg-secondary border border-border-primary rounded text-sm font-semibold text-white hover:border-purple-500 transition-all"
          >
            Select ({selectedEntities.length})
          </button>

          {/* Dropdown Menu */}
          {showDropdown && (
            <div className="absolute right-0 top-full mt-1 bg-bg-tertiary border border-border-primary rounded-lg shadow-xl z-10 min-w-[250px] max-h-[300px] overflow-y-auto">
              {entities.map((entity) => {
                const key =
                  mode === "drivers"
                    ? (entity as DriverProgression).driver_code
                    : (entity as ConstructorProgression).team_name;
                const name =
                  mode === "drivers"
                    ? (entity as DriverProgression).full_name
                    : (entity as ConstructorProgression).team_name;
                const isSelected = selectedEntities.includes(key);
                const teamColor = entity.team_color
                  ? `#${entity.team_color}`
                  : CHART_COLORS.textTertiary;

                return (
                  <label
                    key={key}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-bg-elevated cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleEntity(key)}
                      className="w-4 h-4 accent-purple-500"
                    />
                    <span className="text-sm text-gray-500 w-5">
                      {entity.final_position}
                    </span>
                    <span
                      className="text-sm font-semibold"
                      style={{ color: teamColor }}
                    >
                      {name}
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
                margin={{ top: 20, right: 20, left: 20, bottom: 20 }}
              >
                <defs>
                  {entities
                    .filter((entity) => {
                      const key =
                        mode === "drivers"
                          ? (entity as DriverProgression).driver_code
                          : (entity as ConstructorProgression).team_name;
                      return selectedEntities.includes(key);
                    })
                    .map((entity) => {
                      const key =
                        mode === "drivers"
                          ? (entity as DriverProgression).driver_code
                          : (entity as ConstructorProgression).team_name;
                      return (
                        <filter
                          key={`glow-${key}`}
                          id={`glow-${key}`}
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
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={CHART_COLORS.borderPrimary}
                />
                <XAxis
                  dataKey="round"
                  stroke={CHART_COLORS.textTertiary}
                  label={{
                    value: "Round",
                    position: "insideBottom",
                    offset: -20,
                    style: { fontWeight: "bold", fill: "white" },
                  }}
                  tick={<CustomXAxisTick />}
                  interval={0}
                />
                <YAxis
                  stroke={CHART_COLORS.textTertiary}
                  label={{
                    value: "Total Points",
                    angle: -90,
                    position: "center",
                    dx: -30,
                    style: { fontWeight: "bold", fill: "white" },
                  }}
                  domain={[0, getYAxisMax()]}
                />
                <Tooltip content={<CustomTooltip mode={mode} />} />
                {entities
                  .filter((entity) => {
                    const key =
                      mode === "drivers"
                        ? (entity as DriverProgression).driver_code
                        : (entity as ConstructorProgression).team_name;
                    return selectedEntities.includes(key);
                  })
                  .map((entity) => {
                    const key =
                      mode === "drivers"
                        ? (entity as DriverProgression).driver_code
                        : (entity as ConstructorProgression).team_name;
                    const name =
                      mode === "drivers"
                        ? (entity as DriverProgression).full_name
                        : (entity as ConstructorProgression).team_name;

                    return (
                      <Line
                        key={key}
                        type="linear"
                        dataKey={key}
                        name={name}
                        stroke={getEntityColor(entity)}
                        strokeWidth={2}
                        dot={<CustomDot />}
                        activeDot={{ r: 6 }}
                        filter={`url(#glow-${key})`}
                        isAnimationActive={true}
                        animationDuration={1500}
                        animationBegin={0}
                        animationEasing="ease-in-out"
                      />
                    );
                  })}
              </LineChart>
            </ResponsiveContainer>

            {/* Custom Legend - Positioned in top-left */}
            <div className="absolute top-8 left-25 bg-bg-tertiary/90 border border-border-primary rounded-lg p-3 backdrop-blur-sm pointer-events-none">
              <div className="flex flex-col gap-1">
                {entities
                  .filter((entity) => {
                    const key =
                      mode === "drivers"
                        ? (entity as DriverProgression).driver_code
                        : (entity as ConstructorProgression).team_name;
                    return selectedEntities.includes(key);
                  })
                  .map((entity) => {
                    const key =
                      mode === "drivers"
                        ? (entity as DriverProgression).driver_code
                        : (entity as ConstructorProgression).team_name;
                    const name =
                      mode === "drivers"
                        ? (entity as DriverProgression).full_name
                        : (entity as ConstructorProgression).team_name;
                    const color = getEntityColor(entity);

                    return (
                      <div key={key} className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-sm font-bold text-white">
                          {name}
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
              No data available. Select at least one{" "}
              {mode === "drivers" ? "driver" : "constructor"} to view
              progression.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
