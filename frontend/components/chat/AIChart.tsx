"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CHART_AXIS_LABEL_STYLE,
  CHART_COLORS,
  CHART_TYPOGRAPHY,
} from "@/components/charts/chart-primitives";
import { useTheme } from "@/components/providers/ThemeProvider";
import Card from "@/components/ui/Card";
import StableResponsiveContainer from "@/components/ui/StableResponsiveContainer";
import { useEntityLinkColors } from "@/hooks/useEntityLinkColors";
import { resolveAIChartPalette } from "@/lib/ai-chart-palette";
import type { ChartConfig } from "@/lib/chat";
import { seriesColor } from "@/lib/palette";
import AIChartKey from "./AIChartKey";
import AIChartTooltip, { formatAIChartValue } from "./AIChartTooltip";

interface AIChartProps {
  config: ChartConfig;
}

function ChartAxes({ config }: { config: ChartConfig }) {
  return (
    <>
      <CartesianGrid
        strokeDasharray="3 3"
        stroke={CHART_COLORS.borderPrimary}
        vertical={false}
      />
      <XAxis
        dataKey={config.xKey}
        stroke={CHART_COLORS.textTertiary}
        tick={{ fill: CHART_COLORS.textTertiary, fontSize: 11 }}
        tickLine={false}
        axisLine={{ stroke: CHART_COLORS.borderPrimary }}
        tickMargin={8}
        minTickGap={16}
        height={48}
        label={{
          value: config.xLabel,
          position: "insideBottom",
          offset: -6,
          style: CHART_AXIS_LABEL_STYLE,
        }}
      />
      <YAxis
        stroke={CHART_COLORS.textTertiary}
        tick={{ fill: CHART_COLORS.textTertiary, fontSize: 11 }}
        tickLine={false}
        axisLine={false}
        width={54}
        label={{
          value: config.yLabel,
          angle: -90,
          position: "insideLeft",
          style: CHART_AXIS_LABEL_STYLE,
        }}
      />
    </>
  );
}

function ChartTooltip({ config }: { config: ChartConfig }) {
  return (
    <Tooltip
      cursor={{ fill: "var(--background-elevated)", opacity: 0.35 }}
      content={<AIChartTooltip xLabel={config.xLabel} yLabel={config.yLabel} />}
    />
  );
}

