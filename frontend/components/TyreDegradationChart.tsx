"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CHART_AXIS_LABEL_STYLE,
  CHART_COLORS,
  CHART_TYPOGRAPHY,
} from "@/components/chart-primitives";
import MobileChartFrame from "@/components/ui/MobileChartFrame";
import StableResponsiveContainer from "@/components/ui/StableResponsiveContainer";
import { apiHeaders, apiUrl } from "@/lib/api";
import {
  type DriverLapTimes,
  driverKey,
  type LapData,
  type LapTimesResponse,
  type TrackStatusEvent,
} from "@/lib/types";

interface TyreDegradationChartProps {
  season: number;
  round: number;
  isSprint?: boolean;
  initialDrivers?: string[];
}

import { COMPOUND_COLORS } from "@/lib/palette";

const MIN_CLEAN_BASELINE_LAPS = 2;
const MIN_COMPOUND_SAMPLES = 6;
const FIT_WINDOW = 5;

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
        {formatDelta(payload?.value ?? null)}
      </text>
    </g>
  );
};

interface DegradationTooltipEntry {
  dataKey: string;
  value: number;
  color: string;
  name: string;
  payload?: CleanSample | CurveDataPoint;
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

  const sample = payload
    .map((entry) => entry.payload)
    .find((entry): entry is CleanSample => isCleanSample(entry));

  return (
    <div className="bg-bg-tertiary border border-border-primary rounded-lg p-3 shadow-xl">
      <p className={`${CHART_TYPOGRAPHY.tooltipTitleClassName} mb-1 text-sm`}>
        Tyre Age: {label} {label === 1 ? "lap" : "laps"}
      </p>
      {sample ? (
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: sample.color }}
            />
            <span className={CHART_TYPOGRAPHY.tooltipValueClassName}>
              {sample.compound}
            </span>
            <span
              className={`${CHART_TYPOGRAPHY.tooltipValueClassName} ml-auto`}
            >
              {formatDelta(sample.pace_delta)}
            </span>
          </div>
          <p className={CHART_TYPOGRAPHY.tooltipValueClassName}>
            {sample.driverCode} · stint {sample.stintLabel} · lap{" "}
            {sample.lapNumber}
          </p>
          <p className={CHART_TYPOGRAPHY.tooltipValueClassName}>
            raw {formatLapTime(sample.lap_time)}
          </p>
        </div>
      ) : (
        payload
          .filter((entry) => entry.dataKey.endsWith("_fit"))
          .map((entry: DegradationTooltipEntry) => (
            <div
              key={entry.dataKey}
              className="flex items-center gap-2 text-xs"
            >
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className={CHART_TYPOGRAPHY.tooltipValueClassName}>
                {entry.name.replace(" fit", "")}
              </span>
              <span
                className={`${CHART_TYPOGRAPHY.tooltipValueClassName} ml-auto`}
              >
                {formatDelta(entry.value)}
              </span>
            </div>
          ))
      )}
    </div>
  );
};

type StatusBand = {
  startLap: number;
  endLap: number;
  status: string;
};

type CleanSample = {
  tyre_life: number;
  lap_time: number;
  pace_delta: number;
  compound: string;
  color: string;
  driverCode: string;
  stintLabel: string;
  lapNumber: number;
};

type CurveDataPoint = {
  tyre_life: number;
  [key: string]: number | null | undefined;
};

type CompoundSummary = {
  compound: string;
  color: string;
  sampleCount: number;
  peakLap: number | null;
  peakDelta: number | null;
  falloffLap: number | null;
  postFalloffSlope: number | null;
  plusOneLap: number | null;
};

