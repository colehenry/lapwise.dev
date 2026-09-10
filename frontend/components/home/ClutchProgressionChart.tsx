"use client";

import { useMemo } from "react";
import { teamTint } from "@/lib/consoleFormat";
import type { DriverProgression } from "@/lib/queries/pointsProgression";

const WIDTH = 560;
const HEIGHT = 220;
const PADDING = { top: 12, right: 62, bottom: 22, left: 8 };

/** Two to four lines; more and the band stops being an illustration. */
const MAX_LINES = 3;

type Series = {
  key: string;
  label: string;
  color: string;
  points: string;
  endX: number;
  endY: number;
  total: number;
};

/** Sprint rounds are real points, so they are steps; only whole rounds label. */
function isWholeRound(round: string): boolean {
  return !round.includes("-") && round !== "0";
}

export default function ClutchProgressionChart({
  drivers,
}: {
  drivers: DriverProgression[] | undefined;
}) {
  const chart = useMemo(() => {
    if (!drivers || drivers.length === 0) return null;
    const top = [...drivers]
      .sort((a, b) => a.final_position - b.final_position)
      .slice(0, MAX_LINES);
    const steps = top[0]?.progression.length ?? 0;
    if (steps < 2) return null;

    const peak = Math.max(
      1,
      ...top.flatMap((driver) =>
        driver.progression.map((round) => round.cumulative_points),
      ),
    );
    const plotWidth = WIDTH - PADDING.left - PADDING.right;
    const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;
    const x = (index: number) =>
      PADDING.left + (index / (steps - 1)) * plotWidth;
    const y = (value: number) =>
      PADDING.top + plotHeight - (value / peak) * plotHeight;

    const series: Series[] = top.map((driver) => {
      const last = driver.progression[driver.progression.length - 1];
      return {
        key: driver.driver_slug ?? driver.driver_code ?? driver.full_name,
        label: driver.driver_code ?? driver.full_name,
        color: teamTint(driver.team_color) ?? "var(--delta-neutral)",
        points: driver.progression
          .map(
            (round, index) =>
              `${x(index).toFixed(1)},${y(round.cumulative_points).toFixed(1)}`,
          )
          .join(" "),
        endX: x(driver.progression.length - 1),
        endY: y(last?.cumulative_points ?? 0),
        total: Math.round(last?.cumulative_points ?? 0),
      };
    });

    const ticks = top[0].progression
      .map((round, index) => ({ round: round.round, x: x(index) }))
      .filter((tick) => isWholeRound(tick.round));

    return { series, ticks, baselineY: y(0) };
  }, [drivers]);

  if (!chart) return null;

  return (
    <svg
      className="h-full w-full"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`Cumulative points by round: ${chart.series
        .map((line) => `${line.label} ${line.total}`)
        .join(", ")}`}
    >
      <title>Points by round</title>
      <line
        x1={PADDING.left}
        y1={chart.baselineY}
        x2={WIDTH - PADDING.right}
        y2={chart.baselineY}
        stroke="var(--line-soft)"
        strokeWidth={1}
      />
      {chart.ticks.map((tick) => (
        <text
          key={tick.round}
          x={tick.x}
          y={HEIGHT - 6}
          textAnchor="middle"
          className="fill-ink-faint font-mono"
          fontSize={8}
        >
          {tick.round}
        </text>
      ))}
      {chart.series.map((line) => (
        <g key={line.key}>
          <polyline
            points={line.points}
            fill="none"
            stroke={line.color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <circle cx={line.endX} cy={line.endY} r={3} fill={line.color} />
          <text
            x={line.endX + 7}
            y={line.endY + 3.5}
            className="font-mono"
            fontSize={10}
            fill={line.color}
          >
            {line.label} {line.total}
          </text>
        </g>
      ))}
    </svg>
  );
}
