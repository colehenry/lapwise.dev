"use client";

import { useState } from "react";

// Design system color constants — matches tokens in globals.css
export const CHART_COLORS = {
  bgTertiary: "#1e1e28", // bg-bg-tertiary
  borderPrimary: "#2a2a35", // border-border-primary
  textTertiary: "#999999", // text-text-tertiary
  textMuted: "#666666", // text-text-muted
  purple: "#a020f0", // purple-500
  purpleHover: "#8a1ad0", // purple-700 hover
} as const;

export const CHART_TYPOGRAPHY = {
  titleClassName:
    "text-xs font-bold font-mono text-text-secondary uppercase tracking-widest",
  keyClassName:
    "[font-family:var(--font-space-grotesk)] text-xs font-semibold text-text-secondary tracking-[0.025em]",
  tooltipTitleClassName:
    "[font-family:var(--font-space-grotesk)] font-semibold text-text-primary tracking-[0.025em]",
  tooltipValueClassName:
    "[font-family:var(--font-space-grotesk)] font-semibold text-text-secondary tracking-[0.02em]",
  axisLabelClassName:
    "text-[11px] font-bold text-text-muted font-mono uppercase tracking-[0.2em]",
} as const;

export const CHART_AXIS_LABEL_STYLE = {
  fill: CHART_COLORS.textMuted,
  fontSize: 11,
  fontFamily: "var(--font-jetbrains)",
  fontWeight: 700,
} as const;

export interface RangeSelectorProps {
  availableYears: number[];
  currentStart: number;
  currentEnd: number;
  onRangeSelect: (start: number, end: number) => void;
  onClose: () => void;
}

export function RangeSelector({
  availableYears,
  currentStart,
  currentEnd,
  onRangeSelect,
  onClose,
}: RangeSelectorProps) {
  const [startYear, setStartYear] = useState(currentStart);
  const [endYear, setEndYear] = useState(currentEnd);
  const [error, setError] = useState("");

  const handleApply = () => {
    if (endYear - startYear > 4) {
      setError("Maximum range is 5 years");
      return;
    }
    if (startYear > endYear) {
      setError("Start year must be before end year");
      return;
    }
    onRangeSelect(startYear, endYear);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-bg-tertiary border border-border-primary rounded-sm p-6 max-w-md w-full mx-4">
        <h3 className="text-xl font-bold text-white mb-4">Select Year Range</h3>
        <p className="text-sm text-text-tertiary mb-4">Maximum 5 years</p>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="range-start-year"
              className="block text-sm text-text-tertiary mb-2"
            >
              Start Year
            </label>
            <select
              id="range-start-year"
              value={startYear}
              onChange={(e) => {
                setStartYear(Number(e.target.value));
                setError("");
              }}
              className="w-full px-3 py-2 bg-bg-elevated border border-border-primary rounded text-white"
            >
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="range-end-year"
              className="block text-sm text-text-tertiary mb-2"
            >
              End Year
            </label>
            <select
              id="range-end-year"
              value={endYear}
              onChange={(e) => {
                setEndYear(Number(e.target.value));
                setError("");
              }}
              className="w-full px-3 py-2 bg-bg-elevated border border-border-primary rounded text-white"
            >
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-bg-elevated text-text-muted rounded-sm border border-border-primary font-mono text-xs font-bold uppercase tracking-widest transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="flex-1 px-4 py-2 bg-purple-500/20 border border-purple-500 text-purple-300 rounded-sm font-mono text-xs font-bold uppercase tracking-widest transition-colors"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

interface SeasonAxisTickProps {
  x?: number;
  y?: number;
  payload?: { value: string | number };
}

export function CustomXAxisTickSeason(props: SeasonAxisTickProps) {
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
}

interface RaceAxisTickProps {
  x?: number;
  y?: number;
  payload?: {
    value: string | number;
    showYearLabel?: boolean;
    year?: string | number;
  };
}

export function CustomXAxisTickRace(props: RaceAxisTickProps) {
  const { x, y, payload } = props;
  if (!payload || !payload.value) return null;
  if (!payload.showYearLabel) return null;
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
        {payload.year}
      </text>
    </g>
  );
}

interface ChartDotProps {
  cx?: number;
  cy?: number;
  payload?: { team_color?: string };
  stroke?: string;
  fill?: string;
}

export function CustomDot({ cx, cy, payload, stroke }: ChartDotProps) {
  // Recharts passes fill="#fff" by default for Line dots — ignore it.
  // Use stroke (= Line's stroke prop = team color), then payload.team_color as fallback.
  const color =
    stroke && stroke !== "none"
      ? stroke
      : payload?.team_color
        ? `#${payload.team_color}`
        : CHART_COLORS.purple;
  return (
    <circle cx={cx} cy={cy} r={4} fill={color} stroke={color} strokeWidth={1} />
  );
}

interface ActiveDotProps {
  cx?: number;
  cy?: number;
  payload?: { team_color?: string };
}

export function CustomActiveDot({ cx, cy, payload }: ActiveDotProps) {
  const color = payload?.team_color
    ? `#${payload.team_color}`
    : CHART_COLORS.purple;
  return (
    <circle cx={cx} cy={cy} r={6} fill={color} stroke={color} strokeWidth={2} />
  );
}
