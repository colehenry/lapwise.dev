"use client";

import { useMemo, useRef } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHART_COLORS, CustomDot } from "@/components/chart-primitives";
import StableResponsiveContainer from "@/components/ui/StableResponsiveContainer";
import { darken } from "@/lib/color-utils";
import {
  CHART_DATA,
  DRIVER_TEAMS,
  DRIVERS,
} from "@/lib/homeAnalystPreviewData";

type TooltipEntry = {
  dataKey: string;
  name: string;
  value: number;
  color: string;
  payload?: { event_name?: string };
};

function PreviewTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const eventName = (
    payload[0]?.payload?.event_name ?? `Round ${label}`
  ).replace("Grand Prix", "GP");
  return (
    <div className="rounded-lg border border-border-primary bg-bg-tertiary p-3 shadow-xl">
      <p className="mb-2 font-bold text-text-primary text-xs">{eventName}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="mb-1 flex items-center gap-2">
          <div
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-xs font-bold text-text-primary">
            {entry.name}: {entry.value} pts
          </span>
        </div>
      ))}
    </div>
  );
}

function ChampionshipChart({
  onReady,
  teamColors,
}: {
  onReady?: () => void;
  teamColors: Map<string, string>;
}) {
  const completedRef = useRef(0);
  const driverColorMap = useMemo(() => {
    const colors: Record<string, string> = {};
    const teamCount: Record<string, number> = {};
    for (const d of DRIVERS) {
      const team = DRIVER_TEAMS[d.key];
      const base = teamColors.get(team);
      if (!base) {
        colors[d.key] = "var(--series-1)";
        continue;
      }
      const seen = teamCount[team] ?? 0;
      colors[d.key] = seen === 0 ? base : darken(base, 0.3);
      teamCount[team] = seen + 1;
    }
    return colors;
  }, [teamColors]);

  function handleAnimationEnd() {
    completedRef.current += 1;
    if (completedRef.current >= DRIVERS.length) {
      onReady?.();
    }
  }

  return (
    <div className="animate-fadeIn rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
      <p className="mb-2 text-[9px] font-mono uppercase tracking-[0.1em] text-text-muted">
        Points Progression · R1–R24
      </p>
      <div className="relative" style={{ height: 220 }}>
        <StableResponsiveContainer width="100%" height={220}>
          <LineChart
            data={CHART_DATA}
            margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
          >
            <defs>
              {DRIVERS.map((d) => (
                <filter
                  key={`glow-${d.key}`}
                  id={`preview-glow-${d.key}`}
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
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={CHART_COLORS.borderPrimary}
            />
            <XAxis
              dataKey="round"
              stroke={CHART_COLORS.textTertiary}
              tick={{ fill: CHART_COLORS.textTertiary, fontSize: 10 }}
              label={{
                value: "Round",
                position: "insideBottom",
                offset: -14,
                style: { fontWeight: "bold", fill: "white", fontSize: 11 },
              }}
              interval={3}
            />
            <YAxis
              stroke={CHART_COLORS.textTertiary}
              tick={{ fill: CHART_COLORS.textTertiary, fontSize: 10 }}
              label={{
                value: "Total Points",
                angle: -90,
                position: "center",
                dx: -30,
                style: { fontWeight: "bold", fill: "white", fontSize: 11 },
              }}
              domain={[0, 450]}
              width={60}
            />
            <Tooltip content={<PreviewTooltip />} />
            {DRIVERS.map((d) => (
              <Line
                key={d.key}
                type="linear"
                dataKey={d.key}
                name={d.name}
                stroke={driverColorMap[d.key]}
                strokeWidth={2}
                dot={<CustomDot />}
                activeDot={{
                  r: 6,
                  fill: driverColorMap[d.key],
                  stroke: driverColorMap[d.key],
                }}
                filter={`url(#preview-glow-${d.key})`}
                isAnimationActive={true}
                connectNulls={false}
                onAnimationEnd={handleAnimationEnd}
              />
            ))}
          </LineChart>
        </StableResponsiveContainer>

        {/* Legend — top-left overlay, same as PointsByRoundGraph */}
        <div className="pointer-events-none absolute left-20 top-2 rounded-sm border border-border-primary bg-bg-primary/90 p-2 backdrop-blur-sm">
          <div className="flex flex-col gap-1">
            {DRIVERS.map((d) => (
              <div key={d.key} className="flex items-center gap-2">
                <div
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: driverColorMap[d.key] }}
                />
                <span className="font-mono text-[10px] font-bold text-text-primary">
                  {d.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChampionshipChart;
