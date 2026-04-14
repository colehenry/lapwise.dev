"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
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
import { apiHeaders, apiUrl } from "@/lib/api";
import {
  type DriverLapTimes,
  driverKey,
  type LapData,
  type LapTimesResponse,
  type RaceControlEvent,
  type TrackStatusEvent,
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

// Outlier reason classification
type OutlierReason =
  | "pit"
  | "safety_car"
  | "vsc"
  | "red_flag"
  | "lap1"
  | "slow";

interface LapTimeByLapGraphProps {
  season: number;
  round: number;
  isSprint?: boolean;
  practiceSession?: 1 | 2 | 3;
  initialViewMode?: ViewMode;
  initialDrivers?: string[];
  embedded?: boolean;
}

// Compound colors for tyre-colored styling
const COMPOUND_COLORS: Record<string, string> = {
  SOFT: "#ef4444",
  MEDIUM: "#eab308",
  HARD: "#e5e7eb",
  INTERMEDIATE: "#22c55e",
  WET: "#3b82f6",
};

// Track-wide event display config (keyed by OutlierReason)
const TRACK_EVENT_COLORS: Record<string, { color: string; label: string }> = {
  safety_car: { color: "#eab308", label: "SC" },
  red_flag: { color: "#ef4444", label: "RED FLAG" },
  vsc: { color: "#f97316", label: "VSC" },
};

// Visual event range derived from actual outlier data
type VisualEventRange = {
  startLap: number;
  endLap: number;
  reasons: string[]; // OutlierReason values for track-wide events
};

// Outlier reason display config (used in tooltip badges)
const OUTLIER_LABELS: Record<OutlierReason, { label: string; color: string }> =
  {
    pit: { label: "PIT", color: "#f97316" },
    safety_car: { label: "SC", color: "#eab308" },
    vsc: { label: "VSC", color: "#f97316" },
    red_flag: { label: "RED", color: "#ef4444" },
    lap1: { label: "L1", color: "#8b5cf6" },
    slow: { label: "SLOW", color: "#6b7280" },
  };

// Bridge line colors keyed by OutlierReason
const BRIDGE_LINE_COLORS: Record<string, string> = {
  safety_car: "#eab308",
  red_flag: "#ef4444",
  vsc: "#f97316",
  pit: "#60a5fa",
  lap1: "#8b5cf6",
  slow: "#6b7280",
};

// Helper to format seconds to MM:SS.mmm
const formatLapTime = (seconds: number | null): string => {
  if (seconds === null) return "-";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toFixed(3).padStart(6, "0")}`;
};

interface LapTimeAxisTickProps {
  x?: number;
  y?: number;
  payload?: { value: number };
}

interface AxisTickProps {
  x?: number;
  y?: number;
  payload?: { value: string | number };
}

// Custom Y-axis Tick Component - formats seconds to MM:SS.mmm
const CustomYAxisTick = (props: LapTimeAxisTickProps) => {
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
        {formatLapTime(payload?.value ?? null)}
      </text>
    </g>
  );
};

// Custom Y-axis tick for position mode (P1, P2, etc.)
const PositionYAxisTick = (props: AxisTickProps) => {
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
        P{payload?.value}
      </text>
    </g>
  );
};

// Gap mode Y-axis tick
const GapYAxisTick = (props: AxisTickProps) => {
  const { x, y, payload } = props;
  const val = payload?.value;
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
        {val === 0
          ? "Leader"
          : val != null
            ? `+${(val as number).toFixed(1)}s`
            : ""}
      </text>
    </g>
  );
};

// Custom X-axis Tick Component
const CustomXAxisTick = (props: AxisTickProps) => {
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

interface DotProps {
  cx?: number;
  cy?: number;
  payload?: ChartDataPoint;
  dataKey?: string;
}

// Per-driver outlier labels (PIT, L1, SLOW) — stacked if multiple reasons
const OutlierDot = (props: DotProps) => {
  const { cx, cy, payload, dataKey } = props;
  if (cx === undefined || cy === undefined || !payload || !dataKey) return null;

  const driverCode = dataKey.replace("_outlier_", "");
  const reasonsStr = payload[`_outlier_reasons_${driverCode}`] as
    | string
    | undefined;
  if (!reasonsStr) return null;

  const reasons = reasonsStr.split(",") as OutlierReason[];
  return (
    <g>
      {reasons.map((reason, i) => {
        const config = OUTLIER_LABELS[reason];
        if (!config) return null;
        return (
          <text
            key={reason}
            x={cx}
            y={(cy ?? 0) - 4 - i * 9}
            textAnchor="middle"
            fill={config.color}
            fontSize={7}
            fontWeight="bold"
            opacity={0.8}
          >
            {config.label}
          </text>
        );
      })}
    </g>
  );
};

// Derive visual event ranges from the actual outlier maps (not session timestamps).
// Groups contiguous laps flagged with track-wide reasons across all selected drivers.
function computeVisualEventRanges(
  outlierMaps: Map<string, Map<number, OutlierReason>>,
  selectedKeys: string[],
): VisualEventRange[] {
  // Collect all laps with track-wide reasons across selected drivers
  const trackEventLaps = new Map<number, Set<OutlierReason>>();
  const trackReasons: Set<OutlierReason> = new Set([
    "safety_car",
    "vsc",
    "red_flag",
  ]);

  for (const key of selectedKeys) {
    const driverOutliers = outlierMaps.get(key);
    if (!driverOutliers) continue;
    for (const [lap, reason] of driverOutliers) {
      if (trackReasons.has(reason)) {
        if (!trackEventLaps.has(lap)) trackEventLaps.set(lap, new Set());
        trackEventLaps.get(lap)?.add(reason);
      }
    }
  }

  if (trackEventLaps.size === 0) return [];

  // Sort and group into contiguous runs
  const sortedLaps = [...trackEventLaps.keys()].sort((a, b) => a - b);
  const ranges: VisualEventRange[] = [];

  let i = 0;
  while (i < sortedLaps.length) {
    const start = sortedLaps[i];
    let end = start;
    const reasons = new Set(trackEventLaps.get(start) ?? []);

    while (
      i + 1 < sortedLaps.length &&
      sortedLaps[i + 1] - sortedLaps[i] <= 1
    ) {
      i++;
      end = sortedLaps[i];
      for (const r of trackEventLaps.get(end) ?? []) reasons.add(r);
    }

    ranges.push({ startLap: start, endLap: end, reasons: [...reasons] });
    i++;
  }

  return ranges;
}

// Custom SVG pill label rendered at the bottom of a ReferenceArea
interface EventAreaLabelProps {
  viewBox?: { x: number; y: number; width: number; height: number };
  reasons: { label: string; color: string }[];
}

const EventAreaLabel = ({ viewBox, reasons }: EventAreaLabelProps) => {
  if (!viewBox || reasons.length === 0) return null;
  const { x, y, width, height } = viewBox;
  const centerX = x + width / 2;
  const bottomY = y + height - 6;

  return (
    <g>
      {reasons.map((r, i) => {
        const pillW = r.label.length * 5.5 + 10;
        const pillH = 13;
        const pillY = bottomY - i * (pillH + 3);
        return (
          <g key={r.label}>
            <rect
              x={centerX - pillW / 2}
              y={pillY - pillH + 2}
              width={pillW}
              height={pillH}
              rx={3}
              ry={3}
              fill={`${r.color}25`}
              stroke={r.color}
              strokeWidth={0.75}
            />
            <text
              x={centerX}
              y={pillY - 2}
              textAnchor="middle"
              fill={r.color}
              fontSize={8}
              fontWeight="bold"
            >
              {r.label}
            </text>
          </g>
        );
      })}
    </g>
  );
};

interface TooltipEntry {
  dataKey: string;
  name: string;
  value: number;
  color: string;
  payload: Record<string, unknown>;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
  viewMode?: string;
  raceControlEvents?: RaceControlEvent[];
}

// Custom Tooltip Component
const CustomTooltip = ({
  active,
  payload,
  label,
  viewMode,
  raceControlEvents,
}: CustomTooltipProps) => {
  if (!active || !payload || !payload.length) return null;

  // Deduplicate entries per driver. On outlier laps the main line has no value,
  // so we fall back to the _outlier_ entry to still show the driver in the tooltip.
  const seenDrivers = new Set<string>();
  const uniqueEntries: TooltipEntry[] = [];

  // First pass: collect main line entries
  for (const entry of payload) {
    if (
      entry.dataKey.startsWith("_outlier_") ||
      entry.dataKey.startsWith("_pit_")
    )
      continue;
    const driverCode = entry.dataKey.includes("_stint_")
      ? entry.dataKey.split("_stint_")[0]
      : entry.dataKey;
    if (seenDrivers.has(driverCode)) continue;
    if (entry.value == null) continue;
    seenDrivers.add(driverCode);
    uniqueEntries.push(entry);
  }

  // Second pass: for drivers not yet seen, use _outlier_ entries
  for (const entry of payload) {
    if (!entry.dataKey.startsWith("_outlier_")) continue;
    const driverCode = entry.dataKey.replace("_outlier_", "");
    if (seenDrivers.has(driverCode)) continue;
    if (entry.value == null) continue;
    seenDrivers.add(driverCode);
    // Create a synthetic entry that looks like the main driver entry
    uniqueEntries.push({ ...entry, dataKey: driverCode });
  }

  // Find race control events for this lap
  const lapNum = label as number;
  const lapEvents = raceControlEvents?.filter(
    (e) => e.lap_number === lapNum && e.scope === "Track",
  );

  return (
    <div className="bg-bg-tertiary border border-border-primary rounded-lg p-3 shadow-xl max-w-xs">
      <p className={`${CHART_TYPOGRAPHY.tooltipTitleClassName} mb-2`}>
        Lap {label}
      </p>
      {lapEvents && lapEvents.length > 0 && (
        <div className="mb-2 space-y-0.5">
          {lapEvents.map((evt) => (
            <div
              key={`rc-${evt.session_time_seconds}-${evt.category}`}
              className="text-xs font-mono text-yellow-400/80 truncate"
            >
              {evt.message}
            </div>
          ))}
        </div>
      )}
      {uniqueEntries.map((entry: TooltipEntry) => {
        const driverCode = entry.dataKey.includes("_stint_")
          ? entry.dataKey.split("_stint_")[0]
          : entry.dataKey;
        const lapData = entry.payload[`_data_${driverCode}`] as
          | LapData
          | undefined;
        const outlierReason = entry.payload[`_outlier_reason_${driverCode}`] as
          | OutlierReason
          | undefined;

        return (
          <div key={driverCode} className="mb-2">
            <div className="flex items-center gap-2 mb-1">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span
                className={`${CHART_TYPOGRAPHY.tooltipValueClassName} text-sm`}
              >
                {entry.name?.includes("(")
                  ? entry.name.split(" (")[0]
                  : entry.name}
              </span>
              {outlierReason && (
                <span
                  className="text-[10px] font-bold font-mono px-1 py-0.5 rounded"
                  style={{
                    color: OUTLIER_LABELS[outlierReason].color,
                    backgroundColor: `${OUTLIER_LABELS[outlierReason].color}20`,
                  }}
                >
                  {OUTLIER_LABELS[outlierReason].label}
                </span>
              )}
            </div>
            <div className="ml-5 text-xs text-text-secondary space-y-0.5">
              {viewMode === "position" && entry.value != null && (
                <div>
                  <span className="text-text-muted">Position:</span>{" "}
                  <span className={CHART_TYPOGRAPHY.tooltipValueClassName}>
                    P{entry.value}
                  </span>
                </div>
              )}
              {viewMode !== "position" && (
                <div>
                  <span className="text-text-muted">
                    {viewMode === "gapToLeader" ? "Gap:" : "Time:"}
                  </span>{" "}
                  <span className={CHART_TYPOGRAPHY.tooltipValueClassName}>
                    {viewMode === "gapToLeader" && entry.value === 0
                      ? "Leader"
                      : viewMode === "gapToLeader"
                        ? `+${entry.value.toFixed(3)}s`
                        : formatLapTime(
                            lapData?.lap_time_seconds ?? entry.value,
                          )}
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
                  <span
                    className={CHART_TYPOGRAPHY.tooltipValueClassName}
                    style={{ color: "#fb923c" }}
                  >
                    {lapData.pit_duration_seconds.toFixed(1)}s
                  </span>
                </div>
              )}
              {lapData?.sector1_time_seconds != null && (
                <div className="flex gap-2">
                  <span className="text-text-muted">S1</span>
                  <span className={CHART_TYPOGRAPHY.tooltipValueClassName}>
                    {lapData.sector1_time_seconds.toFixed(3)}
                  </span>
                  <span className="text-text-muted">S2</span>
                  <span className={CHART_TYPOGRAPHY.tooltipValueClassName}>
                    {lapData.sector2_time_seconds?.toFixed(3) ?? "-"}
                  </span>
                  <span className="text-text-muted">S3</span>
                  <span className={CHART_TYPOGRAPHY.tooltipValueClassName}>
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

// Check if a lap is inside or adjacent to a status band
function bandReasonForLap(
  lapNumber: number,
  statusBands: StatusBand[],
): OutlierReason | null {
  for (const band of statusBands) {
    if (lapNumber >= band.startLap - 1 && lapNumber <= band.endLap + 1) {
      if (band.status === "4") return "safety_car";
      if (band.status === "5") return "red_flag";
      if (band.status === "6") return "vsc";
    }
  }
  return null;
}

// Detect implied pit stop from compound or tyre life change
function isImpliedPit(lap: LapData, prevLap: LapData | null): boolean {
  if (!prevLap) return false;
  // Compound changed
  if (lap.compound && prevLap.compound && lap.compound !== prevLap.compound)
    return true;
  // Tyre life reset (went from higher to lower = new set)
  if (
    lap.tyre_life != null &&
    prevLap.tyre_life != null &&
    lap.tyre_life < prevLap.tyre_life
  )
    return true;
  return false;
}

// Build omit map for a driver — two-pass: known events + delta check
function detectOutlierLaps(
  laps: LapData[],
  statusBands: StatusBand[],
): Map<number, OutlierReason> {
  const outliers = new Map<number, OutlierReason>();
  const sorted = [...laps].sort((a, b) => a.lap_number - b.lap_number);

  // Pass 1: flag known events (lap 1, pits, bands, track status flags)
  for (let i = 0; i < sorted.length; i++) {
    const lap = sorted[i];
    if (lap.lap_time_seconds == null) continue;
    const prevLap = i > 0 ? sorted[i - 1] : null;

    // Lap 1
    if (lap.lap_number === 1) {
      outliers.set(lap.lap_number, "lap1");
      continue;
    }

    // Explicit pit stop
    if (lap.pit_duration_seconds != null && lap.pit_duration_seconds > 0) {
      outliers.set(lap.lap_number, "pit");
      continue;
    }

    // Implied pit stop (compound/tyre change without pit_duration)
    if (isImpliedPit(lap, prevLap)) {
      outliers.set(lap.lap_number, "pit");
      continue;
    }

    // Status band (SC/VSC/Red Flag) ±1 lap
    const bandReason = bandReasonForLap(lap.lap_number, statusBands);
    if (bandReason) {
      outliers.set(lap.lap_number, bandReason);
      continue;
    }

    // Per-lap track_status flag
    if (lap.track_status === "4") {
      outliers.set(lap.lap_number, "safety_car");
      continue;
    }
    if (lap.track_status === "6" || lap.track_status === "7") {
      outliers.set(lap.lap_number, "vsc");
      continue;
    }
    if (lap.track_status === "5") {
      outliers.set(lap.lap_number, "red_flag");
    }
  }

  // Pass 2: 107% rule — any lap time > 107% of the driver's personal best is omitted.
  let personalBest = Infinity;
  for (const lap of sorted) {
    if (lap.lap_time_seconds == null || outliers.has(lap.lap_number)) continue;
    let normTime = lap.lap_time_seconds;
    if (lap.pit_duration_seconds != null && lap.pit_duration_seconds > 0) {
      normTime -= lap.pit_duration_seconds;
    }
    if (normTime < personalBest) personalBest = normTime;
  }

  if (personalBest !== Infinity) {
    const threshold = personalBest * 1.07;
    for (const lap of sorted) {
      if (lap.lap_time_seconds == null || outliers.has(lap.lap_number))
        continue;
      let normTime = lap.lap_time_seconds;
      if (lap.pit_duration_seconds != null && lap.pit_duration_seconds > 0) {
        normTime -= lap.pit_duration_seconds;
      }
      if (normTime > threshold) {
        const bandReason = bandReasonForLap(lap.lap_number, statusBands);
        outliers.set(lap.lap_number, bandReason ?? "slow");
      }
    }
  }

  return outliers;
}

export default function LapTimeByLapGraph({
  season,
  round,
  isSprint = false,
  practiceSession,
  initialViewMode = "lapTime",
  initialDrivers,
  embedded = false,
}: LapTimeByLapGraphProps) {
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode);
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
    queryKey: ["lap-times", season, round, isSprint, practiceSession],
    queryFn: async () => {
      let endpoint: string;
      if (practiceSession) {
        endpoint = `/api/results/${season}/${round}/practice/${practiceSession}/lap-times`;
      } else if (isSprint) {
        endpoint = `/api/results/${season}/${round}/sprint/lap-times`;
      } else {
        endpoint = `/api/results/${season}/${round}/lap-times`;
      }
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
      const requested = initialDrivers?.map((driver) => driver.toUpperCase());
      const matchingDrivers =
        requested && requested.length > 0
          ? sorted
              .filter((driver) =>
                requested.includes(driverKey(driver).toUpperCase()),
              )
              .map((driver) => driverKey(driver))
          : [];
      setSelectedDrivers(
        matchingDrivers.length > 0
          ? matchingDrivers
          : sorted.slice(0, 3).map((d) => driverKey(d)),
      );
    }
  }, [data, initialDrivers]);

  // Compute track status bands
  const statusBands = useMemo(() => {
    if (!data) return [];
    return computeStatusBands(
      data.track_status_events || [],
      data.drivers,
      data.total_laps ?? null,
    );
  }, [data]);

  // Compute outlier maps per driver
  const outlierMaps = useMemo(() => {
    if (!data) return new Map<string, Map<number, OutlierReason>>();
    const maps = new Map<string, Map<number, OutlierReason>>();
    for (const driver of data.drivers) {
      maps.set(driverKey(driver), detectOutlierLaps(driver.laps, statusBands));
    }
    return maps;
  }, [data, statusBands]);

  // Derive visual event ranges from actual outlier data (not session timestamps)
  const visualEventRanges = useMemo(() => {
    if (outlierMaps.size === 0) return [];
    return computeVisualEventRanges(outlierMaps, selectedDrivers);
  }, [outlierMaps, selectedDrivers]);

  // Normalize pit lap times: subtract pit duration from lap time
  const getNormalizedLapTime = (lap: LapData): number | null => {
    if (lap.lap_time_seconds == null) return null;
    if (lap.pit_duration_seconds != null && lap.pit_duration_seconds > 0) {
      return lap.lap_time_seconds - lap.pit_duration_seconds;
    }
    return lap.lap_time_seconds;
  };

  // Calculate gap to leader data
  const getGapToLeaderData = (): ChartDataPoint[] => {
    if (!data || !data.drivers) return [];

    const filteredDrivers = data.drivers.filter((driver) =>
      selectedDrivers.includes(driverKey(driver)),
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

      cumulativeTimes.set(driverKey(driver), cumulative);
    }

    const chartData: ChartDataPoint[] = [];

    for (let lapNum = 1; lapNum <= maxLaps; lapNum++) {
      let leaderTime = Number.POSITIVE_INFINITY;

      for (const driver of filteredDrivers) {
        const cumulative = cumulativeTimes.get(driverKey(driver));
        if (cumulative && cumulative[lapNum - 1] > 0) {
          leaderTime = Math.min(leaderTime, cumulative[lapNum - 1]);
        }
      }

      if (leaderTime === Number.POSITIVE_INFINITY) continue;

      const dataPoint: ChartDataPoint = { lap_number: lapNum };

      for (const driver of filteredDrivers) {
        const key = driverKey(driver);
        const cumulative = cumulativeTimes.get(key);
        const lap = driver.laps.find((l) => l.lap_number === lapNum);

        if (cumulative && cumulative[lapNum - 1] > 0 && lap) {
          const gap = cumulative[lapNum - 1] - leaderTime;
          dataPoint[key] = gap;
          dataPoint[`_data_${key}`] = lap;
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
      selectedDrivers.includes(driverKey(driver)),
    );

    if (filteredDrivers.length === 0) return [];

    const maxLaps = Math.max(...filteredDrivers.map((d) => d.laps.length));
    const chartData: ChartDataPoint[] = [];

    for (let lapNum = 1; lapNum <= maxLaps; lapNum++) {
      const dataPoint: ChartDataPoint = { lap_number: lapNum };

      for (const driver of filteredDrivers) {
        const key = driverKey(driver);
        const lap = driver.laps.find((l) => l.lap_number === lapNum);
        if (lap && lap.position != null) {
          dataPoint[key] = lap.position;
          dataPoint[`_data_${key}`] = lap;
        }
      }

      chartData.push(dataPoint);
    }

    return chartData;
  };

  // Transform data for Recharts (lap time mode with outlier omission)
  // Two-pass: first build data with placeholders, then fill marker Y midpoints.
  const getLapTimeData = (): ChartDataPoint[] => {
    if (!data || !data.drivers) return [];

    const filteredDrivers = data.drivers.filter((driver) =>
      selectedDrivers.includes(driverKey(driver)),
    );

    if (filteredDrivers.length === 0) return [];

    const maxLaps = Math.max(...filteredDrivers.map((d) => d.laps.length));

    // Pre-compute per-driver nearest clean lap times before/after each outlier
    const preClean = new Map<string, Map<number, number>>();
    const postClean = new Map<string, Map<number, number>>();

    for (const driver of filteredDrivers) {
      const key = driverKey(driver);
      const driverOutliers = outlierMaps.get(key);
      const sorted = [...driver.laps].sort(
        (a, b) => a.lap_number - b.lap_number,
      );

      const pre = new Map<number, number>();
      let lastClean: number | null = null;
      for (const lap of sorted) {
        if (lap.lap_time_seconds == null) continue;
        if (driverOutliers?.has(lap.lap_number)) {
          if (lastClean != null) pre.set(lap.lap_number, lastClean);
        } else {
          const t = getNormalizedLapTime(lap);
          if (t != null) lastClean = t;
        }
      }
      preClean.set(key, pre);

      const post = new Map<number, number>();
      let nextClean: number | null = null;
      for (let i = sorted.length - 1; i >= 0; i--) {
        const lap = sorted[i];
        if (lap.lap_time_seconds == null) continue;
        if (driverOutliers?.has(lap.lap_number)) {
          if (nextClean != null) post.set(lap.lap_number, nextClean);
        } else {
          const t = getNormalizedLapTime(lap);
          if (t != null) nextClean = t;
        }
      }
      postClean.set(key, post);
    }

    const getMarkerY = (key: string, lapNumber: number): number | null => {
      const before = preClean.get(key)?.get(lapNumber);
      const after = postClean.get(key)?.get(lapNumber);
      if (before != null && after != null) return (before + after) / 2;
      return before ?? after ?? null;
    };

    // Build per-driver bridge segments: for each contiguous run of outlier laps,
    // linearly interpolate from the last clean value to the next clean value.
    // Bridge lines are colored per the dominant reason for each run.
    const REASON_PRIORITY: OutlierReason[] = [
      "red_flag",
      "safety_car",
      "vsc",
      "pit",
      "lap1",
      "slow",
    ];
    // driver key → reason → (lap → bridge value)
    const bridgeValuesByReason = new Map<
      string,
      Map<string, Map<number, number>>
    >();
    // driver key → label lap → per-driver reasons to show (excludes track-wide)
    const labelReasonsMap = new Map<string, Map<number, OutlierReason[]>>();

    for (const driver of filteredDrivers) {
      const key = driverKey(driver);
      const driverOutliers = outlierMaps.get(key);
      if (!driverOutliers || driverOutliers.size === 0) continue;

      const sorted = [...driver.laps]
        .filter((l) => l.lap_time_seconds != null)
        .sort((a, b) => a.lap_number - b.lap_number);

      const reasonBridges = new Map<string, Map<number, number>>();
      const labelReasons = new Map<number, OutlierReason[]>();

      // Walk through laps and find contiguous outlier runs
      let i = 0;
      while (i < sorted.length) {
        if (!driverOutliers.has(sorted[i].lap_number)) {
          i++;
          continue;
        }

        // Start of an outlier run — find boundaries
        const runStart = i;
        while (i < sorted.length && driverOutliers.has(sorted[i].lap_number)) {
          i++;
        }
        const runEnd = i - 1; // inclusive

        // Collect all reasons in this run
        const runReasonSet = new Set<OutlierReason>();
        for (let j = runStart; j <= runEnd; j++) {
          const r = driverOutliers.get(sorted[j].lap_number);
          if (r) runReasonSet.add(r);
        }

        // Dominant reason drives bridge color
        const dominantReason =
          REASON_PRIORITY.find((r) => runReasonSet.has(r)) ?? "slow";

        // Per-driver label reasons (skip track-wide events — shown by area bands)
        const perDriverReasons = REASON_PRIORITY.filter(
          (r) =>
            runReasonSet.has(r) &&
            r !== "safety_car" &&
            r !== "vsc" &&
            r !== "red_flag",
        );

        // Middle lap carries the label
        const midIdx = runStart + Math.floor((runEnd - runStart) / 2);
        if (perDriverReasons.length > 0) {
          labelReasons.set(sorted[midIdx].lap_number, perDriverReasons);
        }

        // Get pre and post clean values
        const preVal =
          runStart > 0 ? getNormalizedLapTime(sorted[runStart - 1]) : null;
        const postVal =
          runEnd < sorted.length - 1
            ? getNormalizedLapTime(sorted[runEnd + 1])
            : null;

        const startVal = preVal ?? postVal;
        const endVal = postVal ?? preVal;
        if (startVal == null || endVal == null) continue;

        let bridge = reasonBridges.get(dominantReason);
        if (!bridge) {
          bridge = new Map<number, number>();
          reasonBridges.set(dominantReason, bridge);
        }

        // Include the anchor laps (last clean before, first clean after)
        if (preVal != null && runStart > 0) {
          bridge.set(sorted[runStart - 1].lap_number, preVal);
        }

        // Linearly interpolate across outlier laps
        const runLen = runEnd - runStart + 1;
        for (let j = 0; j <= runLen - 1; j++) {
          const t = runLen === 1 ? 0.5 : j / (runLen - 1);
          const interpVal = startVal + (endVal - startVal) * t;
          bridge.set(sorted[runStart + j].lap_number, interpVal);
        }

        if (postVal != null && runEnd < sorted.length - 1) {
          bridge.set(sorted[runEnd + 1].lap_number, postVal);
        }
      }

      if (reasonBridges.size > 0) {
        bridgeValuesByReason.set(key, reasonBridges);
      }
      if (labelReasons.size > 0) {
        labelReasonsMap.set(key, labelReasons);
      }
    }

    const chartData: ChartDataPoint[] = [];

    for (let lapNum = 1; lapNum <= maxLaps; lapNum++) {
      const dataPoint: ChartDataPoint = { lap_number: lapNum };

      for (const driver of filteredDrivers) {
        const key = driverKey(driver);
        const lap = driver.laps.find((l) => l.lap_number === lapNum);
        if (!lap || lap.lap_time_seconds === null) continue;

        const displayTime = getNormalizedLapTime(lap);
        if (displayTime === null) continue;

        const reason = outlierMaps.get(key)?.get(lap.lap_number);

        // Always store lap data for tooltip
        dataPoint[`_data_${key}`] = lap;

        if (reason) {
          // Omit from main line — null gap breaks it via connectNulls={false}
          dataPoint[`_outlier_reason_${key}`] = reason as unknown as number;

          // Place per-driver label on the middle lap of each contiguous run
          const labelReasonsList = labelReasonsMap
            .get(key)
            ?.get(lap.lap_number);
          if (labelReasonsList && labelReasonsList.length > 0) {
            const markerY = getMarkerY(key, lap.lap_number);
            if (markerY != null) {
              dataPoint[`_outlier_${key}`] = markerY;
              dataPoint[`_outlier_reasons_${key}`] = labelReasonsList.join(",");
            }
          }
        } else {
          dataPoint[key] = displayTime;
        }

        // Bridge (dotted connector) data — keyed per reason for colored rendering
        const driverBridges = bridgeValuesByReason.get(key);
        if (driverBridges) {
          for (const [bReason, lapMap] of driverBridges) {
            const bridgeVal = lapMap.get(lapNum);
            if (bridgeVal != null) {
              dataPoint[`_bridge_${bReason}_${key}`] = bridgeVal;
            }
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
        (d) => driverKey(d) === driverKey(driver),
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
      <div>
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
      <div>
        <div className="h-8 mb-4 flex items-center">
          <h3 className={CHART_TYPOGRAPHY.titleClassName}>Lap Time Analysis</h3>
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

    // For lap time mode, only clean laps are on the main driver keys
    // Outlier laps are on _outlier_ keys and excluded by the _ prefix filter
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

  // Build Line components: one per driver
  const renderLines = () => {
    return drivers
      .filter((driver) => selectedDrivers.includes(driverKey(driver)))
      .map((driver) => {
        const key = driverKey(driver);
        const color = getDriverColor(driver);
        return (
          <Line
            key={key}
            type="linear"
            dataKey={key}
            name={driver.full_name}
            stroke={color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 5, fill: color, stroke: color }}
            filter={`url(#glow-${key})`}
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
    <div className={embedded ? "min-h-[420px]" : ""}>
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <h3 className={CHART_TYPOGRAPHY.titleClassName}>
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
                const isSelected = selectedDrivers.includes(driverKey(driver));
                const teamColor = driver.team_color
                  ? `#${driver.team_color}`
                  : CHART_COLORS.textTertiary;

                return (
                  <label
                    key={driverKey(driver)}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-bg-elevated cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleDriver(driverKey(driver))}
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
      <MobileChartFrame height={420} logicalWidth={920} className="-ml-2">
        {chartData.length > 0 ? (
          <>
            <ResponsiveContainer width="100%" height={420}>
              <LineChart
                data={chartData}
                margin={{ top: 10, right: 16, left: 20, bottom: 30 }}
              >
                <defs>
                  {drivers
                    .filter((driver) =>
                      selectedDrivers.includes(driverKey(driver)),
                    )
                    .map((driver) => (
                      <filter
                        key={`glow-${driverKey(driver)}`}
                        id={`glow-${driverKey(driver)}`}
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

                {/* Track event bands — colored area + boundary lines + pill labels */}
                {visualEventRanges.flatMap((range, rangeIndex) => {
                  const primaryReason = range.reasons.includes("red_flag")
                    ? "red_flag"
                    : range.reasons.includes("safety_car")
                      ? "safety_car"
                      : range.reasons[0];
                  const primaryStyle = TRACK_EVENT_COLORS[primaryReason];
                  if (!primaryStyle) return [];

                  const pills = range.reasons
                    .map((r) => TRACK_EVENT_COLORS[r])
                    .filter(Boolean);
                  const keyBase = `${primaryReason}-${range.startLap}-${range.endLap}-${rangeIndex}`;

                  return [
                    <ReferenceArea
                      key={`evt-area-${keyBase}`}
                      x1={range.startLap}
                      x2={range.endLap}
                      fill={primaryStyle.color}
                      fillOpacity={0.07}
                      stroke="none"
                      label={<EventAreaLabel reasons={pills} />}
                    />,
                    <ReferenceLine
                      key={`evt-s-${keyBase}`}
                      x={range.startLap}
                      stroke={primaryStyle.color}
                      strokeDasharray="4 3"
                      strokeOpacity={0.45}
                    />,
                    range.startLap !== range.endLap ? (
                      <ReferenceLine
                        key={`evt-e-${keyBase}`}
                        x={range.endLap}
                        stroke={primaryStyle.color}
                        strokeDasharray="4 3"
                        strokeOpacity={0.45}
                      />
                    ) : null,
                  ];
                })}

                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={CHART_COLORS.borderPrimary}
                />
                <XAxis
                  dataKey="lap_number"
                  stroke={CHART_COLORS.textTertiary}
                  label={{
                    value: "Lap",
                    position: "insideBottomRight",
                    offset: -5,
                    style: CHART_AXIS_LABEL_STYLE,
                  }}
                  tick={<CustomXAxisTick />}
                />
                <YAxis
                  stroke={CHART_COLORS.textTertiary}
                  label={{
                    value: getYAxisLabel(),
                    angle: -90,
                    position: "insideLeft",
                    dx: -10,
                    style: CHART_AXIS_LABEL_STYLE,
                  }}
                  tick={getYAxisTick()}
                  domain={getYAxisDomain()}
                  reversed={true}
                  allowDecimals={viewMode !== "position"}
                />
                <Tooltip
                  content={
                    <CustomTooltip
                      viewMode={viewMode}
                      raceControlEvents={data.race_control_events}
                    />
                  }
                />
                {renderLines()}

                {/* Dotted bridge lines across outlier gaps — colored per reason */}
                {viewMode === "lapTime" &&
                  drivers
                    .filter((driver) =>
                      selectedDrivers.includes(driverKey(driver)),
                    )
                    .flatMap((driver) =>
                      Object.keys(BRIDGE_LINE_COLORS).map((reason) => (
                        <Line
                          key={`bridge-${reason}-${driverKey(driver)}`}
                          type="linear"
                          dataKey={`_bridge_${reason}_${driverKey(driver)}`}
                          stroke={BRIDGE_LINE_COLORS[reason]}
                          strokeWidth={1.5}
                          strokeDasharray="3 3"
                          strokeOpacity={0.65}
                          dot={false}
                          activeDot={false}
                          isAnimationActive={false}
                          legendType="none"
                          tooltipType="none"
                          connectNulls={false}
                        />
                      )),
                    )}

                {/* Per-driver outlier reason labels (PIT, L1, SLOW) on the bridge */}
                {viewMode === "lapTime" &&
                  drivers
                    .filter((driver) =>
                      selectedDrivers.includes(driverKey(driver)),
                    )
                    .map((driver) => (
                      <Line
                        key={`outlier-${driverKey(driver)}`}
                        type="linear"
                        dataKey={`_outlier_${driverKey(driver)}`}
                        stroke="none"
                        dot={<OutlierDot />}
                        activeDot={false}
                        isAnimationActive={false}
                        legendType="none"
                        tooltipType="none"
                      />
                    ))}
              </LineChart>
            </ResponsiveContainer>

            {/* Driver Legend — bottom right, above axis labels */}
            <div className="absolute bottom-12 right-5 bg-bg-primary/80 border border-border-primary rounded-sm px-2 py-1.5 backdrop-blur-sm pointer-events-none">
              <div className="flex flex-col gap-0.5">
                {drivers
                  .filter((driver) =>
                    selectedDrivers.includes(driverKey(driver)),
                  )
                  .map((driver) => {
                    const color = getDriverColor(driver);
                    return (
                      <div
                        key={driverKey(driver)}
                        className="flex items-center gap-1.5"
                      >
                        <div
                          className="w-3 h-0.5"
                          style={{ backgroundColor: color }}
                        />
                        <span
                          className={`${CHART_TYPOGRAPHY.keyClassName} text-[9px] leading-tight`}
                        >
                          {driver.driver_code || driver.full_name}
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
              No lap time data available. Select at least one driver to view lap
              times.
            </p>
          </div>
        )}
      </MobileChartFrame>
    </div>
  );
}
