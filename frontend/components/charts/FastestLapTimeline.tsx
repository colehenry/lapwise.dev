"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import MobileChartFrame from "@/components/ui/MobileChartFrame";
import StableResponsiveContainer from "@/components/ui/StableResponsiveContainer";
import { DATA_FROM } from "@/lib/data-coverage";
import { STATUS_COLORS } from "@/lib/palette";
import { lapTimesQuery, raceSession } from "@/lib/queries/lapTimes";
import type { DriverLapTimes, TrackStatusEvent } from "@/lib/types";
import {
  CHART_AXIS_LABEL_STYLE,
  CHART_COLORS,
  CHART_TYPOGRAPHY,
} from "./chart-primitives";

interface FastestLapTimelineProps {
  season: number;
  round: number;
  isSprint?: boolean;
}

type TimelineEntry = {
  driverCode: string;
  fastestLapNumber: number;
  lapTime: number;
  teamColor: string;
};

type TimelinePoint = {
  lapNumber: number;
  y: number;
  entries: TimelineEntry[];
  isOverallFastest: boolean;
};

type AverageLapPoint = {
  lapNumber: number;
  averageLapTime: number | null;
  trendLapTime: number | null;
  sampleSize: number;
  rawSampleSize: number;
};

type TimelineTooltipPayload = {
  payload: TimelinePoint;
};

type AverageTooltipPayload = {
  payload: AverageLapPoint;
};

type EventBand = {
  startLap: number;
  endLap: number;
  status: string; // "4"=SC, "5"=Red, "6"=VSC
};

const AVG_EVENT_COLORS: Record<string, { color: string; label: string }> = {
  "4": { color: STATUS_COLORS.safetyCar, label: "SC" },
  "5": { color: STATUS_COLORS.red, label: "RED FLAG" },
  "6": { color: STATUS_COLORS.virtualSafetyCar, label: "VSC" },
};

// Convert track status events to lap-based event bands for the average chart.
function computeEventBands(
  trackStatusEvents: TrackStatusEvent[],
  drivers: DriverLapTimes[],
  totalLaps: number,
): EventBand[] {
  if (!trackStatusEvents.length || !drivers.length) return [];

  const sortedDrivers = [...drivers].sort(
    (a, b) => (a.final_position ?? 999) - (b.final_position ?? 999),
  );
  const leader = sortedDrivers.find((d) => d.laps.length > 0);
  if (!leader) return [];

  const lapStartTimes = leader.laps
    .filter((l) => l.lap_time_seconds != null)
    .sort((a, b) => a.lap_number - b.lap_number);

  const sessionTimeToLap = (sessionTime: number): number => {
    let cumulative = 0;
    for (const lap of lapStartTimes) {
      cumulative += lap.lap_time_seconds ?? 0;
      if (cumulative >= sessionTime) return lap.lap_number;
    }
    return lapStartTimes.length > 0
      ? lapStartTimes[lapStartTimes.length - 1].lap_number
      : 1;
  };

  const bands: EventBand[] = [];
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

  if (currentBand) {
    const startLap = sessionTimeToLap(currentBand.startTime);
    bands.push({
      startLap: Math.max(1, startLap - 0.5),
      endLap: totalLaps + 0.5,
      status: currentBand.status,
    });
  }

  return bands;
}

const TIMELINE_MARGIN = { top: 6, right: 20, left: 10, bottom: 22 };
const AVG_MARGIN = { top: 10, right: 20, left: 10, bottom: 8 };
const STACK_ROW_HEIGHT = 14;
const STACK_OFFSET = 24;
const LABEL_DESCENT = 4;
const formatTime = (s: number) => {
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem.toFixed(3).padStart(6, "0")}`;
};

const describeSample = (sampleSize: number, rawSampleSize: number) => {
  if (sampleSize === rawSampleSize) return `${sampleSize} drivers`;
  return `${sampleSize} of ${rawSampleSize} drivers`;
};

const buildArcPath = (
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number,
) => {
  const startRad = (startAngle - 90) * (Math.PI / 180);
  const endRad = (endAngle - 90) * (Math.PI / 180);
  const x1 = cx + radius * Math.cos(startRad);
  const y1 = cy + radius * Math.sin(startRad);
  const x2 = cx + radius * Math.cos(endRad);
  const y2 = cy + radius * Math.sin(endRad);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;

  return [
    `M ${cx} ${cy}`,
    `L ${x1} ${y1}`,
    `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
    "Z",
  ].join(" ");
};

