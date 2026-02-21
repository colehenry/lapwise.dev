"use client";

import { useQuery } from "@tanstack/react-query";
import { type ReactNode, useEffect, useState } from "react";
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
import type { DataMode, GraphMode } from "@/lib/types";

export interface EntityHistoryConfig {
  entityType: "driver" | "constructor";
  entityId: string;
  apiBasePath: string; // "/api/drivers" | "/api/constructors"
  queryKeyPrefix: string; // "driver" | "constructor"
  positionLabel: string; // "Finishing Position" | "Championship Position"
  positionDomainMax: number; // 20 | 10
  racePositionKey: string; // "position" | "best_position"
  racePointsKey: string; // "points" | "total_points"
  showTeamInSeasonTooltip: boolean;
  renderRaceTooltip: (data: any) => ReactNode;
}

// Shared season tooltip content
function SeasonTooltipContent({
  data,
  showTeam,
}: {
  data: any;
  showTeam: boolean;
}) {
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
        {showTeam && (
          <p className="text-sm text-text-secondary">
            <span className="font-semibold">Team:</span> {data.team_name}
          </p>
        )}
        <p className="text-sm text-text-secondary">
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
        <p className="text-sm text-text-secondary">
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

export default function EntityHistoryGraph({
  config,
}: {
  config: EntityHistoryConfig;
}) {
  const [graphMode, setGraphMode] = useState<GraphMode>("season");
  const [dataMode, setDataMode] = useState<DataMode>("position");
  const [showRangeSelector, setShowRangeSelector] = useState(false);
  const [yearRange, setYearRange] = useState<{
    start: number;
    end: number;
  } | null>(null);

  const { data: seasonData, isLoading: seasonLoading } = useQuery({
    queryKey: [`${config.queryKeyPrefix}-season-history`, config.entityId],
    queryFn: async () => {
      const response = await fetch(
        apiUrl(`${config.apiBasePath}/${config.entityId}/season-history`),
        { headers: apiHeaders() },
      );
      const historyData = await response.json();
      const enrichedSeasons = historyData.seasons.map(
        (season: any, index: number) => {
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
      `${config.queryKeyPrefix}-race-history`,
      config.entityId,
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
        apiUrl(
          `${config.apiBasePath}/${config.entityId}/race-history?${params}`,
        ),
        { headers: apiHeaders() },
      );
      return response.json();
    },
    enabled: graphMode === "race",
  });

  // Set default year range when race data first loads
  useEffect(() => {
    if (raceData && !yearRange && raceData.available_years?.length > 0) {
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

  // Custom Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0].payload;

    if (graphMode === "season") {
      return (
        <SeasonTooltipContent
          data={data}
          showTeam={config.showTeamInSeasonTooltip}
        />
      );
    }

    return (
      <div className="bg-bg-tertiary border border-border-primary rounded-lg p-3 shadow-xl">
        {config.renderRaceTooltip(data)}
      </div>
    );
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
        <p className="text-text-tertiary">No data available</p>
      </div>
    );
  }

  const chartData =
    graphMode === "season" ? seasonData?.seasons : raceData?.races;

  const raceChartData =
    graphMode === "race" && raceData
      ? raceData.races.map((race: any, index: number) => ({
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

  const seasonDataKey =
    dataMode === "position" ? "championship_position" : "total_points";
  const raceDataKey =
    dataMode === "position" ? config.racePositionKey : config.racePointsKey;

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
                  : "bg-bg-elevated text-text-tertiary hover:bg-bg-elevated"
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
                  : "bg-bg-elevated text-text-tertiary hover:bg-bg-elevated"
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
                  : "bg-bg-elevated text-text-tertiary hover:bg-bg-elevated"
              }`}
            >
              {config.positionLabel}
            </button>
            <button
              type="button"
              onClick={() => setDataMode("points")}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                dataMode === "points"
                  ? "bg-purple-500 text-white"
                  : "bg-bg-elevated text-text-tertiary hover:bg-bg-elevated"
              }`}
            >
              Total Points
            </button>
          </div>

          {graphMode === "race" && yearRange && raceData && (
            <button
              type="button"
              onClick={() => setShowRangeSelector(true)}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-bg-elevated text-text-secondary hover:bg-bg-elevated transition-all"
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
                ? [
                    1,
                    (dataMax: number) =>
                      Math.max(dataMax, config.positionDomainMax),
                  ]
                : [0, "auto"]
            }
            tick={{ fill: CHART_COLORS.textTertiary, fontSize: 12 }}
            stroke={CHART_COLORS.textMuted}
            tickLine={false}
            label={{
              value:
                dataMode === "position" ? config.positionLabel : "Total Points",
              angle: -90,
              position: "insideLeft",
              fill: CHART_COLORS.textTertiary,
              fontSize: 12,
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey={graphMode === "season" ? seasonDataKey : raceDataKey}
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