export default function AIChart({ config }: AIChartProps) {
  const { theme } = useTheme();
  const entityColors = useEntityLinkColors();
  const palette = resolveAIChartPalette(config, entityColors, theme);
  const seriesKeyItems = config.yKeys.map((key, index) => ({
    color: palette.series[index],
    label: config.seriesLabels?.[index] ?? key,
  }));
  const categoryColors =
    palette.categories ?? config.data.map((_, index) => seriesColor(index));
  const total = config.data.reduce((sum, row) => {
    const value = Number(row[config.yKeys[0]]);
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);
  const categoryKeyItems = config.data.map((row, index) => {
    const value = Number(row[config.yKeys[0]]);
    const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
    return {
      color: categoryColors[index],
      label: String(row[config.xKey] ?? "Unknown"),
      value:
        config.chartType === "pie"
          ? `${formatAIChartValue(value, config.yLabel)} · ${percentage}%`
          : formatAIChartValue(value, config.yLabel),
    };
  });

  return (
    <Card variant="default" padding="sm" className="min-w-0">
      <div className="mb-3 flex items-start justify-between gap-3 px-1">
        <h4 className={CHART_TYPOGRAPHY.titleClassName}>{config.title}</h4>
      </div>

      {config.chartType === "pie" ? (
        <div className="grid items-center gap-3 md:grid-cols-[minmax(0,3fr)_minmax(180px,2fr)]">
          <StableResponsiveContainer
            width="100%"
            height={250}
            initialHeight={250}
            initialWidth={460}
          >
            <PieChart>
              <Pie
                data={config.data}
                dataKey={config.yKeys[0]}
                nameKey={config.xKey}
                cx="50%"
                cy="50%"
                innerRadius={58}
                outerRadius={92}
                paddingAngle={2}
                stroke={CHART_COLORS.bgTertiary}
                strokeWidth={2}
              >
                {config.data.map((row, index) => (
                  <Cell
                    key={String(
                      row[config.xKey] ?? row[config.yKeys[0]] ?? index,
                    )}
                    fill={categoryColors[index]}
                  />
                ))}
              </Pie>
              <text
                x="50%"
                y="47%"
                textAnchor="middle"
                dominantBaseline="middle"
                fill={CHART_COLORS.textTertiary}
                className="font-bold font-mono text-2xl"
              >
                {total.toLocaleString()}
              </text>
              <text
                x="50%"
                y="58%"
                textAnchor="middle"
                dominantBaseline="middle"
                fill={CHART_COLORS.textMuted}
                className="font-mono text-[10px] uppercase tracking-widest"
              >
                Total {config.yLabel}
              </text>
              <ChartTooltip config={config} />
            </PieChart>
          </StableResponsiveContainer>
          <AIChartKey items={categoryKeyItems} vertical />
        </div>
      ) : (
        <>
          {config.chartType === "line" && seriesKeyItems.length > 1 && (
            <div className="mb-2 px-1">
              <AIChartKey items={seriesKeyItems} />
            </div>
          )}
          {(config.chartType === "bar" || config.chartType === "stacked_bar") &&
            palette.categories &&
            categoryKeyItems.length <= 10 && (
              <div className="mb-2 px-1">
                <AIChartKey items={categoryKeyItems} />
              </div>
            )}
          <StableResponsiveContainer
            width="100%"
            height={300}
            initialHeight={300}
            initialWidth={760}
          >
            {config.chartType === "line" ? (
              <LineChart
                data={config.data}
                margin={{ top: 12, right: 14, bottom: 4, left: 2 }}
              >
                <ChartAxes config={config} />
                <ChartTooltip config={config} />
                {config.yKeys.map((key, index) => (
                  <Line
                    key={key}
                    type="linear"
                    dataKey={key}
                    name={config.seriesLabels?.[index] ?? key}
                    stroke={palette.series[index]}
                    strokeWidth={2.5}
                    dot={{
                      r: 2.5,
                      fill: palette.series[index],
                      stroke: palette.series[index],
                    }}
                    activeDot={{
                      r: 5,
                      fill: palette.series[index],
                      stroke: CHART_COLORS.bgTertiary,
                      strokeWidth: 2,
                    }}
                    connectNulls={false}
                  />
                ))}
              </LineChart>
            ) : config.chartType === "scatter" ? (
              <ScatterChart margin={{ top: 12, right: 14, bottom: 4, left: 2 }}>
                <ChartAxes config={config} />
                <ChartTooltip config={config} />
                <Scatter
                  data={config.data}
                  name={config.seriesLabels?.[0] ?? config.yKeys[0]}
                  fill={palette.series[0]}
                />
              </ScatterChart>
            ) : (
              <BarChart
                data={config.data}
                margin={{ top: 12, right: 14, bottom: 4, left: 2 }}
              >
                <ChartAxes config={config} />
                <ChartTooltip config={config} />
                {config.yKeys.map((key, index) => (
                  <Bar
                    key={key}
                    dataKey={key}
                    name={config.seriesLabels?.[index] ?? key}
                    fill={palette.series[index]}
                    stackId={
                      config.chartType === "stacked_bar" ? "stack" : undefined
                    }
                    radius={
                      config.chartType === "stacked_bar"
                        ? undefined
                        : [4, 4, 0, 0]
                    }
                  >
                    {config.chartType === "bar" &&
                      palette.categories?.map((color, categoryIndex) => (
                        <Cell
                          key={`${key}-${String(config.data[categoryIndex]?.[config.xKey] ?? categoryIndex)}`}
                          fill={color}
                        />
                      ))}
                  </Bar>
                ))}
              </BarChart>
            )}
          </StableResponsiveContainer>
        </>
      )}
    </Card>
  );
}
