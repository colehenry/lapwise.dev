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
  CHART_TYPOGRAPHY,
  CustomXAxisTickRace,
  RangeSelector,
} from "@/components/chart-primitives";
import { TrianglePattern } from "@/components/Patterns";
import MobileChartFrame from "@/components/ui/MobileChartFrame";
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
  defaultDataMode?: DataMode;
  showPointsPerRaceToggle?: boolean;
  // biome-ignore lint/suspicious/noExplicitAny: render prop data shape varies by entity type
  renderRaceTooltip: (data: any) => ReactNode;
}

interface SeasonEntry {
  year: number | string;
  team_name?: string;
  team_color?: string;
  championship_position?: number;
  total_points: number;
  race_count?: number;
  points_per_race?: number;
  prevPosition?: number;
  prevPoints?: number;
  prevPointsPerRace?: number;
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
  let pointsPerRaceChange = null;

  if (data.prevPosition !== undefined && data.championship_position) {
    positionChange = data.prevPosition - data.championship_position;
  }

  if (data.prevPoints !== undefined) {
    pointsChange = data.total_points - data.prevPoints;
  }

  if (
    data.points_per_race !== undefined &&
    data.prevPointsPerRace !== undefined
  ) {
    pointsPerRaceChange = data.points_per_race - data.prevPointsPerRace;
  }

