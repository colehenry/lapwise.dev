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
  round: string; // Round identifier: "21" for race, "21-sprint" for sprint, "21-sq" for sprint qualifying
  cumulative_points: number;
  position?: number | null;
  event_name: string | null;
};

type DriverProgression = {
  driver_code: string;
  full_name: string;
  team_name?: string | null;
  team_color: string | null;
  final_position: number;
  progression: ProgressionRound[];
};

type ConstructorProgression = {
  team_name: string;
  team_color: string | null;
  final_position: number;
  progression: ProgressionRound[];
  all_positions?: number[][] | null;
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
  pointsType?: "race" | "qualifying";
}

// Custom X-axis Tick Component
interface XAxisTickProps {
  x?: number;
  y?: number;
  payload?: { value: string | number };
}

const CustomXAxisTick = (props: XAxisTickProps) => {
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
        {payload?.value}
      </text>
    </g>
  );
};

// Custom Tooltip Component
interface TooltipPayloadEntry {
  dataKey: string;
  value: number;
  color: string;
  name: string;
  payload: Record<string, unknown>;
}

interface TooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string | number;
  pointsType?: string;
  mode?: string;
}

const CustomTooltip = ({
  active,
  payload,
  label,
  pointsType,
}: TooltipProps) => {
  if (!active || !payload || !payload.length) return null;

  // Skip tooltip for round 0
  if (label === "0") return null;

  // Get event name from first payload entry
  const rawEventName = payload[0]?.payload?.event_name;
  const eventName = (
    typeof rawEventName === "string" ? rawEventName : `Round ${label}`
  ).replace("Grand Prix", "GP");

  const labelStr2 = typeof label === "string" ? label : String(label ?? "");
  const isSprint = labelStr2.endsWith("-sprint");
  const isSprintQualy = labelStr2.endsWith("-sq");

  let sessionLabel = "";
  if (isSprint) sessionLabel = ": Sprint";
  if (isSprintQualy) sessionLabel = ": SQ";

  const displayName = `${eventName}${sessionLabel}`;

  // Filter out null entries
  const filteredPayload = payload.filter(
    (entry: TooltipPayloadEntry) => entry.value != null,
  );
  if (filteredPayload.length === 0) return null;

  return (
    <div className="bg-bg-tertiary border border-border-primary rounded-lg p-3 shadow-xl">
      <p className="font-bold text-white mb-2">{displayName}</p>
      {filteredPayload.map((entry: TooltipPayloadEntry) => {
        const value = entry.value;
        const isQualy = pointsType === "qualifying";
        const labelStr = isQualy
          ? value === 21
            ? "DNF"
            : `P${value}`
          : `${value.toFixed(0)} pts`;

        return (
          <div key={entry.dataKey} className="flex items-center gap-2 mb-1">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="font-bold text-white text-sm">
              {entry.name}: {labelStr}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export default function PointsByRoundGraph({
  season,
  pointsType = "race",
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
    queryKey: ["points-progression", season, mode, pointsType],
    queryFn: async () => {
      const response = await fetch(
        apiUrl(
          `/api/results/${season}/points-progression?mode=${mode}&points_type=${pointsType}`,
        ),
        { headers: apiHeaders() },
      );
      return response.json() as Promise<ProgressionResponse>;
    },
  });

  // Auto-select top 3 when data loads or mode changes
  useEffect(() => {
    if (!data) return;
    if (mode === "drivers" && data.drivers) {
      const sorted = [...data.drivers].sort(
        (a, b) => a.final_position - b.final_position,
      );
      setSelectedEntities(sorted.slice(0, 3).map((d) => d.driver_code));
    } else if (mode === "constructors" && data.constructors) {
      const sorted = [...data.constructors].sort(
        (a, b) => a.final_position - b.final_position,
      );
      setSelectedEntities(sorted.slice(0, 3).map((c) => c.team_name));
    }
  }, [data, mode]);

  // Transform data for Recharts
  const getChartData = (): ChartDataPoint[] => {
    if (!data) return [];

    const isQualy = pointsType === "qualifying";
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

    // For qualifying, we start from index 1 to skip Round 0
    const startIndex = isQualy ? 1 : 0;

    for (let i = startIndex; i < allProgressionPoints.length; i++) {
      const progressionPoint = allProgressionPoints[i];
      const dataPoint: ChartDataPoint = {
        round: progressionPoint.round,
        event_name: progressionPoint.event_name,
      };

      for (const entity of filteredEntities) {
        if (mode === "drivers") {
          const driver = entity as DriverProgression;
          const matchingPoint = driver.progression.find(
            (p) => p.round === progressionPoint.round,
          );
          if (isQualy) {
            const pos = matchingPoint?.position;
            // Map null/0 positions to 21 (DNF) so they appear at the bottom of the chart
            dataPoint[driver.driver_code] = pos && pos > 0 ? pos : 21;
          } else {
            dataPoint[driver.driver_code] = matchingPoint?.cumulative_points;
          }
        } else {
          const team = entity as ConstructorProgression;
          if (isQualy && team.all_positions) {
            const roundPositions = team.all_positions[i] || [];
            // Handle up to 3 drivers per team, filter out 0/null positions
            for (let dIdx = 0; dIdx < 3; dIdx++) {
              const pos = roundPositions[dIdx];
              dataPoint[`${team.team_name}-${dIdx}`] =
                pos && pos > 0 ? pos : null;
            }
          } else {
            const matchingPoint = team.progression.find(
              (p) => p.round === progressionPoint.round,
            );
            dataPoint[team.team_name] = matchingPoint?.cumulative_points;
          }
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
      const sortedTeammates = [...sameTeamDrivers].sort(
        (a, b) => a.final_position - b.final_position,
      );
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
      <div style={{ minHeight: "540px" }}>
        <div className="h-8 mb-4 flex items-center">
          <div className="h-6 bg-bg-elevated rounded w-96 animate-pulse" />
        </div>
        <div className="relative" style={{ height: "400px" }}>
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-center text-text-muted font-mono tracking-widest text-xs uppercase">
              Loading progression data...
            </p>
          </div>
        </div>
      </div>
    );
  }

  const chartData = getChartData();
  const entities = getEntities();
  const isQualy = pointsType === "qualifying";

  const getYAxisMax = (): number => {
    if (isQualy) return 20;
    if (chartData.length === 0) return 500;

    let maxPoints = 0;
    for (const dataPoint of chartData) {
      for (const key in dataPoint) {
        if (
          key !== "round" &&
          key !== "event_name" &&
          !key.startsWith("_prev_")
        ) {
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
    <div style={{ minHeight: "540px" }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-text-secondary font-mono">
          {season} {mode === "drivers" ? "Drivers'" : "Constructors'"}
          {isQualy ? " Qualifying Positions" : " Total Points"} by Round
        </h3>

        {/* Filter Buttons */}
        <div className="flex gap-2 relative" ref={dropdownRef}>
          {/* Mode Selector */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setMode("drivers")}
              className={`px-4 py-1.5 rounded-sm text-xs font-bold font-mono uppercase tracking-widest transition-colors duration-150 ${
                mode === "drivers"
                  ? "bg-purple-500/20 border border-purple-500 text-purple-300"
                  : "border border-transparent text-text-muted hover:text-text-secondary"
              }`}
            >
              Drivers
            </button>
            <button
              type="button"
              onClick={() => setMode("constructors")}
              className={`px-4 py-1.5 rounded-sm text-xs font-bold font-mono uppercase tracking-widest transition-colors duration-150 ${
                mode === "constructors"
                  ? "bg-purple-500/20 border border-purple-500 text-purple-300"
                  : "border border-transparent text-text-muted hover:text-text-secondary"
              }`}
            >
              Constructors
            </button>
          </div>

          {/* Dropdown Button */}
          <button
            type="button"
            onClick={() => setShowDropdown(!showDropdown)}
            className="px-4 py-1.5 rounded-sm text-xs font-bold font-mono uppercase tracking-widest border border-border-secondary text-text-secondary hover:border-purple-500 hover:text-purple-300 transition-colors duration-150"
          >
            Select ({selectedEntities.length})
          </button>

          {/* Dropdown Menu */}
          {showDropdown && (
            <div className="absolute right-0 top-full mt-1 bg-bg-tertiary border border-border-primary rounded-sm shadow-xl z-10 min-w-[250px] max-h-[300px] overflow-y-auto">
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
                    <span className="text-sm text-text-muted w-5 font-mono">
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
                  reversed={isQualy}
                  label={{
                    value: isQualy ? "Position" : "Total Points",
                    angle: -90,
                    position: "center",
                    dx: -30,
                    style: { fontWeight: "bold", fill: "white" },
                  }}
                  domain={isQualy ? [1, 21] : [0, getYAxisMax()]}
                  ticks={isQualy ? [1, 5, 10, 15, 20, 21] : undefined}
                  tickFormatter={
                    isQualy
                      ? (value: number) =>
                          value === 21 ? "DNF" : String(value)
                      : undefined
                  }
                />
                <Tooltip
                  content={
                    <CustomTooltip mode={mode} pointsType={pointsType} />
                  }
                />
                {entities
                  .filter((entity) => {
                    const key =
                      mode === "drivers"
                        ? (entity as DriverProgression).driver_code
                        : (entity as ConstructorProgression).team_name;
                    return selectedEntities.includes(key);
                  })
                  .flatMap((entity) => {
                    const color = getEntityColor(entity);
                    const name =
                      mode === "drivers"
                        ? (entity as DriverProgression).full_name
                        : (entity as ConstructorProgression).team_name;

                    if (mode === "drivers") {
                      const driver = entity as DriverProgression;
                      return [
                        <Line
                          key={driver.driver_code}
                          type="linear"
                          dataKey={driver.driver_code}
                          name={name}
                          stroke={color}
                          strokeWidth={2}
                          dot={<CustomDot />}
                          activeDot={{ r: 6, fill: color, stroke: color }}
                          filter={`url(#glow-${driver.driver_code})`}
                          isAnimationActive={true}
                          connectNulls={false}
                        />,
                      ];
                    } else {
                      const team = entity as ConstructorProgression;
                      if (isQualy) {
                        // Render dots for each driver, no lines
                        // Use stroke={color} so CustomDot picks up the team color
                        return [0, 1, 2].map((dIdx) => (
                          <Line
                            key={`${team.team_name}-${dIdx}`}
                            type="linear"
                            dataKey={`${team.team_name}-${dIdx}`}
                            name={name}
                            stroke={color}
                            strokeWidth={0}
                            dot={<CustomDot />}
                            activeDot={{ r: 6, fill: color, stroke: color }}
                            isAnimationActive={true}
                            connectNulls={false}
                          />
                        ));
                      } else {
                        return [
                          <Line
                            key={team.team_name}
                            type="linear"
                            dataKey={team.team_name}
                            name={name}
                            stroke={color}
                            strokeWidth={2}
                            dot={<CustomDot />}
                            activeDot={{ r: 6, fill: color, stroke: color }}
                            filter={`url(#glow-${team.team_name})`}
                            isAnimationActive={true}
                            connectNulls={false}
                          />,
                        ];
                      }
                    }
                  })}
              </LineChart>
            </ResponsiveContainer>

            {/* Custom Legend - Positioned in top-left */}
            <div className="absolute top-8 left-25 bg-bg-primary/90 border border-border-primary rounded-sm p-3 backdrop-blur-sm pointer-events-none">
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
                        <span className="text-xs font-bold text-text-primary font-mono">
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
            <p className="text-center text-text-muted font-mono tracking-widest text-xs uppercase">
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