const renderSharedLapMarker = (
  cx: number,
  cy: number,
  entries: TimelineEntry[],
  labelBaseY: number,
) => {
  if (entries.length === 1) {
    const entry = entries[0];
    const connectorEndY = labelBaseY + LABEL_DESCENT;
    return (
      <g>
        <line
          x1={cx}
          y1={cy}
          x2={cx}
          y2={connectorEndY}
          stroke={entry.teamColor}
          strokeOpacity={0.45}
          strokeWidth={1.5}
        />
        <circle
          cx={cx}
          cy={cy}
          r={5.5}
          fill={entry.teamColor}
          stroke={entry.teamColor}
          strokeWidth={1.5}
        />
        <text
          x={cx}
          y={labelBaseY}
          textAnchor="middle"
          fill={entry.teamColor}
          fontSize={10}
          fontFamily="monospace"
          fontWeight={700}
        >
          {entry.driverCode}
        </text>
      </g>
    );
  }

  const connectorEndY = labelBaseY + LABEL_DESCENT;
  const segmentHeight = (cy - connectorEndY) / entries.length;

  return (
    <g>
      {entries.map((entry, index) => {
        const startY = connectorEndY + index * segmentHeight;
        const endY = connectorEndY + (index + 1) * segmentHeight;
        const angleStart = (index / entries.length) * 360;
        const angleEnd = ((index + 1) / entries.length) * 360;

        return (
          <g key={`${entry.driverCode}-${index}`}>
            <line
              x1={cx}
              y1={startY}
              x2={cx}
              y2={endY}
              stroke={entry.teamColor}
              strokeWidth={2}
              strokeOpacity={0.75}
            />
            <path
              d={buildArcPath(cx, cy, 6.5, angleStart, angleEnd)}
              fill={entry.teamColor}
              stroke="none"
            />
            <text
              x={cx}
              y={labelBaseY - index * STACK_ROW_HEIGHT}
              textAnchor="middle"
              fill={entry.teamColor}
              fontSize={10}
              fontFamily="monospace"
              fontWeight={700}
            >
              {entry.driverCode}
            </text>
          </g>
        );
      })}
      <circle
        cx={cx}
        cy={cy}
        r={6.5}
        fill="none"
        stroke="rgba(255,255,255,0.14)"
        strokeWidth={1}
      />
    </g>
  );
};

const TimelineTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TimelineTooltipPayload[];
}) => {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="bg-bg-tertiary border border-border-primary rounded-sm p-2 shadow-lg text-xs">
      <p className={CHART_TYPOGRAPHY.tooltipTitleClassName}>
        Lap {point.lapNumber}
      </p>
      {point.entries.map((entry) => (
        <p
          key={`${entry.driverCode}-${entry.fastestLapNumber}`}
          className={CHART_TYPOGRAPHY.tooltipValueClassName}
          style={{ color: entry.teamColor }}
        >
          {entry.driverCode} · {formatTime(entry.lapTime)}
        </p>
      ))}
    </div>
  );
};

const AverageTooltip = ({
  active,
  payload,
  removeOutliers,
}: {
  active?: boolean;
  payload?: AverageTooltipPayload[];
  removeOutliers: boolean;
}) => {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point || point.averageLapTime == null) return null;

  return (
    <div className="bg-bg-tertiary border border-border-primary rounded-sm p-2 shadow-lg text-xs">
      <p className={CHART_TYPOGRAPHY.tooltipTitleClassName}>
        Lap {point.lapNumber}
      </p>
      <p className={CHART_TYPOGRAPHY.tooltipValueClassName}>
        Avg {formatTime(point.averageLapTime)}
      </p>
      <p className={CHART_TYPOGRAPHY.tooltipValueClassName}>
        {removeOutliers ? "Included" : "All"}:{" "}
        {describeSample(point.sampleSize, point.rawSampleSize)}
      </p>
    </div>
  );
};

