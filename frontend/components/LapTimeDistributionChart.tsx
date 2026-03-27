"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CHART_COLORS } from "@/components/chart-primitives";
import Skeleton from "@/components/ui/Skeleton";
import { apiHeaders, apiUrl } from "@/lib/api";
import {
  type DistributionLap,
  type DriverLapDistribution,
  distDriverKey,
  type LapDistributionResponse,
} from "@/lib/types";

interface LapTimeDistributionChartProps {
  season: number;
  round: number;
}

// ── Layout constants ──────────────────────────────────────────────────────────
const ROW_HEIGHT = 54;
const KDE_PEAK_H = 40;
const BASELINE_OFFSET = 8;
const LABEL_W = 72;
const TIME_W = 96;
const X_AXIS_H = 30;
const KDE_GRID_PTS = 200;
const SVG_VIEWBOX_W = 1000;

// ── Compound colours ──────────────────────────────────────────────────────────
const COMPOUND_COLORS: Record<string, string> = {
  SOFT: "#ef4444",
  MEDIUM: "#eab308",
  HARD: "#e5e7eb",
  INTERMEDIATE: "#22c55e",
  WET: "#3b82f6",
};
const COMPOUND_ORDER = ["SOFT", "MEDIUM", "HARD", "INTERMEDIATE", "WET"];

