"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHART_COLORS } from "@/components/chart-primitives";
import { apiHeaders, apiUrl } from "@/lib/api";
import type { LapTimesResponse } from "@/lib/types";

interface PitStopDeltaChartProps {
  season: number;
  round: number;
  isSprint?: boolean;
}

type PitStop = {
  lap: number;
  duration: number;
  driverCode: string;
  teamColor: string;
  isSc: boolean;
  isVsc: boolean;
};

type PitStopWithLayout = PitStop & { labelOffsetY: number };

const isValidPitDuration = (
  duration: number | null | undefined,
): duration is number =>
  duration != null &&
  Number.isFinite(duration) &&
  duration > 10 &&
  duration < 120;

const isValidSessionTimestamp = (
  value: number | null | undefined,
): value is number => value != null && Number.isFinite(value);

const SC_STATUS = "4";
const VSC_STATUS = "6";

// IQR-based outlier bounds
function iqrBounds(values: number[]): { lower: number; upper: number } {
  if (values.length < 4) return { lower: -Infinity, upper: Infinity };
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  return { lower: q1 - 1.5 * iqr, upper: q3 + 1.5 * iqr };
}

// Greedy label stacking: prevents text overlap by nudging labels upward
// when dots are spatially close. Uses approximate pixel coords derived
// from the data domain and a fixed chart height estimate.
function assignLabelOffsets(
  stops: PitStop[],
  domainMin: number,
  domainMax: number,
  chartHeight = 268,
): PitStopWithLayout[] {
  const domainRange = domainMax - domainMin || 1;
  const LABEL_H = 13; // px per label row
  const BASE = -14; // default offset above dot
  const LAP_WINDOW = 2; // laps either side to check for nearby dots

  // Approximate SVG y-coordinate for a duration value.
  // Recharts draws min at the bottom (high cy) and max at top (low cy).
  const approxCy = (d: number) =>
    chartHeight - ((d - domainMin) / domainRange) * chartHeight;

  // Sort to process dots from left-to-right, bottom-to-top so the greedy
  // pass assigns offsets in a predictable reading order.
  const ordered = [...stops].sort(
    (a, b) => a.lap - b.lap || a.duration - b.duration,
  );

  type Placed = PitStopWithLayout & { _cy: number };
  const placed: Placed[] = [];

  for (const stop of ordered) {
    const cy = approxCy(stop.duration);
    const nearby = placed.filter(
      (p) => Math.abs(p.lap - stop.lap) <= LAP_WINDOW,
    );

    let offset = BASE;
    for (let i = 0; i < 8; i++) {
      const labelY = cy + offset;
      const clash = nearby.some(
        (p) => Math.abs(p._cy + p.labelOffsetY - labelY) < LABEL_H,
      );
      if (!clash) break;
      offset -= LABEL_H;
    }

    placed.push({ ...stop, labelOffsetY: offset, _cy: cy });
  }

  return placed.map(({ _cy: _c, ...rest }) => rest);
}

function PitDot(props: {
  cx?: number;
  cy?: number;
  payload?: PitStopWithLayout;
}) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null || !payload) return null;

  return (
    <g>
      {(payload.isSc || payload.isVsc) && (
        <circle
          cx={cx}
          cy={cy}
          r={10}
          fill="none"
          stroke={payload.isVsc ? "#a78bfa" : "#f59e0b"}
          strokeWidth={2}
          strokeDasharray={payload.isVsc ? "3 2" : undefined}
          opacity={0.9}
        />
      )}
      <circle cx={cx} cy={cy} r={6} fill={payload.teamColor} opacity={0.9} />
      <text
        x={cx}
        y={cy + payload.labelOffsetY}
        textAnchor="middle"
        fill={CHART_COLORS.textMuted}
        fontSize={9}
        fontFamily="monospace"
        fontWeight="bold"
      >
        {payload.driverCode}
      </text>
    </g>
  );
}