const formatLapTime = (seconds: number | null): string => {
  if (seconds === null) return "-";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toFixed(3).padStart(6, "0")}`;
};

const formatDelta = (seconds: number | null): string => {
  if (seconds === null) return "-";
  const sign = seconds > 0 ? "+" : "";
  return `${sign}${seconds.toFixed(2)}s`;
};

const median = (values: number[]): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2;
  return sorted[mid];
};

const isCleanSample = (
  payload: CleanSample | CurveDataPoint | undefined,
): payload is CleanSample =>
  Boolean(
    payload &&
      typeof (payload as CleanSample).driverCode === "string" &&
      typeof (payload as CleanSample).color === "string" &&
      typeof (payload as CleanSample).pace_delta === "number",
  );

function computeStatusBands(
  trackStatusEvents: TrackStatusEvent[],
  drivers: DriverLapTimes[],
  totalLaps: number | null,
): StatusBand[] {
  if (!trackStatusEvents.length || !drivers.length) return [];

  const leader = [...drivers]
    .sort((a, b) => (a.final_position || 999) - (b.final_position || 999))
    .find((driver) => driver.laps.length > 0);
  if (!leader) return [];

  const lapStartTimes = leader.laps
    .filter((lap) => lap.lap_time_seconds != null)
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

function isNeutralizedLap(lap: LapData, statusBands: StatusBand[]): boolean {
  if (["4", "5", "6", "7"].includes(lap.track_status ?? "")) return true;
  return statusBands.some(
    (band) =>
      lap.lap_number >= band.startLap - 1 && lap.lap_number <= band.endLap + 1,
  );
}

function hasImpliedPit(lap: LapData, prevLap: LapData | null): boolean {
  if (!prevLap) return false;
  if (lap.compound && prevLap.compound && lap.compound !== prevLap.compound)
    return true;
  return (
    lap.tyre_life != null &&
    prevLap.tyre_life != null &&
    lap.tyre_life < prevLap.tyre_life
  );
}

function isStatisticalOutlier(lapTime: number, lapTimes: number[]): boolean {
  const center = median(lapTimes);
  if (center == null) return false;
  const deviations = lapTimes.map((time) => Math.abs(time - center));
  const mad = median(deviations) ?? 0;
  const threshold = mad > 0 ? center + mad * 4 : center * 1.04;
  return lapTime > threshold;
}

function smoothBinnedSamples(samples: CleanSample[]) {
  const byAge = new Map<number, number[]>();
  for (const sample of samples) {
    const values = byAge.get(sample.tyre_life) ?? [];
    values.push(sample.pace_delta);
    byAge.set(sample.tyre_life, values);
  }

  const binned = Array.from(byAge.entries())
    .map(([tyreLife, values]) => ({
      tyreLife,
      medianDelta: median(values) ?? 0,
      count: values.length,
    }))
    .filter((point) => point.count >= 2)
    .sort((a, b) => a.tyreLife - b.tyreLife);

  return binned.map((point, index) => {
    const start = Math.max(0, index - Math.floor(FIT_WINDOW / 2));
    const end = Math.min(binned.length, index + Math.ceil(FIT_WINDOW / 2));
    const window = binned.slice(start, end);
    const weightedSum = window.reduce(
      (sum, current) => sum + current.medianDelta * current.count,
      0,
    );
    const weight = window.reduce((sum, current) => sum + current.count, 0);
    return {
      tyreLife: point.tyreLife,
      fitDelta: weight > 0 ? weightedSum / weight : point.medianDelta,
      medianDelta: point.medianDelta,
      count: point.count,
    };
  });
}

export default function TyreDegradationChart({
  season,
  round,
  isSprint = false,
  initialDrivers,
}: TyreDegradationChartProps) {
  const [selectedCompounds, setSelectedCompounds] = useState<string[]>([]);
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>([]);
  const [showDriverDropdown, setShowDriverDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const initialDriverKey = initialDrivers?.join(",") ?? "";

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
      const available = new Set(sorted.map((d) => driverKey(d)));
      const requested = initialDriverKey
        .split(",")
        .filter((key) => available.has(key));
      setSelectedDrivers(
        requested.length > 0
          ? requested
          : sorted.slice(0, 3).map((d) => driverKey(d)),
      );
    }
  }, [data, initialDriverKey]);

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

  const statusBands = useMemo(() => {
    if (!data) return [];
    return computeStatusBands(
      data.track_status_events || [],
      data.drivers,
      data.total_laps ?? null,
    );
  }, [data]);

  // Build clean, stint-normalized samples and fitted compound curves.
  const chartData = useMemo(() => {
    if (!data)
      return {
        data: [] as CurveDataPoint[],
        lineKeys: [] as string[],
        samplesByCompound: {} as Record<string, CleanSample[]>,
        summaries: [] as CompoundSummary[],
      };

    const filteredDrivers = data.drivers.filter((d) =>
      selectedDrivers.includes(driverKey(d)),
    );

    const samplesByCompound: Record<string, CleanSample[]> = {};

    for (const driver of filteredDrivers) {
      const sortedLaps = [...driver.laps].sort(
        (a, b) => a.lap_number - b.lap_number,
      );
      const stints = new Map<string, LapData[]>();
      let inferredStint = 1;

      for (let index = 0; index < sortedLaps.length; index++) {
        const lap = sortedLaps[index];
        const prevLap = index > 0 ? sortedLaps[index - 1] : null;
        if (hasImpliedPit(lap, prevLap)) inferredStint += 1;

        const stintLabel = String(lap.stint ?? inferredStint);
        const laps = stints.get(stintLabel) ?? [];
        laps.push(lap);
        stints.set(stintLabel, laps);
      }

      for (const [stintLabel, stintLaps] of stints) {
        const sortedStint = [...stintLaps].sort(
          (a, b) => a.lap_number - b.lap_number,
        );
        const firstLapNumber = sortedStint[0]?.lap_number;

        const preliminary = sortedStint.filter((lap, index) => {
          const prevLap = index > 0 ? sortedStint[index - 1] : null;
          return (
            lap.compound &&
            selectedCompounds.includes(lap.compound) &&
            lap.tyre_life != null &&
            lap.lap_time_seconds != null &&
            !lap.deleted &&
            lap.lap_number !== 1 &&
            lap.lap_number !== firstLapNumber &&
            !(
              lap.pit_duration_seconds != null && lap.pit_duration_seconds > 0
            ) &&
            !hasImpliedPit(lap, prevLap) &&
            !isNeutralizedLap(lap, statusBands)
          );
        });

        if (preliminary.length < MIN_CLEAN_BASELINE_LAPS + 1) continue;

        const lapTimes = preliminary.map(
          (lap) => lap.lap_time_seconds as number,
        );
        const clean = preliminary.filter(
          (lap) =>
            !isStatisticalOutlier(lap.lap_time_seconds as number, lapTimes),
        );

        if (clean.length < MIN_CLEAN_BASELINE_LAPS + 1) continue;

        const baselineLaps = clean
          .slice(0, Math.max(MIN_CLEAN_BASELINE_LAPS, 3))
          .map((lap) => lap.lap_time_seconds as number);
        const baseline = median(baselineLaps);
        if (baseline == null) continue;

        const compound = clean[0]?.compound;
        if (!compound) continue;

        for (const lap of clean) {
          if (
            !lap.compound ||
            lap.compound !== compound ||
            lap.tyre_life == null ||
            lap.lap_time_seconds == null
          ) {
            continue;
          }

          const sample: CleanSample = {
            tyre_life: lap.tyre_life,
            lap_time: lap.lap_time_seconds,
            pace_delta: lap.lap_time_seconds - baseline,
            compound: lap.compound,
            color: COMPOUND_COLORS[lap.compound] || "var(--delta-neutral)",
            driverCode: driverKey(driver),
            stintLabel,
            lapNumber: lap.lap_number,
          };
          const samples = samplesByCompound[lap.compound] ?? [];
          samples.push(sample);
          samplesByCompound[lap.compound] = samples;
        }
      }
    }

    const allTyreLives = new Set<number>();
    const lineKeys = Object.keys(samplesByCompound).filter(
      (compound) => samplesByCompound[compound].length >= MIN_COMPOUND_SAMPLES,
    );
    const fittedByCompound = new Map<
      string,
      ReturnType<typeof smoothBinnedSamples>
    >();

    for (const compound of lineKeys) {
      const fitted = smoothBinnedSamples(samplesByCompound[compound]);
      fittedByCompound.set(compound, fitted);
      for (const point of fitted) allTyreLives.add(point.tyreLife);
    }

    const sortedLives = Array.from(allTyreLives).sort((a, b) => a - b);
    const points: CurveDataPoint[] = sortedLives.map((life) => {
      const point: CurveDataPoint = { tyre_life: life };

      for (const compound of lineKeys) {
        const fitted = fittedByCompound
          .get(compound)
          ?.find((candidate) => candidate.tyreLife === life);
        if (!fitted) continue;
        point[`${compound}_fit`] = fitted.fitDelta;
        point[`${compound}_median`] = fitted.medianDelta;
      }

      return point;
    });

    const summaries = lineKeys.map((compound): CompoundSummary => {
      const fitted = fittedByCompound.get(compound) ?? [];
      const color = COMPOUND_COLORS[compound] || "var(--delta-neutral)";
      const sampleCount = samplesByCompound[compound]?.length ?? 0;
      if (fitted.length === 0) {
        return {
          compound,
          color,
          sampleCount,
          peakLap: null,
          peakDelta: null,
          falloffLap: null,
          postFalloffSlope: null,
          plusOneLap: null,
        };
      }

      const peak = fitted.reduce((best, current) =>
        current.fitDelta < best.fitDelta ? current : best,
      );
      const falloff = fitted.find(
        (point) =>
          point.tyreLife > peak.tyreLife &&
          point.fitDelta >= peak.fitDelta + 0.3,
      );
      const plusOne = fitted.find((point) => point.fitDelta >= 1);
      const slopeStart = falloff ?? peak;
      const slopePoints = fitted.filter(
        (point) => point.tyreLife >= slopeStart.tyreLife,
      );
      let postFalloffSlope: number | null = null;
      if (slopePoints.length >= 2) {
        const first = slopePoints[0];
        const last = slopePoints[slopePoints.length - 1];
        const lapSpan = last.tyreLife - first.tyreLife;
        if (lapSpan > 0) {
          postFalloffSlope = (last.fitDelta - first.fitDelta) / lapSpan;
        }
      }

      return {
        compound,
        color,
        sampleCount,
        peakLap: peak.tyreLife,
        peakDelta: peak.fitDelta,
        falloffLap: falloff?.tyreLife ?? null,
        postFalloffSlope,
        plusOneLap: plusOne?.tyreLife ?? null,
      };
    });

    return {
      data: points,
      lineKeys,
      samplesByCompound,
      summaries,
    };
  }, [data, selectedDrivers, selectedCompounds, statusBands]);

  // Y-axis domain
  const yDomain = useMemo((): [number, number] => {
    if (chartData.data.length === 0) return [120, 80];

    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;

    for (const point of chartData.data) {
      for (const key of chartData.lineKeys) {
        const val = point[`${key}_fit`];
        if (val != null && typeof val === "number") {
          min = Math.min(min, val);
          max = Math.max(max, val);
        }
      }
    }

    if (!Number.isFinite(min) || !Number.isFinite(max)) return [2, -1];
    const padding = (max - min) * 0.1;
    return [Math.max(max + padding, 1), Math.min(min - padding, -0.5)];
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
        <div>
          <h3 className={CHART_TYPOGRAPHY.titleClassName}>
            {data.event_name.replace("Grand Prix", "GP")} - Tyre Degradation
          </h3>
          <p className="text-[10px] text-text-muted font-mono uppercase tracking-widest mt-1">
            clean laps only · dots = stint-normalized laps · line = fitted
            compound curve
          </p>
        </div>

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
                  color: COMPOUND_COLORS[compound] || "var(--delta-neutral)",
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
                    key={driverKey(driver)}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-bg-elevated cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedDrivers.includes(driverKey(driver))}
                      onChange={() => {
                        const dk = driverKey(driver);
                        setSelectedDrivers((prev) =>
                          prev.includes(dk)
                            ? prev.filter((d) => d !== dk)
                            : [...prev, dk],
                        );
                      }}
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
                          : "var(--delta-neutral)",
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

      {chartData.summaries.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {chartData.summaries.map((summary) => (
            <div
              key={summary.compound}
              className="border border-border-primary rounded-sm p-3 bg-bg-tertiary/40"
            >
              <div className="flex items-center justify-between gap-2">
                <p
                  className="text-xs font-bold font-mono uppercase"
                  style={{ color: summary.color }}
                >
                  {summary.compound}
                </p>
                <p className="text-[10px] text-text-muted font-mono">
                  {summary.sampleCount} laps
                </p>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2 text-[10px] font-mono">
                <span className="text-text-muted">Peak</span>
                <span className="text-text-primary text-right">
                  {summary.peakLap != null
                    ? `lap ${summary.peakLap} (${formatDelta(summary.peakDelta)})`
                    : "-"}
                </span>
                <span className="text-text-muted">Falloff</span>
                <span className="text-text-primary text-right">
                  {summary.falloffLap != null
                    ? `lap ${summary.falloffLap}`
                    : "-"}
                </span>
                <span className="text-text-muted">Deg/lap</span>
                <span className="text-text-primary text-right">
                  {summary.postFalloffSlope != null
                    ? formatDelta(summary.postFalloffSlope)
                    : "-"}
                </span>
                <span className="text-text-muted">+1.0s</span>
                <span className="text-text-primary text-right">
                  {summary.plusOneLap != null
                    ? `lap ${summary.plusOneLap}`
                    : "-"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Chart */}
      <div className="relative" style={{ minHeight: "300px" }}>
        {chartData.data.length > 0 ? (
          <MobileChartFrame height={300} logicalWidth={860}>
            <StableResponsiveContainer height={300}>
              <ComposedChart
                data={chartData.data}
                margin={{ top: 10, right: 20, left: 60, bottom: 30 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={CHART_COLORS.borderPrimary}
                />
                <XAxis
                  dataKey="tyre_life"
                  type="number"
                  allowDecimals={false}
                  stroke={CHART_COLORS.textTertiary}
                  label={{
                    value: "Tyre Age (laps)",
                    position: "insideBottom",
                    offset: -20,
                    style: CHART_AXIS_LABEL_STYLE,
                  }}
                  tick={{ fill: CHART_COLORS.textTertiary, fontSize: 11 }}
                />
                <YAxis
                  stroke={CHART_COLORS.textTertiary}
                  label={{
                    value: "Pace vs Baseline",
                    angle: -90,
                    position: "center",
                    dx: -45,
                    style: CHART_AXIS_LABEL_STYLE,
                  }}
                  tick={<CustomYAxisTick />}
                  domain={yDomain}
                  reversed={true}
                />
                <Tooltip content={<DegradationTooltip />} />
                {chartData.lineKeys.map((compound) => (
                  <Scatter
                    key={`${compound}-samples`}
                    name={`${compound} laps`}
                    data={chartData.samplesByCompound[compound] ?? []}
                    dataKey="pace_delta"
                    fill={COMPOUND_COLORS[compound] || "var(--delta-neutral)"}
                    opacity={0.18}
                    isAnimationActive={false}
                  />
                ))}
                {chartData.lineKeys.map((compound) => (
                  <Line
                    key={`${compound}-fit`}
                    type="monotone"
                    dataKey={`${compound}_fit`}
                    name={`${compound} fit`}
                    stroke={COMPOUND_COLORS[compound] || "var(--delta-neutral)"}
                    strokeWidth={3}
                    dot={false}
                    activeDot={{
                      r: 5,
                      fill: COMPOUND_COLORS[compound] || "var(--delta-neutral)",
                    }}
                    connectNulls={false}
                    isAnimationActive={true}
                    animationDuration={1200}
                  />
                ))}
              </ComposedChart>
            </StableResponsiveContainer>
          </MobileChartFrame>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-text-muted text-sm font-mono">
              Select compounds and drivers with clean stints to view degradation
              curves.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