  return (
    <div className="bg-bg-tertiary border border-border-primary rounded-sm p-3 shadow-xl">
      <p className={`${CHART_TYPOGRAPHY.tooltipTitleClassName} mb-2`}>
        {data.year}
      </p>
      <div className="space-y-1">
        {showTeam && (
          <p className={`${CHART_TYPOGRAPHY.tooltipValueClassName} text-sm`}>
            Team: {data.team_name}
          </p>
        )}
        <p className={`${CHART_TYPOGRAPHY.tooltipValueClassName} text-sm`}>
          Position:{" "}
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
        <p className={`${CHART_TYPOGRAPHY.tooltipValueClassName} text-sm`}>
          Points: {Math.round(data.total_points)}
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
                ? `+${Math.round(pointsChange)}`
                : pointsChange < 0
                  ? Math.round(pointsChange)
                  : "—"}
            </span>
          )}
        </p>
        {data.points_per_race !== undefined && (
          <p className={`${CHART_TYPOGRAPHY.tooltipValueClassName} text-sm`}>
            Points/Race: {data.points_per_race.toFixed(2)}
            {pointsPerRaceChange !== null && (
              <span
                className={`ml-2 font-semibold ${
                  pointsPerRaceChange > 0
                    ? "text-green-400"
                    : pointsPerRaceChange < 0
                      ? "text-red-400"
                      : "text-blue-400"
                }`}
              >
                {pointsPerRaceChange > 0
                  ? `+${pointsPerRaceChange.toFixed(2)}`
                  : pointsPerRaceChange < 0
                    ? pointsPerRaceChange.toFixed(2)
                    : "—"}
              </span>
            )}
          </p>
        )}
        {data.race_count !== undefined && (
          <p className={`${CHART_TYPOGRAPHY.tooltipValueClassName} text-sm`}>
            Starts: {data.race_count}
          </p>
        )}
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
  const [dataMode, setDataMode] = useState<DataMode>(
    config.defaultDataMode ?? "position",
  );
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
      const seasonsWithRates = historyData.seasons.map(
        // biome-ignore lint/suspicious/noExplicitAny: untyped API response
        (season: any) => ({
          ...season,
          points_per_race:
            season.race_count > 0
              ? season.total_points / season.race_count
              : undefined,
        }),
      );
      const enrichedSeasons = seasonsWithRates.map(
        // biome-ignore lint/suspicious/noExplicitAny: untyped API response
        (season: any, index: number) => {
          if (index === 0) return season;
          const prevSeason = seasonsWithRates[index - 1];
          return {
            ...season,
            prevPosition: prevSeason.championship_position,
            prevPoints: prevSeason.total_points,
            prevPointsPerRace: prevSeason.points_per_race,
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

  const switchToRaceMode = () => {
    setGraphMode("race");
    if (dataMode === "points_per_race") {
      setDataMode("points");
    }
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
          <span className={`relative z-10 ${CHART_TYPOGRAPHY.titleClassName}`}>
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
    dataMode === "position"
      ? "championship_position"
      : dataMode === "points_per_race"
        ? "points_per_race"
        : "total_points";
  const raceDataKey =
    dataMode === "position" ? config.racePositionKey : config.racePointsKey;
  const pointsLabel =
    dataMode === "points_per_race" ? "Points/Race" : "Total Points";

  const winningYears = new Set(
    (seasonData?.seasons ?? [])
      .filter((s: SeasonEntry) => s.championship_position === 1)
      .map((s: SeasonEntry) => s.year),
  );

  const CustomSeasonTick = ({
    x,
    y,
    payload,
  }: {
    x?: number;
    y?: number;
    payload?: { value: string | number };
  }) => (
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

  const CustomBarLabel = ({
    x = 0,
    y = 0,
    width = 0,
    value,
  }: {
    x?: number;
    y?: number;
    width?: number;
    value?: number;
  }) => {
    if (dataMode !== "position" || value !== 1) return null;
    return (
      <text x={x + width / 2} y={y + 18} textAnchor="middle" fontSize={13}>
        🏆
      </text>
    );
  };

  const yAxisLabel =
    dataMode === "position" ? config.positionLabel : pointsLabel;

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
        <span className={`relative z-10 ${CHART_TYPOGRAPHY.titleClassName}`}>
          Championship History
        </span>
      </div>
      <div className="min-w-0 p-3 md:p-6">
        {/* Single row of toggles */}
        <div className="mb-4 flex min-w-0 flex-col gap-2 md:mb-6 md:flex-row md:items-center md:justify-between md:flex-wrap">
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => setDataMode("position")}
              className={toggleClass(dataMode === "position")}
            >
              {config.positionLabel}
            </button>
            <button
              type="button"
              onClick={() =>
                setDataMode(
                  config.showPointsPerRaceToggle && graphMode === "season"
                    ? "points_per_race"
                    : "points",
                )
              }
              className={toggleClass(
                dataMode === "points" || dataMode === "points_per_race",
              )}
            >
              Total Points
            </button>
            {config.showPointsPerRaceToggle &&
              graphMode === "season" &&
              (dataMode === "points" || dataMode === "points_per_race") && (
                <label className="flex cursor-pointer items-center gap-1.5 px-2">
                  <input
                    type="checkbox"
                    checked={dataMode === "points_per_race"}
                    onChange={(e) =>
                      setDataMode(e.target.checked ? "points_per_race" : "points")
                    }
                    className="accent-purple-500"
                  />
                  <span className="text-xs font-bold font-mono uppercase tracking-widest text-text-secondary">
                    Points/Race
                  </span>
                </label>
              )}
          </div>

          <div className="grid grid-cols-2 gap-1 md:flex">
            <button
              type="button"
              onClick={() => setGraphMode("season")}
              className={toggleClass(graphMode === "season")}
            >
              By Season
            </button>
            <button
              type="button"
              onClick={switchToRaceMode}
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
          <>
            <div className="flex min-w-0 flex-row">
              <div className="flex w-4 shrink-0 items-center justify-center">
                <div className="-rotate-90 whitespace-nowrap">
                  <span className={CHART_TYPOGRAPHY.axisLabelClassName}>
                    {yAxisLabel}
                  </span>
                </div>
              </div>
              <div className="min-w-0 flex-grow">
                <MobileChartFrame height={400} logicalWidth={820}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={seasonData?.seasons}
                      margin={{ top: 10, right: 30, left: 0, bottom: 30 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={CHART_COLORS.borderPrimary}
                      />
                      <XAxis
                        dataKey="year"
                        tick={<CustomSeasonTick />}
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
                      />
                      <Tooltip content={<CustomTooltip />} cursor={false} />
                      <Bar
                        dataKey={seasonDataKey}
                        radius={[3, 3, 0, 0]}
                        activeBar={false}
                        label={<CustomBarLabel />}
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
                </MobileChartFrame>
              </div>
            </div>
            <div className="mt-2 flex flex-row">
              <div className="w-4 shrink-0" />
              <div className="flex-grow text-center">
                <span className={CHART_TYPOGRAPHY.axisLabelClassName}>
                  Season
                </span>
              </div>
            </div>
          </>
        )}

        {/* Race mode: Bar Chart with team colors */}
        {graphMode === "race" && (
          <>
            <div className="flex min-w-0 flex-row">
              <div className="flex w-4 shrink-0 items-center justify-center">
                <div className="-rotate-90 whitespace-nowrap">
                  <span className={CHART_TYPOGRAPHY.axisLabelClassName}>
                    {yAxisLabel}
                  </span>
                </div>
              </div>
              <div className="min-w-0 flex-grow">
                <MobileChartFrame height={400} logicalWidth={900}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={raceChartData}
                      margin={{ top: 10, right: 30, left: 0, bottom: 30 }}
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
                              key={`race-bar-${String(entry.year ?? "unknown")}-${String(entry.round ?? index)}-${String(entry.session_type ?? "race")}-${index}`}
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
                </MobileChartFrame>
              </div>
            </div>
            <div className="mt-2 flex flex-row">
              <div className="w-4 shrink-0" />
              <div className="flex-grow text-center">
                <span className={CHART_TYPOGRAPHY.axisLabelClassName}>
                  Round
                </span>
              </div>
            </div>
          </>
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