const getFastestLapEntry = (driver: DriverLapTimes): TimelineEntry | null => {
  let bestLapTime = Number.POSITIVE_INFINITY;
  let bestLapNumber = 0;

  for (const lap of driver.laps) {
    if (lap.lap_time_seconds == null || lap.deleted) continue;
    if (lap.lap_time_seconds < bestLapTime) {
      bestLapTime = lap.lap_time_seconds;
      bestLapNumber = lap.lap_number;
    }
  }

  if (!Number.isFinite(bestLapTime) || bestLapNumber === 0) return null;

  return {
    driverCode: driver.driver_code ?? driver.full_name,
    fastestLapNumber: bestLapNumber,
    lapTime: bestLapTime,
    teamColor: driver.team_color
      ? `#${driver.team_color}`
      : "var(--delta-neutral)",
  };
};

export default function FastestLapTimeline({
  season,
  round,
  isSprint = false,
}: FastestLapTimelineProps) {
  const [removeOutliers, setRemoveOutliers] = useState(true);

  const { data, isLoading } = useQuery({
    ...lapTimesQuery({ season, round, session: raceSession(isSprint) }),
    enabled: season >= DATA_FROM.laps,
  });

  const {
    timelinePoints,
    averageLapPoints,
    totalLaps,
    maxSharedLapCount,
    overallFastestLapNumber,
  } = useMemo(() => {
    if (!data) {
      return {
        timelinePoints: [] as TimelinePoint[],
        averageLapPoints: [] as AverageLapPoint[],
        totalLaps: 0,
        maxSharedLapCount: 1,
        overallFastestLapNumber: null as number | null,
      };
    }

    const driversSorted = [...data.drivers].sort((a, b) => {
      const aPos = a.final_position ?? 99;
      const bPos = b.final_position ?? 99;
      return aPos - bPos;
    });

    let totalLaps = data.total_laps ?? 0;
    let fastestOverallLap = Number.POSITIVE_INFINITY;
    let overallFastestLapNumber: number | null = null;
    const timelineGroups = new Map<number, TimelineEntry[]>();
    const lapTimesByLap = new Map<number, number[]>();

    for (const driver of driversSorted) {
      const fastestEntry = getFastestLapEntry(driver);

      if (fastestEntry) {
        const existing =
          timelineGroups.get(fastestEntry.fastestLapNumber) ?? [];
        existing.push(fastestEntry);
        timelineGroups.set(fastestEntry.fastestLapNumber, existing);
      }

      for (const lap of driver.laps) {
        if (lap.lap_time_seconds == null || lap.deleted) continue;
        totalLaps = Math.max(totalLaps, lap.lap_number);
        if (lap.lap_time_seconds < fastestOverallLap) {
          fastestOverallLap = lap.lap_time_seconds;
          overallFastestLapNumber = lap.lap_number;
        }

        const existing = lapTimesByLap.get(lap.lap_number) ?? [];
        existing.push(lap.lap_time_seconds);
        lapTimesByLap.set(lap.lap_number, existing);
      }
    }

    const outlierThreshold = fastestOverallLap * 1.07;

    const timelinePoints = [...timelineGroups.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([lapNumber, entries]) => ({
        lapNumber,
        y: 0,
        entries,
        isOverallFastest: lapNumber === overallFastestLapNumber,
      }));

    const averageLapPoints: AverageLapPoint[] = [];
    for (let lapNumber = 1; lapNumber <= totalLaps; lapNumber += 1) {
      const rawTimes = lapTimesByLap.get(lapNumber) ?? [];
      const filteredTimes = removeOutliers
        ? rawTimes.filter((time) => time <= outlierThreshold)
        : rawTimes;

      averageLapPoints.push({
        lapNumber,
        averageLapTime:
          filteredTimes.length > 0
            ? filteredTimes.reduce((sum, time) => sum + time, 0) /
              filteredTimes.length
            : null,
        trendLapTime: null,
        sampleSize: filteredTimes.length,
        rawSampleSize: rawTimes.length,
      });
    }

    const validAveragePoints = averageLapPoints.filter(
      (point): point is AverageLapPoint & { averageLapTime: number } =>
        point.averageLapTime != null,
    );

    if (validAveragePoints.length >= 2) {
      const count = validAveragePoints.length;
      const sumX = validAveragePoints.reduce(
        (sum, point) => sum + point.lapNumber,
        0,
      );
      const sumY = validAveragePoints.reduce(
        (sum, point) => sum + point.averageLapTime,
        0,
      );
      const sumXY = validAveragePoints.reduce(
        (sum, point) => sum + point.lapNumber * point.averageLapTime,
        0,
      );
      const sumX2 = validAveragePoints.reduce(
        (sum, point) => sum + point.lapNumber * point.lapNumber,
        0,
      );
      const denominator = count * sumX2 - sumX * sumX;

      if (denominator !== 0) {
        const slope = (count * sumXY - sumX * sumY) / denominator;
        const intercept = (sumY - slope * sumX) / count;

        for (const point of averageLapPoints) {
          if (point.averageLapTime == null) continue;
          point.trendLapTime = intercept + slope * point.lapNumber;
        }
      }
    }

    const maxSharedLapCount = timelinePoints.reduce(
      (maxCount, point) => Math.max(maxCount, point.entries.length),
      1,
    );

    return {
      timelinePoints,
      averageLapPoints,
      totalLaps,
      maxSharedLapCount,
      overallFastestLapNumber,
    };
  }, [data, removeOutliers]);

  const eventBands = useMemo(() => {
    if (!data?.track_status_events?.length || totalLaps === 0) return [];
    return computeEventBands(data.track_status_events, data.drivers, totalLaps);
  }, [data, totalLaps]);

  if (season < DATA_FROM.laps) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-text-muted text-sm font-mono">
          Lap time data available from {DATA_FROM.laps} onwards.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="h-5 bg-bg-elevated rounded w-40 animate-pulse" />
        <div className="h-44 bg-bg-elevated rounded animate-pulse" />
        <div className="h-56 bg-bg-elevated rounded animate-pulse" />
      </div>
    );
  }

  if (!data || timelinePoints.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-text-muted text-sm font-mono">
          No lap data available.
        </p>
      </div>
    );
  }

  const timelineHeight = Math.max(
    88,
    56 + maxSharedLapCount * STACK_ROW_HEIGHT,
  );

  return (
    <div className="space-y-5">
      <p className="text-[10px] text-text-muted font-mono uppercase tracking-widest">
        Fastest lap by driver
      </p>

      <MobileChartFrame height={timelineHeight} logicalWidth={860}>
        <StableResponsiveContainer height="100%" initialHeight={timelineHeight}>
          <ScatterChart margin={TIMELINE_MARGIN}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={CHART_COLORS.borderPrimary}
              horizontal={false}
            />
            <XAxis
              type="number"
              dataKey="lapNumber"
              domain={[1, totalLaps]}
              tick={{ fill: CHART_COLORS.textTertiary, fontSize: 10 }}
              label={{
                value: "Lap",
                position: "insideBottom",
                offset: -8,
                textAnchor: "middle",
                style: CHART_AXIS_LABEL_STYLE,
              }}
            />
            <YAxis type="number" dataKey="y" domain={[0, 1]} hide />
            <Tooltip cursor={false} content={<TimelineTooltip />} />
            <ReferenceLine
              y={0}
              stroke={CHART_COLORS.borderPrimary}
              strokeWidth={1}
            />
            {overallFastestLapNumber != null && (
              <ReferenceLine
                x={overallFastestLapNumber}
                stroke={CHART_COLORS.textMuted}
                strokeDasharray="3 3"
                strokeWidth={1}
                label={{
                  value: "Overall fastest",
                  position: "insideTop",
                  offset: 2,
                  style: { fill: CHART_COLORS.textMuted, fontSize: 9 },
                }}
              />
            )}
            <Scatter
              data={timelinePoints}
              shape={(props: {
                cx?: number;
                cy?: number;
                payload?: TimelinePoint;
              }) => {
                const { cx, cy, payload } = props;
                if (!cx || !cy || !payload) return null;

                return renderSharedLapMarker(
                  cx,
                  cy,
                  payload.entries,
                  cy -
                    (payload.isOverallFastest
                      ? STACK_OFFSET + 12
                      : STACK_OFFSET),
                );
              }}
            />
          </ScatterChart>
        </StableResponsiveContainer>
      </MobileChartFrame>

      <div className="flex items-center justify-between gap-4">
        <p className="text-[10px] text-text-muted font-mono uppercase tracking-widest">
          Average lap time by lap
        </p>
        <button
          type="button"
          aria-pressed={removeOutliers}
          onClick={() => setRemoveOutliers((value) => !value)}
          className={`px-3 py-1.5 rounded-sm text-[10px] font-bold font-mono uppercase tracking-widest border transition-colors duration-150 ${
            removeOutliers
              ? "border-purple-500 bg-purple-500/15 text-purple-300"
              : "border-border-primary text-text-muted hover:text-text-secondary"
          }`}
        >
          Remove outliers
        </button>
      </div>

      <MobileChartFrame height={224} logicalWidth={860}>
        <StableResponsiveContainer height="100%" initialHeight={224}>
          <LineChart data={averageLapPoints} margin={AVG_MARGIN}>
            {/* Track event bands — colored area + boundary lines */}
            {eventBands.flatMap((band, bandIndex) => {
              const style = AVG_EVENT_COLORS[band.status];
              if (!style) return [];
              const keyBase = `${band.status}-${band.startLap}-${band.endLap}-${bandIndex}`;
              return [
                <ReferenceArea
                  key={`avg-area-${keyBase}`}
                  x1={band.startLap}
                  x2={band.endLap}
                  fill={style.color}
                  fillOpacity={0.08}
                  stroke="none"
                  label={{
                    value: style.label,
                    position: "insideBottom",
                    fill: style.color,
                    fontSize: 8,
                    fontWeight: "bold",
                  }}
                />,
                <ReferenceLine
                  key={`avg-s-${keyBase}`}
                  x={band.startLap}
                  stroke={style.color}
                  strokeDasharray="4 3"
                  strokeOpacity={0.4}
                />,
                band.startLap !== band.endLap ? (
                  <ReferenceLine
                    key={`avg-e-${keyBase}`}
                    x={band.endLap}
                    stroke={style.color}
                    strokeDasharray="4 3"
                    strokeOpacity={0.4}
                  />
                ) : null,
              ];
            })}
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={CHART_COLORS.borderPrimary}
              vertical={false}
            />
            <XAxis
              dataKey="lapNumber"
              type="number"
              domain={[1, totalLaps]}
              tick={{ fill: CHART_COLORS.textTertiary, fontSize: 10 }}
            />
            <YAxis
              type="number"
              domain={["dataMin", "dataMax"]}
              tick={{ fill: CHART_COLORS.textTertiary, fontSize: 10 }}
              tickFormatter={(value: number) => formatTime(value)}
              width={66}
            />
            <Tooltip
              cursor={{
                stroke: CHART_COLORS.textMuted,
                strokeDasharray: "3 3",
              }}
              content={<AverageTooltip removeOutliers={removeOutliers} />}
            />
            <Line
              type="monotone"
              dataKey="trendLapTime"
              stroke={CHART_COLORS.purple}
              strokeWidth={1.5}
              strokeOpacity={0.4}
              strokeDasharray="5 5"
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="averageLapTime"
              stroke={CHART_COLORS.purple}
              strokeWidth={2}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          </LineChart>
        </StableResponsiveContainer>
      </MobileChartFrame>
    </div>
  );
}
