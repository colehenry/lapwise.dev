"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { SessionResultDetail } from "@/lib/types";

type QualifyingRound = "Q1" | "Q2" | "Q3";

type QualifyingGapPoint = {
  key: string;
  position: number | null;
  driverCode: string;
  driverName: string;
  teamColor: string;
  bestTime: number | null;
  bestRound: QualifyingRound | null;
  gap: number | null;
  left: number;
};

type PositionedGapPoint = QualifyingGapPoint & {
  labelLeft: number;
  laneY: number;
};

interface QualifyingSpreadChartProps {
  results: SessionResultDetail[];
}

const BASELINE_Y = 116;
const CHART_HEIGHT = 238;
const LABEL_MIN_GAP_PERCENT = 8.5;
const LANE_YS = [8, 34, 60, 86, 128, 154, 180, 206];

const formatTime = (seconds: number | null): string => {
  if (seconds === null) return "-";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toFixed(3).padStart(6, "0")}`;
};

const getQualifyingBestTime = (result: {
  q1_time_seconds: number | null;
  q2_time_seconds: number | null;
  q3_time_seconds: number | null;
}): { time: number | null; round: QualifyingRound | null } => {
  if (result.q3_time_seconds != null)
    return { time: result.q3_time_seconds, round: "Q3" };
  if (result.q2_time_seconds != null)
    return { time: result.q2_time_seconds, round: "Q2" };
  if (result.q1_time_seconds != null)
    return { time: result.q1_time_seconds, round: "Q1" };
  return { time: null, round: null };
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

function positionLabels(points: QualifyingGapPoint[]): PositionedGapPoint[] {
  const positioned = new Map<string, PositionedGapPoint>();
  const leftSide = points.filter((point) => point.left <= 50);
  const rightSide = points
    .filter((point) => point.left > 50)
    .sort((a, b) => b.left - a.left);

  const place = (
    sidePoints: QualifyingGapPoint[],
    direction: "left" | "right",
  ) => {
    const laneEdge = LANE_YS.map(() =>
      direction === "right"
        ? Number.NEGATIVE_INFINITY
        : Number.POSITIVE_INFINITY,
    );

    for (const point of sidePoints) {
      const preferredLeft = clamp(point.left, 4, 96);
      let bestLane = 0;
      let bestLabelLeft = preferredLeft;
      let bestCost = Number.POSITIVE_INFINITY;

      for (let laneIndex = 0; laneIndex < LANE_YS.length; laneIndex++) {
        const labelLeft =
          direction === "right"
            ? clamp(
                Math.max(
                  preferredLeft,
                  laneEdge[laneIndex] + LABEL_MIN_GAP_PERCENT,
                ),
                4,
                96,
              )
            : clamp(
                Math.min(
                  preferredLeft,
                  laneEdge[laneIndex] - LABEL_MIN_GAP_PERCENT,
                ),
                4,
                96,
              );
        const hasOverlap =
          direction === "right"
            ? labelLeft < laneEdge[laneIndex] + LABEL_MIN_GAP_PERCENT - 0.01
            : labelLeft > laneEdge[laneIndex] - LABEL_MIN_GAP_PERCENT + 0.01;
        const cost =
          Math.abs(labelLeft - preferredLeft) +
          (hasOverlap ? 1000 : 0) +
          laneIndex * 0.35;

        if (cost < bestCost) {
          bestCost = cost;
          bestLane = laneIndex;
          bestLabelLeft = labelLeft;
        }
      }

      laneEdge[bestLane] = bestLabelLeft;
      positioned.set(point.key, {
        ...point,
        labelLeft: bestLabelLeft,
        laneY: LANE_YS[bestLane],
      });
    }
  };

  place(leftSide, "right");
  place(rightSide, "left");

  return points.map(
    (point) =>
      positioned.get(point.key) ?? {
        ...point,
        labelLeft: clamp(point.left, 4, 96),
        laneY: LANE_YS[0],
      },
  );
}

export default function QualifyingSpreadChart({
  results,
}: QualifyingSpreadChartProps) {
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedDrivers(
      results
        .filter((result) => getQualifyingBestTime(result).time != null)
        .map((result) => result.driver.driver_code || result.driver.full_name),
    );
  }, [results]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const spread = useMemo(() => {
    const pole = results[0]
      ? getQualifyingBestTime(results[0])
      : { time: null, round: null };
    const poleTime = pole.time;

    const allPoints: QualifyingGapPoint[] = results.map((result) => {
      const best = getQualifyingBestTime(result);
      const gap =
        best.time != null && poleTime != null ? best.time - poleTime : null;

      return {
        key: result.driver.driver_code || result.driver.full_name,
        position: result.position,
        driverCode:
          result.driver.driver_code ||
          result.driver.full_name.slice(0, 3).toUpperCase(),
        driverName: result.driver.full_name,
        teamColor: result.team.team_color
          ? `#${result.team.team_color}`
          : "#a855f5",
        bestTime: best.time,
        bestRound: best.round,
        gap,
        left: 0,
      };
    });

    const selectedPoints = allPoints.filter((point) =>
      selectedDrivers.includes(point.key),
    );
    const timedPoints = selectedPoints
      .filter((point) => point.gap != null)
      .sort((a, b) => (a.gap ?? 0) - (b.gap ?? 0));
    const maxGap = Math.max(0, ...timedPoints.map((point) => point.gap ?? 0));
    const scaledPoints = timedPoints.map((point) => ({
      ...point,
      left: maxGap > 0 ? ((point.gap ?? 0) / maxGap) * 100 : 0,
    }));

    const points = positionLabels(scaledPoints);
    const noTimePoints = selectedPoints.filter((point) => point.gap == null);
    const topTenGap =
      timedPoints.length >= 10 ? (timedPoints[9].gap ?? null) : null;
    const medianGap =
      timedPoints.length > 0
        ? (timedPoints[Math.floor((timedPoints.length - 1) / 2)].gap ?? null)
        : null;

    return {
      allPoints,
      points,
      noTimePoints,
      poleTime,
      maxGap,
      topTenGap,
      medianGap,
    };
  }, [results, selectedDrivers]);

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider font-mono">
            Qualifying Spread
          </h3>
        </div>
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setShowDropdown(!showDropdown)}
            className="px-4 py-1.5 rounded-sm text-xs font-bold font-mono uppercase tracking-widest border border-border-primary text-text-secondary hover:border-purple-500 hover:text-purple-300 transition-colors duration-150 cursor-pointer"
          >
            Select ({selectedDrivers.length})
          </button>
          {showDropdown && (
            <div className="absolute right-0 top-full mt-1 bg-bg-tertiary border border-border-primary rounded-sm shadow-lg z-30 max-h-80 overflow-y-auto min-w-[240px]">
              {results.map((result) => {
                const driverKey =
                  result.driver.driver_code || result.driver.full_name;
                const isSelected = selectedDrivers.includes(driverKey);
                const teamColor = result.team.team_color
                  ? `#${result.team.team_color}`
                  : "#a855f5";

                return (
                  <label
                    key={driverKey}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-bg-elevated cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {
                        setSelectedDrivers((prev) =>
                          prev.includes(driverKey)
                            ? prev.filter((driver) => driver !== driverKey)
                            : [...prev, driverKey],
                        );
                      }}
                      className="w-4 h-4 accent-purple-500"
                    />
                    <span className="text-sm text-text-muted w-5 font-mono">
                      {result.position || "-"}
                    </span>
                    <span
                      className="text-sm font-semibold"
                      style={{ color: teamColor }}
                    >
                      {result.driver.full_name}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-5">
        <div className="border border-border-primary rounded-sm bg-bg-primary/30 px-3 py-2">
          <p className="text-[10px] text-text-muted font-mono uppercase tracking-widest">
            Pole
          </p>
          <p className="text-sm text-text-primary font-mono font-bold">
            {formatTime(spread.poleTime)}
          </p>
        </div>
        <div className="border border-border-primary rounded-sm bg-bg-primary/30 px-3 py-2">
          <p className="text-[10px] text-text-muted font-mono uppercase tracking-widest">
            Top 10
          </p>
          <p className="text-sm text-text-primary font-mono font-bold">
            {spread.topTenGap != null
              ? `+${spread.topTenGap.toFixed(3)}s`
              : "-"}
          </p>
        </div>
        <div className="border border-border-primary rounded-sm bg-bg-primary/30 px-3 py-2">
          <p className="text-[10px] text-text-muted font-mono uppercase tracking-widest">
            Median
          </p>
          <p className="text-sm text-text-primary font-mono font-bold">
            {spread.medianGap != null
              ? `+${spread.medianGap.toFixed(3)}s`
              : "-"}
          </p>
        </div>
        <div className="border border-border-primary rounded-sm bg-bg-primary/30 px-3 py-2">
          <p className="text-[10px] text-text-muted font-mono uppercase tracking-widest">
            Spread
          </p>
          <p className="text-sm text-text-primary font-mono font-bold">
            +{spread.maxGap.toFixed(3)}s
          </p>
        </div>
      </div>

      {spread.points.length > 0 ? (
        <div className="rounded-sm border border-border-primary bg-bg-primary/30 px-5 py-4 overflow-hidden">
          <div className="relative" style={{ height: CHART_HEIGHT }}>
            <svg
              className="absolute inset-0 w-full h-full overflow-visible"
              viewBox={`0 0 100 ${CHART_HEIGHT}`}
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <line
                x1="0"
                x2="100"
                y1={BASELINE_Y}
                y2={BASELINE_Y}
                stroke="var(--color-border-secondary, #3a3a45)"
                strokeWidth="0.4"
              />
              {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
                <line
                  key={tick}
                  x1={tick * 100}
                  x2={tick * 100}
                  y1="20"
                  y2={CHART_HEIGHT - 20}
                  stroke="var(--color-border-primary, #2a2a35)"
                  strokeWidth="0.25"
                />
              ))}
              {spread.points.map((point) => {
                const labelAnchorY =
                  point.laneY < BASELINE_Y ? point.laneY + 22 : point.laneY;
                return (
                  <line
                    key={`${point.key}-line`}
                    x1={point.labelLeft}
                    x2={point.left}
                    y1={labelAnchorY}
                    y2={BASELINE_Y}
                    stroke={point.teamColor}
                    strokeWidth="0.35"
                    opacity="0.7"
                  />
                );
              })}
            </svg>

            {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
              <span
                key={tick}
                className="absolute bottom-0 -translate-x-1/2 text-[10px] text-text-muted font-mono"
                style={{ left: `${tick * 100}%` }}
              >
                +{(spread.maxGap * tick).toFixed(spread.maxGap < 1 ? 2 : 1)}s
              </span>
            ))}

            {spread.points.map((point) => (
              <div
                key={`${point.key}-dot`}
                className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-bg-tertiary border-2 shadow-sm ${
                  point.gap === 0 ? "w-3 h-3" : "w-2.5 h-2.5"
                }`}
                style={{
                  left: `${point.left}%`,
                  top: BASELINE_Y,
                  borderColor: point.teamColor,
                }}
                title={`${point.position ? `P${point.position} ` : ""}${point.driverName} · ${point.bestRound ?? "-"} ${formatTime(point.bestTime)} · ${point.gap != null ? `+${point.gap.toFixed(3)}s` : "No time"}`}
              />
            ))}

            {spread.points.map((point) => {
              const isPole = point.gap === 0;
              const title = `${point.position ? `P${point.position} ` : ""}${point.driverName} · ${point.bestRound ?? "-"} ${formatTime(point.bestTime)} · ${point.gap != null ? `+${point.gap.toFixed(3)}s` : "No time"}`;

              return (
                <div
                  key={point.key}
                  className="absolute -translate-x-1/2 group"
                  style={{
                    left: `${point.labelLeft}%`,
                    top: point.laneY,
                  }}
                  title={title}
                >
                  <div
                    className={`h-6 min-w-11 px-1.5 rounded-sm border bg-bg-tertiary/95 shadow-sm flex items-center justify-center transition-transform group-hover:scale-110 ${
                      isPole ? "text-text-primary" : "text-text-secondary"
                    }`}
                    style={{ borderColor: point.teamColor }}
                  >
                    <span className="text-[10px] font-mono font-bold">
                      {point.driverCode}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-sm border border-border-primary bg-bg-primary/30 px-4 py-8 text-center">
          <p className="text-text-muted text-sm font-mono">
            Select timed drivers to view the qualifying spread.
          </p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {spread.points.slice(0, 12).map((point) => (
          <div
            key={`${point.key}-chip`}
            className="flex items-center gap-2 border border-border-primary rounded-sm bg-bg-primary/20 px-2 py-1"
          >
            <span
              className="w-1.5 h-5 rounded-sm"
              style={{ backgroundColor: point.teamColor }}
            />
            <span className="text-[10px] text-text-primary font-mono font-bold">
              {point.driverCode}
            </span>
            <span className="text-[10px] text-text-muted font-mono">
              {point.gap === 0 ? "POLE" : `+${(point.gap ?? 0).toFixed(3)}s`}
            </span>
          </div>
        ))}
        {spread.noTimePoints.map((point) => (
          <div
            key={`${point.key}-notime`}
            className="flex items-center gap-2 border border-red-500/30 rounded-sm bg-red-500/5 px-2 py-1"
          >
            <span className="text-[10px] text-red-400 font-mono font-bold">
              {point.driverCode}
            </span>
            <span className="text-[10px] text-red-300 font-mono">NO TIME</span>
          </div>
        ))}
      </div>
    </div>
  );
}