// ── Helpers ───────────────────────────────────────────────────────────────────
const formatLapTime = (s: number): string => {
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem.toFixed(3).padStart(6, "0")}`;
};

const formatAxisTick = (s: number): string => {
  const m = Math.floor(s / 60);
  const rem = Math.floor(s % 60);
  return `${m}:${rem.toString().padStart(2, "0")}`;
};

function silverman(data: number[]): number {
  const n = data.length;
  if (n < 2) return 0.5;
  const mean = data.reduce((a, b) => a + b, 0) / n;
  const std = Math.sqrt(data.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
  return Math.max(0.05, 1.06 * std * n ** -0.2);
}

function computeKDE(data: number[], xGrid: number[]): number[] {
  if (data.length === 0) return xGrid.map(() => 0);
  const bw = silverman(data);
  const inv = 1 / (bw * Math.sqrt(2 * Math.PI) * data.length);
  const densities = xGrid.map(
    (x) =>
      inv *
      data.reduce((s, xi) => s + Math.exp(-0.5 * ((x - xi) / bw) ** 2), 0),
  );
  const maxD = Math.max(...densities, 1e-10);
  return densities.map((d) => d / maxD);
}

function buildPaths(
  kdePoints: { x: number; y: number }[],
  xMin: number,
  xMax: number,
  baselineY: number,
): { fill: string; line: string } {
  if (kdePoints.length === 0) return { fill: "", line: "" };
  const toX = (t: number) => ((t - xMin) / (xMax - xMin)) * SVG_VIEWBOX_W;
  const toY = (d: number) => baselineY - d * KDE_PEAK_H;
  const pts = kdePoints
    .map((p) => `${toX(p.x).toFixed(1)},${toY(p.y).toFixed(1)}`)
    .join(" ");
  const x0 = toX(kdePoints[0].x).toFixed(1);
  const xN = toX(kdePoints[kdePoints.length - 1].x).toFixed(1);
  const bl = baselineY.toFixed(1);
  return {
    fill: `M${x0},${bl} L${pts.replace(/ /g, " L")} L${xN},${bl}Z`,
    line: `M${pts.replace(/ /g, " L")}`,
  };
}

// ── Tooltip state ─────────────────────────────────────────────────────────────
interface TooltipState {
  rowIdx: number;
  snap: DistributionLap; // nearest actual lap
  clientX: number;
  clientY: number;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function LapTimeDistributionChart({
  season,
  round,
}: LapTimeDistributionChartProps) {
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedCompound, setSelectedCompound] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const { data, isLoading } = useQuery<LapDistributionResponse | null>({
    queryKey: ["lap-distribution", season, round],
    queryFn: async () => {
      const res = await fetch(
        apiUrl(`/api/results/${season}/${round}/lap-time-distribution`),
        { cache: "no-store", headers: apiHeaders() },
      );
      if (!res.ok) return null;
      return res.json();
    },
    enabled: season >= 2018,
  });

  useEffect(() => {
    if (data?.drivers) {
      const sorted = [...data.drivers].sort(
        (a, b) => (a.final_position ?? 999) - (b.final_position ?? 999),
      );
      setSelectedDrivers(sorted.slice(0, 10).map((d) => distDriverKey(d)));
    }
  }, [data]);

  const availableCompounds = useMemo(() => {
    if (!data) return [];
    const seen = new Set<string>();
    for (const d of data.drivers) {
      for (const lap of d.laps) {
        if (lap.compound) seen.add(lap.compound);
      }
    }
    return COMPOUND_ORDER.filter((c) => seen.has(c));
  }, [data]);

  const allDriversSorted = useMemo(() => {
    if (!data) return [];
    return [...data.drivers].sort(
      (a, b) => (a.final_position ?? 999) - (b.final_position ?? 999),
    );
  }, [data]);

  const visibleDrivers = useMemo(
    () =>
      allDriversSorted.filter((d) =>
        selectedDrivers.includes(distDriverKey(d)),
      ),
    [allDriversSorted, selectedDrivers],
  );

  // Per-driver filtered lap details (full objects, not just times)
  const perDriverData = useMemo(
    () =>
      visibleDrivers.map((driver) => {
        const lapDetails = driver.laps.filter(
          (l) => selectedCompound === null || l.compound === selectedCompound,
        );
        const times = lapDetails.map((l) => l.lap_time_seconds);
        const avg =
          times.length > 0
            ? times.reduce((a, b) => a + b, 0) / times.length
            : null;
        return { driver, lapDetails, times, avg };
      }),
    [visibleDrivers, selectedCompound],
  );

  const [xMin, xMax] = useMemo(() => {
    const all = perDriverData.flatMap((d) => d.times);
    if (all.length === 0) return [80, 110];
    const mean = all.reduce((a, b) => a + b, 0) / all.length;
    const std = Math.sqrt(
      all.reduce((a, b) => a + (b - mean) ** 2, 0) / all.length,
    );
    const filtered = all.filter((t) => t <= mean + 3 * std);
    const lo = Math.min(...filtered);
    const hi = Math.max(...filtered);
    const maxBw = Math.max(
      ...perDriverData.map(({ times }) =>
        times.length >= 2 ? silverman(times) : 0,
      ),
      0,
    );
    const rightPad = (hi - lo) * 0.04;
    return [lo - 3 * maxBw, hi + rightPad];
  }, [perDriverData]);

  const curves = useMemo(() => {
    const xGrid = Array.from(
      { length: KDE_GRID_PTS },
      (_, i) => xMin + (i / (KDE_GRID_PTS - 1)) * (xMax - xMin),
    );
    return perDriverData.map(({ driver, times, avg }) => {
      const densities = computeKDE(times, xGrid);
      const points = xGrid.map((x, i) => ({ x, y: densities[i] }));
      return { driver, avg, points: times.length >= 3 ? points : [] };
    });
  }, [perDriverData, xMin, xMax]);

  const xTicks = useMemo(() => {
    const range = xMax - xMin;
    const rawStep = range / 5;
    const step = rawStep < 2 ? 1 : rawStep < 5 ? 2 : rawStep < 10 ? 5 : 10;
    const first = Math.ceil(xMin / step) * step;
    const ticks: number[] = [];
    for (let t = first; t <= xMax + 0.001; t += step) ticks.push(t);
    return ticks;
  }, [xMin, xMax]);

  const chartH = visibleDrivers.length * ROW_HEIGHT;

  const teamColor = (d: DriverLapDistribution) =>
    d.team_color ? `#${d.team_color}` : CHART_COLORS.textTertiary;

  // ── Mouse handlers ────────────────────────────────────────────────────────
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;

      const relX = (e.clientX - rect.left) / rect.width;
      const relY = e.clientY - rect.top; // Y scale = 1, so CSS px = SVG units
      const rowIdx = Math.floor(relY / ROW_HEIGHT);

      if (rowIdx < 0 || rowIdx >= perDriverData.length) {
        setTooltip(null);
        return;
      }

      const { lapDetails } = perDriverData[rowIdx];
      if (lapDetails.length === 0) {
        setTooltip(null);
        return;
      }

      const hoveredTime = xMin + relX * (xMax - xMin);

      // Snap to the nearest actual lap time
      const snap = lapDetails.reduce((best, cur) =>
        Math.abs(cur.lap_time_seconds - hoveredTime) <
        Math.abs(best.lap_time_seconds - hoveredTime)
          ? cur
          : best,
      );

      setTooltip({ rowIdx, snap, clientX: e.clientX, clientY: e.clientY });
    },
    [perDriverData, xMin, xMax],
  );

  const handleMouseLeave = useCallback(() => setTooltip(null), []);

  // ── Early returns ─────────────────────────────────────────────────────────
  if (season < 2018) {
    return (
      <p className="text-sm text-text-muted font-mono text-center py-8">
        Lap time data not available before 2018
      </p>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 10 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder
          <Skeleton key={i} variant="rectangular" height="48px" />
        ))}
      </div>
    );
  }

  if (!data || data.drivers.length === 0) {
    return (
      <p className="text-sm text-text-muted font-mono text-center py-8">
        No lap time data available for this race
      </p>
    );
  }

  return (
    <div>
      {/* ── Controls ── */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setSelectedCompound(null)}
            className={`px-3 py-1 rounded-sm text-[10px] font-bold font-mono uppercase tracking-widest border transition-colors duration-150 ${
              selectedCompound === null
                ? "border-border-secondary text-text-secondary opacity-100"
                : "border-border-secondary text-text-muted opacity-40 hover:opacity-70"
            }`}
          >
            All
          </button>
          {availableCompounds.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() =>
                setSelectedCompound(selectedCompound === c ? null : c)
              }
              style={{
                borderColor: COMPOUND_COLORS[c] ?? "#999",
                color: COMPOUND_COLORS[c] ?? "#999",
              }}
              className={`px-3 py-1 rounded-sm text-[10px] font-bold font-mono uppercase tracking-widest border transition-colors duration-150 ${
                selectedCompound === c
                  ? "opacity-100"
                  : "opacity-40 hover:opacity-70"
              }`}
            >
              {c === "INTERMEDIATE" ? "INTER" : c}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setShowDropdown((v) => !v)}
            className="px-4 py-1.5 rounded-sm text-xs font-bold font-mono uppercase tracking-widest border border-border-secondary text-text-secondary hover:border-purple-500 hover:text-purple-300 transition-colors duration-150"
          >
            Select ({selectedDrivers.length})
          </button>

          {showDropdown && (
            <div className="absolute right-0 top-full mt-1 bg-bg-tertiary border border-border-primary rounded-sm shadow-xl z-10 min-w-[200px] max-h-[280px] overflow-y-auto">
              <div className="p-2 border-b border-border-primary flex gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setSelectedDrivers(
                      allDriversSorted.map((d) => distDriverKey(d)),
                    )
                  }
                  className="flex-1 text-[10px] font-mono font-bold uppercase tracking-widest text-text-muted hover:text-text-secondary transition-colors"
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDrivers([])}
                  className="flex-1 text-[10px] font-mono font-bold uppercase tracking-widest text-text-muted hover:text-text-secondary transition-colors"
                >
                  None
                </button>
              </div>
              {allDriversSorted.map((driver) => {
                const key = distDriverKey(driver);
                const isSelected = selectedDrivers.includes(key);
                const color = teamColor(driver);
                return (
                  <label
                    key={key}
                    className="flex items-center gap-2 px-3 py-1.5 hover:bg-bg-elevated cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() =>
                        setSelectedDrivers((prev) =>
                          isSelected
                            ? prev.filter((k) => k !== key)
                            : [...prev, key],
                        )
                      }
                      className="accent-purple-500"
                    />
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-xs font-mono text-text-secondary">
                      {driver.driver_code ?? driver.full_name}
                    </span>
                    <span className="ml-auto text-[10px] font-mono text-text-muted">
                      P{driver.final_position}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Ridge Plot ── */}
      {curves.length === 0 ? (
        <p className="text-sm text-text-muted font-mono text-center py-8">
          Select drivers to display
        </p>
      ) : (
        <div className="overflow-x-auto">
          <div style={{ minWidth: 480 }}>
            <div className="flex">
              {/* Left: driver labels */}
              <div style={{ width: LABEL_W, flexShrink: 0 }}>
                {curves.map(({ driver }) => (
                  <div
                    key={distDriverKey(driver)}
                    className="flex items-end justify-end pr-2.5"
                    style={{ height: ROW_HEIGHT }}
                  >
                    <span
                      className="text-[11px] font-bold font-mono leading-none"
                      style={{
                        color: teamColor(driver),
                        paddingBottom: BASELINE_OFFSET,
                      }}
                    >
                      {driver.driver_code ??
                        driver.full_name.split(" ").at(-1)}
                    </span>
                  </div>
                ))}
                <div style={{ height: X_AXIS_H }} />
              </div>

              {/* Middle: SVG curves + HTML x-axis */}
              <div className="flex-1 overflow-hidden min-w-0">
                <svg
                  ref={svgRef}
                  width="100%"
                  height={chartH}
                  viewBox={`0 0 ${SVG_VIEWBOX_W} ${chartH}`}
                  preserveAspectRatio="none"
                  onMouseMove={handleMouseMove}
                  onMouseLeave={handleMouseLeave}
                  style={{ cursor: "crosshair" }}
                  aria-hidden="true"
                >
                  <title>Lap time distribution curves</title>

                  {/* Grid lines */}
                  {xTicks.map((tick) => {
                    const x =
                      ((tick - xMin) / (xMax - xMin)) * SVG_VIEWBOX_W;
                    return (
                      <line
                        key={tick}
                        x1={x}
                        y1={0}
                        x2={x}
                        y2={chartH}
                        stroke={CHART_COLORS.borderPrimary}
                        strokeWidth={1}
                        vectorEffect="non-scaling-stroke"
                      />
                    );
                  })}

                  {/* Per-driver KDE curves */}
                  {curves.map(({ driver, points }, rowIdx) => {
                    const baselineY =
                      rowIdx * ROW_HEIGHT + ROW_HEIGHT - BASELINE_OFFSET;
                    const color = teamColor(driver);
                    const { fill, line } = buildPaths(
                      points,
                      xMin,
                      xMax,
                      baselineY,
                    );
                    const isHovered = tooltip?.rowIdx === rowIdx;
                    const driverLapDetails = perDriverData[rowIdx]?.lapDetails ?? [];

                    return (
                      <g key={distDriverKey(driver)}>
                        {/* Baseline */}
                        <line
                          x1={0}
                          y1={baselineY}
                          x2={SVG_VIEWBOX_W}
                          y2={baselineY}
                          stroke={color}
                          strokeWidth={0.8}
                          strokeOpacity={0.25}
                          vectorEffect="non-scaling-stroke"
                        />
                        {fill && (
                          <path
                            d={fill}
                            fill={color}
                            fillOpacity={isHovered ? 0.45 : 0.3}
                            stroke="none"
                          />
                        )}
                        {line && (
                          <path
                            d={line}
                            fill="none"
                            stroke={color}
                            strokeWidth={1.5}
                            strokeOpacity={0.9}
                            vectorEffect="non-scaling-stroke"
                          />
                        )}

                        {/* Hover: dots at every actual lap time */}
                        {isHovered &&
                          driverLapDetails.map((lap) => {
                            const cx =
                              ((lap.lap_time_seconds - xMin) /
                                (xMax - xMin)) *
                              SVG_VIEWBOX_W;
                            const isSnapped =
                              lap === tooltip?.snap;
                            return (
                              <circle
                                key={`${lap.lap_number}-${lap.lap_time_seconds}`}
                                cx={cx}
                                cy={baselineY}
                                r={isSnapped ? 5 : 2.5}
                                fill={isSnapped ? color : color}
                                fillOpacity={isSnapped ? 1 : 0.5}
                                stroke={
                                  isSnapped ? CHART_COLORS.bgTertiary : "none"
                                }
                                strokeWidth={isSnapped ? 1.5 : 0}
                                vectorEffect="non-scaling-stroke"
                              />
                            );
                          })}

                        {/* Hover: vertical snap line */}
                        {isHovered && tooltip?.snap && (
                          <line
                            x1={
                              ((tooltip.snap.lap_time_seconds - xMin) /
                                (xMax - xMin)) *
                              SVG_VIEWBOX_W
                            }
                            y1={rowIdx * ROW_HEIGHT}
                            x2={
                              ((tooltip.snap.lap_time_seconds - xMin) /
                                (xMax - xMin)) *
                              SVG_VIEWBOX_W
                            }
                            y2={baselineY}
                            stroke={color}
                            strokeWidth={1}
                            strokeOpacity={0.6}
                            strokeDasharray="3 3"
                            vectorEffect="non-scaling-stroke"
                          />
                        )}
                      </g>
                    );
                  })}
                </svg>

                {/* X axis */}
                <div
                  className="relative border-t border-border-primary"
                  style={{ height: X_AXIS_H }}
                >
                  {xTicks.map((tick) => {
                    const pct = ((tick - xMin) / (xMax - xMin)) * 100;
                    return (
                      <span
                        key={tick}
                        className="absolute top-1.5 text-[10px] font-mono tabular-nums"
                        style={{
                          left: `${pct}%`,
                          transform: "translateX(-50%)",
                          color: CHART_COLORS.textTertiary,
                        }}
                      >
                        {formatAxisTick(tick)}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Right: avg lap times */}
              <div style={{ width: TIME_W, flexShrink: 0 }}>
                {curves.map(({ driver, avg }) => (
                  <div
                    key={distDriverKey(driver)}
                    className="flex items-end pl-2.5"
                    style={{ height: ROW_HEIGHT }}
                  >
                    <span
                      className="text-[11px] font-bold font-mono tabular-nums leading-none"
                      style={{
                        color: teamColor(driver),
                        paddingBottom: BASELINE_OFFSET,
                      }}
                    >
                      {avg !== null ? formatLapTime(avg) : "—"}
                    </span>
                  </div>
                ))}
                <div style={{ height: X_AXIS_H }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tooltip (fixed so it escapes overflow containers) ── */}
      {tooltip && curves[tooltip.rowIdx] && (
        <div
          className="pointer-events-none fixed z-50 px-3 py-2 rounded-sm shadow-xl border border-border-primary bg-bg-tertiary"
          style={{
            left: tooltip.clientX + 14,
            top: tooltip.clientY - 36,
          }}
        >
          <p
            className="text-[11px] font-bold font-mono mb-1"
            style={{
              color: teamColor(curves[tooltip.rowIdx].driver),
            }}
          >
            {curves[tooltip.rowIdx].driver.driver_code ??
              curves[tooltip.rowIdx].driver.full_name}
          </p>
          {tooltip.snap.lap_number !== null && (
            <p className="text-[10px] font-mono text-text-muted uppercase tracking-widest">
              Lap {tooltip.snap.lap_number}
            </p>
          )}
          <p className="text-[13px] font-bold font-mono tabular-nums text-text-primary">
            {formatLapTime(tooltip.snap.lap_time_seconds)}
          </p>
          {tooltip.snap.compound && (
            <p
              className="text-[10px] font-mono font-bold uppercase tracking-widest mt-0.5"
              style={{
                color: COMPOUND_COLORS[tooltip.snap.compound] ?? "#999",
              }}
            >
              {tooltip.snap.compound === "INTERMEDIATE"
                ? "INTER"
                : tooltip.snap.compound}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
