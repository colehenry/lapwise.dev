"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CHART_COLORS,
  CustomActiveDot,
  CustomDot,
  CustomXAxisTickRace,
  CustomXAxisTickSeason,
  RangeSelector,
} from "@/components/chart-primitives";
import { apiHeaders, apiUrl } from "@/lib/api";

interface ConstructorSeasonHistory {
  year: number;
  championship_position: number | null;
  total_points: number;
  team_color: string | null;
}

interface ConstructorRaceHistory {
  year: number;
  round: number;
  race_name: string;
  best_position: number | null;
  total_points: number;
  driver_1_name: string | null;
  driver_1_position: number | null;
  driver_2_name: string | null;
  driver_2_position: number | null;
}

interface ConstructorRaceHistoryResponse {
  team_name: string;
  races: ConstructorRaceHistory[];
  available_years: number[];
}

interface ConstructorSeasonHistoryGraphProps {
  teamName: string;
}

type GraphMode = "season" | "race";
type DataMode = "position" | "points";

// Custom Tooltip Component
const CustomTooltip = ({ active, payload, graphMode }: any) => {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;

  if (graphMode === "season") {
    let positionChange = null;
    let pointsChange = null;

    if (data.prevPosition !== undefined && data.championship_position) {
      positionChange = data.prevPosition - data.championship_position;
    }

    if (data.prevPoints !== undefined) {
      pointsChange = data.total_points - data.prevPoints;
    }

    return (
      <div className="bg-bg-tertiary border border-border-primary rounded-lg p-3 shadow-xl">
        <p className="font-bold text-white mb-2">{data.year}</p>
        <div className="space-y-1">
          <p className="text-sm text-gray-300">
            <span className="font-semibold">Position:</span>{" "}
            {data.championship_position
              ? `P${data.championship_position}`
              : "N/A"}
            {positionChange !== null && (
              <span
                className={`ml-2 font-semibold ${
                  positionChange > 0
                    ? "text-green-400"
                    : positionChange < 0
                      ? "text-red-400"
                      : "text-blue-400"
                }`}
              >
                {positionChange > 0
                  ? `+${positionChange}`
                  : positionChange < 0
                    ? positionChange
                    : "—"}
              </span>
            )}
          </p>
          <p className="text-sm text-gray-300">
            <span className="font-semibold">Points:</span> {data.total_points}
            {pointsChange !== null && (
              <span
                className={`ml-2 font-semibold ${
                  pointsChange > 0
                    ? "text-green-400"
                    : pointsChange < 0
                      ? "text-red-400"
                      : "text-blue-400"
                }`}
              >
                {pointsChange > 0
                  ? `+${pointsChange.toFixed(1)}`
                  : pointsChange < 0
                    ? pointsChange.toFixed(1)
                    : "—"}
              </span>
            )}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-bg-tertiary border border-border-primary rounded-lg p-3 shadow-xl">
      <p className="font-bold text-white mb-2">{data.race_name || "Race"}</p>
      <div className="space-y-1">
        <p className="text-sm text-gray-300">
          <span className="font-semibold">Season:</span> {data.year || "N/A"} R
          {data.round || "?"}
        </p>
        <p className="text-sm text-gray-300">
          <span className="font-semibold">Best Position:</span>{" "}
          {data.best_position ? `P${data.best_position}` : "N/A"}
        </p>
        <p className="text-sm text-gray-300">
          <span className="font-semibold">Total Points:</span>{" "}
          {data.total_points?.toFixed(1) || "0"}
        </p>
        {data.driver_1_name && (
          <p className="text-sm text-gray-300">
            <span className="font-semibold">{data.driver_1_name}:</span>{" "}
            {data.driver_1_position ? `P${data.driver_1_position}` : "DNF"}
          </p>
        )}
        {data.driver_2_name && (
          <p className="text-sm text-gray-300">
            <span className="font-semibold">{data.driver_2_name}:</span>{" "}
            {data.driver_2_position ? `P${data.driver_2_position}` : "DNF"}
          </p>
        )}
      </div>
    </div>
  );
};

export default function ConstructorSeasonHistoryGraph({
  teamName,
}: ConstructorSeasonHistoryGraphProps) {
  const [graphMode, setGraphMode] = useState<GraphMode>("season");
  const [dataMode, setDataMode] = useState<DataMode>("position");
  const [showRangeSelector, setShowRangeSelector] = useState(false);
  const [yearRange, setYearRange] = useState<{
    start: number;
    end: number;
  } | null>(null);

  const { data: seasonData, isLoading: seasonLoading } = useQuery({
    queryKey: ["constructor-season-history", teamName],
    queryFn: async () => {
      const response = await fetch(
        apiUrl(`/api/constructors/${teamName}/season-history`),
        { headers: apiHeaders() },
      );
      const historyData = await response.json();
      const enrichedSeasons = historyData.seasons.map(
        (season: ConstructorSeasonHistory, index: number) => {
          if (index === 0) return season;
          const prevSeason = historyData.seasons[index - 1];
          return {
            ...season,
            prevPosition: prevSeason.championship_position,
            prevPoints: prevSeason.total_points,
          };
        },
      );
      return { ...historyData, seasons: enrichedSeasons };
    },
  });

  const { data: raceData, isLoading: raceLoading } = useQuery({
    queryKey: [
      "constructor-race-history",
      teamName,
      yearRange?.start,
      yearRange?.end,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (yearRange) {
        params.append("start_year", yearRange.start.toString());
        params.append("end_year", yearRange.end.toString());
      }
      const response = await fetch(
        apiUrl(`/api/constructors/${teamName}/race-history?${params}`),
        { headers: apiHeaders() },
      );
      return response.json() as Promise<ConstructorRaceHistoryResponse>;
    },
    enabled: graphMode === "race",
  });

  // Set default year range when race data first loads
  useEffect(() => {
    if (raceData && !yearRange && raceData.available_years.length > 0) {
      const endYear = raceData.available_years[0];
      const startYear = Math.max(
        endYear - 4,
        raceData.available_years[raceData.available_years.length - 1],
      );
      setYearRange({ start: startYear, end: endYear });
    }
  }, [raceData, yearRange]);

  const loading = graphMode === "season" ? seasonLoading : raceLoading;

  const handleRangeSelect = (start: number, end: number) => {
    setYearRange({ start, end });
  };

  if (loading) {
    return (
      <div className="bg-bg-tertiary border border-border-primary rounded-lg shadow-lg p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-bg-elevated rounded w-1/3 mb-4" />
          <div className="h-64 bg-bg-elevated rounded" />
        </div>
      </div>
    );
  }

  const currentData = graphMode === "season" ? seasonData : raceData;

  if (
    !currentData ||
    (graphMode === "season" && seasonData?.seasons.length === 0) ||
    (graphMode === "race" && raceData?.races.length === 0)
  ) {
    return (
      <div className="bg-bg-tertiary border border-border-primary rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-bold text-white mb-4">
          Championship History
        </h3>
        <p className="text-gray-400">No data available</p>
      </div>
    );
  }

  const chartData =
    graphMode === "season" ? seasonData?.seasons : raceData?.races;

  const raceChartData =
    graphMode === "race" && raceData
      ? raceData.races.map((race, index) => ({
          ...race,
          raceIndex: index,
          yearLabel: race.year.toString(),
          showYearLabel:
            index === 0 || race.year !== raceData.races[index - 1]?.year,
        }))
      : [];

  const finalChartData = graphMode === "season" ? chartData : raceChartData;

  const getLineColor = () => {
    if (graphMode === "season" && seasonData) {
      const latestSeason = seasonData.seasons[seasonData.seasons.length - 1];
      return latestSeason.team_color
        ? `#${latestSeason.team_color}`
        : CHART_COLORS.purple;
    }
    return CHART_COLORS.purple;
  };

  return (
    <div className="bg-bg-tertiary border border-border-primary rounded-lg shadow-lg p-6">
      {/* Header with Toggles */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">Championship History</h3>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setGraphMode("season")}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                graphMode === "season"
                  ? "bg-purple-500 text-white"
                  : "bg-bg-elevated text-gray-400 hover:bg-bg-elevated"
              }`}
            >
              By Season
            </button>
            <button
              type="button"
              onClick={() => setGraphMode("race")}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                graphMode === "race"
                  ? "bg-purple-500 text-white"
                  : "bg-bg-elevated text-gray-400 hover:bg-bg-elevated"
              }`}
            >
              By Race
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setDataMode("position")}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                dataMode === "position"
                  ? "bg-purple-500 text-white"
                  : "bg-bg-elevated text-gray-400 hover:bg-bg-elevated"
              }`}
            >
              Championship Position
            </button>
            <button
              type="button"
              onClick={() => setDataMode("points")}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                dataMode === "points"
                  ? "bg-purple-500 text-white"
                  : "bg-bg-elevated text-gray-400 hover:bg-bg-elevated"
              }`}
            >
              Total Points
            </button>
          </div>

          {graphMode === "race" && yearRange && raceData && (
            <button
              type="button"
              onClick={() => setShowRangeSelector(true)}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-bg-elevated text-gray-300 hover:bg-bg-elevated transition-all"
            >
              {yearRange.start} - {yearRange.end}
            </button>
          )}
        </div>
      </div>

      {/* Graph */}
      <ResponsiveContainer width="100%" height={400}>
        <LineChart
          data={finalChartData}
          margin={{ top: 10, right: 30, left: 10, bottom: 30 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={CHART_COLORS.borderPrimary}
          />
          <XAxis
            dataKey={graphMode === "season" ? "year" : "raceIndex"}
            tick={
              graphMode === "season" ? (
                <CustomXAxisTickSeason />
              ) : (
                <CustomXAxisTickRace />
              )
            }
            stroke={CHART_COLORS.textMuted}
            tickLine={false}
            interval={graphMode === "season" ? 0 : "preserveStart"}
          />
          <YAxis
            reversed={dataMode === "position"}
            domain={
              dataMode === "position"
                ? [1, (dataMax: number) => Math.max(dataMax, 10)]
                : [0, "auto"]
            }
            tick={{ fill: CHART_COLORS.textTertiary, fontSize: 12 }}
            stroke={CHART_COLORS.textMuted}
            tickLine={false}
            label={{
              value:
                dataMode === "position"
                  ? "Championship Position"
                  : "Total Points",
              angle: -90,
              position: "insideLeft",
              fill: CHART_COLORS.textTertiary,
              fontSize: 12,
            }}
          />
          <Tooltip content={<CustomTooltip graphMode={graphMode} />} />
          <Line
            type="monotone"
            dataKey={
              graphMode === "season"
                ? dataMode === "position"
                  ? "championship_position"
                  : "total_points"
                : dataMode === "position"
                  ? "best_position"
                  : "total_points"
            }
            stroke={getLineColor()}
            strokeWidth={3}
            dot={<CustomDot />}
            activeDot={<CustomActiveDot />}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Range Selector Modal */}
      {showRangeSelector && raceData && (
        <RangeSelector
          availableYears={raceData.available_years}
          currentStart={
            yearRange?.start ||
            raceData.available_years[raceData.available_years.length - 1]
          }
          currentEnd={yearRange?.end || raceData.available_years[0]}
          onRangeSelect={handleRangeSelect}
          onClose={() => setShowRangeSelector(false)}
        />
      )}
    </div>
  );
}
