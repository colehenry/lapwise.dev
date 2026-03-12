"use client";

import { useQuery } from "@tanstack/react-query";
import { type ReactNode, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CHART_COLORS,
  CustomXAxisTickRace,
  CustomXAxisTickSeason,
  RangeSelector,
} from "@/components/chart-primitives";
import { TrianglePattern } from "@/components/Patterns";
import Skeleton from "@/components/ui/Skeleton";
import { apiHeaders, apiUrl } from "@/lib/api";
import type { DataMode, GraphMode } from "@/lib/types";

export interface EntityHistoryConfig {
  entityType: "driver" | "constructor";
  entityId: string;
  apiBasePath: string;
  queryKeyPrefix: string;
  positionLabel: string;
  positionDomainMax: number;
  racePositionKey: string;
  racePointsKey: string;
  showTeamInSeasonTooltip: boolean;
  // biome-ignore lint/suspicious/noExplicitAny: render prop data shape varies by entity type
  renderRaceTooltip: (data: any) => ReactNode;
}

interface SeasonEntry {
  year: number | string;
  team_name?: string;
  team_color?: string;
  championship_position?: number;
  total_points: number;
  prevPosition?: number;
  prevPoints?: number;
}

function SeasonTooltipContent({
  data,
  showTeam,
}: {
  data: SeasonEntry;
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
    <div className="bg-bg-tertiary border border-border-primary rounded-sm p-3 shadow-xl">
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
        // biome-ignore lint/suspicious/noExplicitAny: untyped API response
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

  interface TooltipProps {
    active?: boolean;
    payload?: Array<{ payload: SeasonEntry | Record<string, unknown> }>;
  }
  const CustomTooltip = ({ active, payload }: TooltipProps) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0].payload;

    if (graphMode === "season") {
      return (
        <SeasonTooltipContent
          data={data as SeasonEntry}
          showTeam={config.showTeamInSeasonTooltip}
        />
      );
    }

    return (
      <div className="bg-bg-tertiary border border-border-primary rounded-sm p-3 shadow-xl">
        {config.renderRaceTooltip(data)}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="bg-bg-tertiary border border-border-primary rounded-sm shadow-sm p-6">
        <Skeleton variant="text" width="33%" height="24px" className="mb-4" />
        <Skeleton variant="rectangular" height="256px" />
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
      <div className="bg-bg-tertiary border border-border-primary rounded-sm shadow-sm overflow-hidden">
        <div className="relative h-10 bg-bg-primary border-b border-border-primary px-4 flex items-center overflow-hidden">
          <TrianglePattern id="championship-history-empty-triangles" />
          <span className="relative z-10 text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono">
            Championship History
          </span>
        </div>
        <div className="p-6">
          <p className="text-text-tertiary">No data available</p>
        </div>
      </div>
    );
  }

  const raceChartData =
    graphMode === "race" && raceData
      ? raceData.races.map((race: Record<string, unknown>, index: number) => ({
          ...race,
          raceIndex: index,
          yearLabel: String(race.year),
          showYearLabel:
            index === 0 || race.year !== raceData.races[index - 1]?.year,
        }))
      : [];

  const seasonDataKey =
    dataMode === "position" ? "championship_position" : "total_points";
  const raceDataKey =
    dataMode === "position" ? config.racePositionKey : config.racePointsKey;

  const toggleClass = (active: boolean) =>
    `px-3 py-1.5 rounded-sm text-xs font-bold font-mono uppercase tracking-widest transition-colors duration-150 ${
      active
        ? "bg-purple-500/20 border border-purple-500 text-purple-300"
        : "border border-transparent text-text-muted hover:text-text-secondary"
    }`;

  return (
    <div className="bg-bg-tertiary border border-border-primary rounded-sm shadow-sm overflow-hidden">
      <div className="relative h-10 bg-bg-primary border-b border-border-primary px-4 flex items-center overflow-hidden">
        <TrianglePattern id="championship-history-triangles" />
        <span className="relative z-10 text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono">
          Championship History
        </span>
      </div>
      <div className="p-6">
        {/* Single row of toggles */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setDataMode("position")}
              className={toggleClass(dataMode === "position")}
            >
              {config.positionLabel}
            </button>
            <button
              type="button"
              onClick={() => setDataMode("points")}
              className={toggleClass(dataMode === "points")}
            >
              Total Points
            </button>
          </div>

          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setGraphMode("season")}
              className={toggleClass(graphMode === "season")}
            >
              By Season
            </button>
            <button
              type="button"
              onClick={() => setGraphMode("race")}
              className={toggleClass(graphMode === "race")}
            >
              By Race
            </button>
            {graphMode === "race" && yearRange && raceData && (
              <button
                type="button"
                onClick={() => setShowRangeSelector(true)}
                className="px-3 py-1.5 rounded-sm text-xs font-bold font-mono uppercase tracking-widest transition-colors duration-150 border border-border-secondary text-text-secondary hover:border-purple-500 hover:text-purple-300"
              >
                {yearRange.start} - {yearRange.end}
              </button>
            )}
          </div>
        </div>

        {/* Season mode: Bar Chart */}
        {graphMode === "season" && (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart
              data={seasonData?.seasons}
              margin={{ top: 10, right: 30, left: 10, bottom: 30 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={CHART_COLORS.borderPrimary}
              />
              <XAxis
                dataKey="year"
                tick={<CustomXAxisTickSeason />}
                stroke={CHART_COLORS.textMuted}
                tickLine={false}
                interval={Math.max(
                  0,
                  Math.ceil((seasonData?.seasons?.length ?? 0) / 15) - 1,
                )}
              />
              <YAxis
                reversed={dataMode === "position"}
                domain={
                  dataMode === "position"
                    ? [
                        0,
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
                    dataMode === "position"
                      ? config.positionLabel
                      : "Total Points",
                  angle: -90,
                  position: "insideLeft",
                  fill: CHART_COLORS.textTertiary,
                  fontSize: 12,
                }}
              />
              <Tooltip content={<CustomTooltip />} cursor={false} />
              <Bar
                dataKey={seasonDataKey}
                radius={[3, 3, 0, 0]}
                activeBar={false}
              >
                {(seasonData?.seasons ?? []).map(
                  (entry: SeasonEntry, index: number) => (
                    <Cell
                      key={`bar-${entry.year}-${index}`}
                      fill={
                        entry.team_color
                          ? `#${entry.team_color}`
                          : CHART_COLORS.purple
                      }
                    />
                  ),
                )}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}

        {/* Race mode: Bar Chart with team colors */}
        {graphMode === "race" && (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart
              data={raceChartData}
              margin={{ top: 10, right: 30, left: 10, bottom: 30 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={CHART_COLORS.borderPrimary}
              />
              <XAxis
                dataKey="raceIndex"
                tick={<CustomXAxisTickRace />}
                stroke={CHART_COLORS.textMuted}
                tickLine={false}
                interval="preserveStart"
              />
              <YAxis
                reversed={dataMode === "position"}
                domain={
                  dataMode === "position"
                    ? [
                        0,
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
                    dataMode === "position"
                      ? config.positionLabel
                      : "Total Points",
                  angle: -90,
                  position: "insideLeft",
                  fill: CHART_COLORS.textTertiary,
                  fontSize: 12,
                }}
              />
              <Tooltip content={<CustomTooltip />} cursor={false} />
              <Bar
                dataKey={raceDataKey}
                radius={[3, 3, 0, 0]}
                activeBar={false}
              >
                {raceChartData.map(
                  (entry: Record<string, unknown>, index: number) => (
                    <Cell
                      key={`race-bar-${index}`}
                      fill={
                        entry.team_color
                          ? `#${entry.team_color}`
                          : CHART_COLORS.purple
                      }
                    />
                  ),
                )}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}

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
    </div>
  );
}