// Small filter toggle pill
function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1 px-2 py-0.5 rounded-sm border font-mono text-[10px] transition-colors ${
        active
          ? "border-border-secondary bg-bg-elevated text-text-secondary"
          : "border-border-primary/50 bg-transparent text-text-muted"
      }`}
    >
      <span
        className={`w-2 h-2 rounded-[2px] border ${
          active
            ? "bg-text-secondary border-text-secondary"
            : "border-text-muted/50"
        }`}
      />
      {children}
    </button>
  );
}

export default function PitStopDeltaChart({
  season,
  round,
  isSprint = false,
}: PitStopDeltaChartProps) {
  const [excludeNeutralised, setExcludeNeutralised] = useState(false);
  const [removeOutliers, setRemoveOutliers] = useState(false);

  const { data, isLoading } = useQuery<LapTimesResponse | null>({
    queryKey: ["lap-times", season, round, isSprint],
    queryFn: async () => {
      const endpoint = isSprint
        ? `/api/results/${season}/${round}/sprint/lap-times`
        : `/api/results/${season}/${round}/lap-times`;
      const res = await fetch(apiUrl(endpoint), {
        cache: "no-store",
        headers: apiHeaders(),
      });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: season >= 2018,
  });

  // Parse all pit stops and SC lap ranges from raw API data
  const { allStops, scLapRanges, totalLaps } = useMemo(() => {
    if (!data) return { allStops: [], scLapRanges: [], totalLaps: 60 };

    const allStops: PitStop[] = [];
    const lapStatusMap = new Map<number, string>();

    for (const driver of data.drivers) {
      let pendingPitInTime: number | null = null;
      let pendingPitInLap: number | null = null;
      let pendingPitInStatus: string | null = null;

      const driverCode = driver.driver_code ?? driver.full_name;
      const teamColor = driver.team_color ? `#${driver.team_color}` : "#666";

      for (const lap of driver.laps) {
        if (lap.track_status && lap.lap_number != null) {
          if (
            lap.track_status === SC_STATUS ||
            lap.track_status === VSC_STATUS
          ) {
            lapStatusMap.set(lap.lap_number, lap.track_status);
          }
        }

        if (
          pendingPitInTime != null &&
          isValidSessionTimestamp(lap.pit_out_time_seconds)
        ) {
          const duration = lap.pit_out_time_seconds - pendingPitInTime;
          if (isValidPitDuration(duration)) {
            allStops.push({
              lap: pendingPitInLap ?? lap.lap_number,
              duration,
              driverCode,
              teamColor,
              isSc: pendingPitInStatus === SC_STATUS,
              isVsc: pendingPitInStatus === VSC_STATUS,
            });
          }
          pendingPitInTime = null;
          pendingPitInLap = null;
          pendingPitInStatus = null;
          continue;
        }

        if (pendingPitInTime == null && lap.pit_in_time_seconds != null) {
          pendingPitInTime = lap.pit_in_time_seconds;
          pendingPitInLap = lap.lap_number;
          pendingPitInStatus = lap.track_status;
        }

        if (isValidPitDuration(lap.pit_duration_seconds)) {
          allStops.push({
            lap: lap.lap_number,
            duration: lap.pit_duration_seconds,
            driverCode,
            teamColor,
            isSc: lap.track_status === SC_STATUS,
            isVsc: lap.track_status === VSC_STATUS,
          });
        }
      }
    }

    // Build contiguous SC/VSC lap ranges for background bands
    const scLaps = [...lapStatusMap.entries()].sort((a, b) => a[0] - b[0]);
    const scLapRanges: { start: number; end: number; type: "SC" | "VSC" }[] =
      [];
    for (const [lap, status] of scLaps) {
      const type = status === SC_STATUS ? "SC" : "VSC";
      const last = scLapRanges[scLapRanges.length - 1];
      if (last && last.type === type && lap === last.end + 1) {
        last.end = lap;
      } else {
        scLapRanges.push({ start: lap, end: lap, type });
      }
    }

    return { allStops, scLapRanges, totalLaps: data.total_laps ?? 60 };
  }, [data]);

  // Apply filters, recompute stats, assign label offsets
  const { stops, fieldAvg, domainMin, domainMax, outliersRemoved } =
    useMemo(() => {
      let filtered = excludeNeutralised
        ? allStops.filter((s) => !s.isSc && !s.isVsc)
        : allStops;

      let outliersRemoved = 0;
      if (removeOutliers && filtered.length >= 4) {
        const bounds = iqrBounds(filtered.map((s) => s.duration));
        const before = filtered.length;
        filtered = filtered.filter(
          (s) => s.duration >= bounds.lower && s.duration <= bounds.upper,
        );
        outliersRemoved = before - filtered.length;
      }

      const fieldAvg =
        filtered.length > 0
          ? filtered.reduce((s, p) => s + p.duration, 0) / filtered.length
          : 0;

      const durations = filtered.map((s) => s.duration);
      const minDur = durations.length > 0 ? Math.min(...durations) : 0;
      const maxDur = durations.length > 0 ? Math.max(...durations) : 0;
      const domainMin = Math.floor(minDur * 0.95);
      const domainMax = Math.ceil(maxDur * 1.06);

      const stops = assignLabelOffsets(filtered, domainMin, domainMax);

      return { stops, fieldAvg, domainMin, domainMax, outliersRemoved };
    }, [allStops, excludeNeutralised, removeOutliers]);

  if (season < 2018) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-text-muted text-sm font-mono">
          Telemetry data available from 2018 onwards.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="h-5 bg-bg-elevated rounded w-48 animate-pulse" />
        <div className="h-64 bg-bg-elevated rounded animate-pulse" />
      </div>
    );
  }

  if (!data || allStops.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-text-muted text-sm font-mono">
          No pit stop data found for this session.
        </p>
      </div>
    );
  }

  const scCount = allStops.filter((s) => s.isSc || s.isVsc).length;
  const fastestStop =
    stops.length > 0
      ? stops.reduce((a, b) => (a.duration < b.duration ? a : b))
      : null;

  // Per-driver totals for footer chips
  const driverTotals = Object.entries(
    stops.reduce(
      (acc, s) => {
        if (!acc[s.driverCode]) {
          acc[s.driverCode] = {
            total: 0,
            count: 0,
            color: s.teamColor,
            scStops: 0,
          };
        }
        acc[s.driverCode].total += s.duration;
        acc[s.driverCode].count += 1;
        if (s.isSc || s.isVsc) acc[s.driverCode].scStops += 1;
        return acc;
      },
      {} as Record<
        string,
        { total: number; count: number; color: string; scStops: number }
      >,
    ),
  ).sort((a, b) => a[1].total - b[1].total);

  const showBands = !excludeNeutralised && scLapRanges.length > 0;

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div className="space-y-1">
          <p className="text-[10px] text-text-muted font-mono uppercase tracking-widest">
            Time lost under pitting
            {stops.length > 0 && (
              <>
                {" "}
                · field avg{" "}
                <span className="text-text-secondary">
                  {fieldAvg.toFixed(2)}s
                </span>
              </>
            )}
          </p>
          {outliersRemoved > 0 && (
            <p className="text-[10px] text-text-muted/60 font-mono">
              {outliersRemoved} outlier{outliersRemoved !== 1 ? "s" : ""} hidden
            </p>
          )}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {scCount > 0 && (
            <FilterPill
              active={excludeNeutralised}
              onClick={() => setExcludeNeutralised((v) => !v)}
            >
              Exclude SC/VSC
            </FilterPill>
          )}
          <FilterPill
            active={removeOutliers}
            onClick={() => setRemoveOutliers((v) => !v)}
          >
            Remove outliers
          </FilterPill>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 flex-wrap">
        {scCount > 0 && !excludeNeutralised && (
          <>
            <div className="flex items-center gap-1.5">
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                aria-hidden="true"
              >
                <title>Safety car stop indicator</title>
                <circle
                  cx="7"
                  cy="7"
                  r="6"
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="2"
                />
                <circle cx="7" cy="7" r="3.5" fill="#f59e0b" opacity="0.7" />
              </svg>
              <span className="text-[10px] font-mono text-text-muted">
                SC pit
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                aria-hidden="true"
              >
                <title>Virtual safety car stop indicator</title>
                <circle
                  cx="7"
                  cy="7"
                  r="6"
                  fill="none"
                  stroke="#a78bfa"
                  strokeWidth="2"
                  strokeDasharray="3 2"
                />
                <circle cx="7" cy="7" r="3.5" fill="#a78bfa" opacity="0.7" />
              </svg>
              <span className="text-[10px] font-mono text-text-muted">
                VSC pit
              </span>
            </div>
          </>
        )}
        <div className="flex items-center gap-1.5">
          <div className="w-8 h-0.5 border-t border-dashed border-text-muted/60" />
          <span className="text-[10px] font-mono text-text-muted">
            Field avg
          </span>
        </div>
      </div>

      {/* Fastest stop callout */}
      {fastestStop && (
        <div className="flex items-center gap-1.5 text-[10px] font-mono">
          <span className="text-text-muted uppercase tracking-widest">
            Fastest stop
          </span>
          <span className="text-text-muted">·</span>
          <span className="font-bold" style={{ color: fastestStop.teamColor }}>
            {fastestStop.driverCode}
          </span>
          <span className="text-text-secondary">
            {fastestStop.duration.toFixed(2)}s
          </span>
          <span className="text-text-muted">lap {fastestStop.lap}</span>
        </div>
      )}

      {stops.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-text-muted text-sm font-mono">
            No stops match current filters.
          </p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart margin={{ top: 16, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={CHART_COLORS.borderPrimary}
            />

            {/* SC/VSC background bands */}
            {showBands &&
              scLapRanges.map((range) => (
                <ReferenceArea
                  key={`sc-band-${range.type}-${range.start}`}
                  x1={range.start - 0.5}
                  x2={range.end + 0.5}
                  fill={range.type === "SC" ? "#f59e0b" : "#a78bfa"}
                  fillOpacity={0.07}
                  stroke="none"
                />
              ))}

            <XAxis
              type="number"
              dataKey="lap"
              name="Lap"
              domain={[1, totalLaps]}
              tick={{
                fill: CHART_COLORS.textTertiary,
                fontSize: 10,
                fontFamily: "monospace",
              }}
              label={{
                value: "Lap",
                position: "insideBottomRight",
                offset: -4,
                fill: CHART_COLORS.textTertiary,
                fontSize: 10,
                fontFamily: "monospace",
              }}
            />
            <YAxis
              type="number"
              dataKey="duration"
              name="Duration"
              domain={[domainMin, domainMax]}
              tickFormatter={(v) => `${(v as number).toFixed(0)}s`}
              tick={{
                fill: CHART_COLORS.textTertiary,
                fontSize: 10,
                fontFamily: "monospace",
              }}
              axisLine={false}
              tickLine={false}
              width={36}
            />

            <ReferenceLine
              y={fieldAvg}
              stroke={CHART_COLORS.textMuted}
              strokeDasharray="4 4"
              strokeWidth={1}
            />

            <Tooltip
              cursor={false}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0]?.payload as PitStopWithLayout;
                return (
                  <div className="bg-bg-tertiary border border-border-primary rounded-sm p-2 shadow-lg text-xs space-y-1">
                    <p
                      className="font-bold font-mono"
                      style={{ color: d.teamColor }}
                    >
                      {d.driverCode}
                    </p>
                    <p className="text-text-secondary font-mono">
                      Lap {d.lap} · {d.duration.toFixed(2)}s
                    </p>
                    {(d.isSc || d.isVsc) && (
                      <p
                        className="font-mono font-bold"
                        style={{ color: d.isVsc ? "#a78bfa" : "#f59e0b" }}
                      >
                        {d.isVsc ? "VSC" : "SC"} — neutralised stop
                      </p>
                    )}
                    <p className="text-text-muted font-mono">
                      vs avg: {d.duration - fieldAvg > 0 ? "+" : ""}
                      {(d.duration - fieldAvg).toFixed(2)}s
                    </p>
                  </div>
                );
              }}
            />

            <Scatter data={stops} shape={PitDot} />
          </ScatterChart>
        </ResponsiveContainer>
      )}

      {/* Per-driver total time lost */}
      {driverTotals.length > 0 && (
        <div className="pt-2 border-t border-border-primary/40 space-y-2">
          <p className="text-[10px] font-mono text-text-muted uppercase tracking-widest">
            Total time lost
          </p>
          <div className="flex flex-wrap gap-1.5">
            {driverTotals.map(([code, info]) => (
              <div
                key={code}
                className="flex items-center gap-1.5 bg-bg-elevated rounded-sm px-2 py-1"
              >
                <div
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: info.color }}
                />
                <span className="text-[10px] font-mono font-bold text-text-secondary">
                  {code}
                </span>
                <span className="text-[10px] font-mono text-text-muted">
                  {info.total.toFixed(1)}s
                </span>
                {info.count > 1 && (
                  <span className="text-[10px] font-mono text-text-muted/60">
                    ×{info.count}
                  </span>
                )}
                {info.scStops > 0 && (
                  <span className="text-[10px] font-mono text-amber-500/80">
                    SC
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
