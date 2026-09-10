"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CHART_COLORS,
  CHART_TYPOGRAPHY,
  resolveChartSeriesColor,
} from "@/components/charts/chart-primitives";
import { useTheme } from "@/components/providers/ThemeProvider";
import StableResponsiveContainer from "@/components/ui/StableResponsiveContainer";
import { teamTint } from "@/lib/consoleFormat";
import type { ProgressionChartPoint } from "@/lib/queries/pointsProgression";

/** Two to four lines; more and the band stops being an illustration. */
const MAX_LINES = 3;

/** One entity's line, already resolved to a colour and a key. */
export type ProgressionSeries = {
  key: string;
  /** The full name, as the season chart's key and tooltip both show. */
  name: string;
  color: string | null;
  progression: {
    round: string;
    cumulative_points: number;
    event_name: string | null;
  }[];
  finalPosition: number;
};

type TooltipEntry = {
  dataKey?: string | number;
  value?: number;
  color?: string;
  name?: string;
};

function RoundTick({
  x,
  y,
  payload,
}: {
  x?: number;
  y?: number;
  payload?: { value?: string };
}) {
  const raw = payload?.value ?? "";
  if (raw === "0") return null;
  /* Sprints read `12-s`, the way the season chart writes them, rather than
     being hidden — they are real points and real steps on this axis. */
  const value = raw.replace("-sprint", "-s");
  return (
    <text
      x={x}
      y={(y ?? 0) + 12}
      textAnchor="middle"
      fill={CHART_COLORS.textMuted}
      fontSize={11}
      className="font-mono"
    >
      {value}
    </text>
  );
}

function ProgressionTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: (TooltipEntry & { payload?: ProgressionChartPoint })[];
  label?: string;
}) {
  if (!active || !payload?.length || label === "0") return null;

  const raw = payload[0]?.payload?.event_name;
  const event = (typeof raw === "string" ? raw : `Round ${label}`).replace(
    "Grand Prix",
    "GP",
  );
  const sprint = String(label ?? "").endsWith("-sprint") ? ": Sprint" : "";
  const rows = payload.filter((entry) => entry.value != null);
  if (rows.length === 0) return null;

  return (
    <div className="rounded-lg border border-line-soft bg-surface-panel p-3 shadow-xl">
      <p className={`${CHART_TYPOGRAPHY.tooltipTitleClassName} mb-2`}>
        {event}
        {sprint}
      </p>
      {rows.map((entry) => (
        <div
          key={String(entry.dataKey)}
          className="mb-1 flex items-center gap-2"
        >
          <span
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-[12px] text-ink-base">{entry.name}</span>
          <span className="ml-auto font-mono text-[12px] tabular-nums text-ink-strong">
            {(entry.value ?? 0).toFixed(0)} pts
          </span>
        </div>
      ))}
    </div>
  );
}

export default function ClutchProgressionChart({
  series,
}: {
  series: ProgressionSeries[] | undefined;
}) {
  const { theme } = useTheme();

  const chart = useMemo(() => {
    if (!series || series.length === 0) return null;
    const lines = [...series]
      .sort((a, b) => a.finalPosition - b.finalPosition)
      .slice(0, MAX_LINES)
      .map((entity) => ({
        ...entity,
        color: resolveChartSeriesColor(
          teamTint(entity.color),
          theme,
          CHART_COLORS.neutralStroke,
        ),
        total: Math.round(
          entity.progression[entity.progression.length - 1]
            ?.cumulative_points ?? 0,
        ),
      }));
    if (lines[0].progression.length < 2) return null;

    const rows: ProgressionChartPoint[] = lines[0].progression.map(
      (round, index) => {
        const point: ProgressionChartPoint = {
          round: round.round,
          event_name: round.event_name,
        };
        for (const line of lines) {
          point[line.key] = line.progression[index]?.cumulative_points ?? null;
        }
        return point;
      },
    );

    return { lines, rows };
  }, [series, theme]);

  if (!chart) return null;

  return (
    /* The key sits inside the plot, top-left, where cumulative points leave the
       canvas empty. Below the chart it collided with the follow-up chips. */
    <div className="relative h-full w-full">
      <StableResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chart.rows}
          margin={{ top: 28, right: 16, bottom: 0, left: -14 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={CHART_COLORS.borderPrimary}
          />
          <XAxis
            dataKey="round"
            stroke={CHART_COLORS.borderPrimary}
            height={26}
            interval={0}
            tick={<RoundTick />}
          />
          <YAxis
            stroke={CHART_COLORS.borderPrimary}
            tick={{ fill: CHART_COLORS.textMuted, fontSize: 11 }}
            width={44}
          />
          <Tooltip
            content={<ProgressionTooltip />}
            cursor={{ stroke: CHART_COLORS.borderPrimary }}
          />
          {chart.lines.map((line) => (
            <Line
              key={line.key}
              type="linear"
              dataKey={line.key}
              name={line.name}
              stroke={line.color}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </StableResponsiveContainer>

      {/* The same key the season chart uses: a swatch and the name, in a
          panel over the top-left of the plot. Nothing else belongs in it. */}
      <div className="pointer-events-none absolute left-14 top-2 rounded-sm border border-line-soft bg-surface-page/90 p-3 backdrop-blur-sm">
        <div className="flex flex-col gap-1.5">
          {chart.lines.map((line) => (
            <div key={line.key} className="flex items-center gap-2">
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: line.color }}
              />
              <span className={CHART_TYPOGRAPHY.keyClassName}>{line.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
