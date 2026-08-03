"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CHART_AXIS_LABEL_STYLE,
  CHART_COLORS,
} from "@/components/charts/chart-primitives";
import Card from "@/components/ui/Card";
import type { ChartConfig } from "@/lib/chat";

import { SERIES_COLORS as DEFAULT_COLORS } from "@/lib/palette";

interface AIChartProps {
  config: ChartConfig;
}

export default function AIChart({ config }: AIChartProps) {
  const {
    chartType,
    title,
    xLabel,
    yLabel,
    data,
    xKey,
    yKeys,
    colors,
    seriesLabels,
  } = config;

  const chartColors =
    colors.length > 0 ? colors : DEFAULT_COLORS.slice(0, yKeys.length);

  return (
    <Card variant="default" padding="sm">
      <h4 className="text-text-primary text-sm font-medium mb-3 px-2">
        {title}
      </h4>
      <ResponsiveContainer width="100%" height={280}>
        {chartType === "line" ? (
          <LineChart data={data}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={CHART_COLORS.borderPrimary}
            />
            <XAxis
              dataKey={xKey}
              tick={{ fill: CHART_COLORS.textTertiary, fontSize: 11 }}
              label={{
                value: xLabel,
                position: "insideBottom",
                offset: -5,
                style: CHART_AXIS_LABEL_STYLE,
              }}
            />
            <YAxis
              tick={{ fill: CHART_COLORS.textTertiary, fontSize: 11 }}
              label={{
                value: yLabel,
                angle: -90,
                position: "insideLeft",
                style: CHART_AXIS_LABEL_STYLE,
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: CHART_COLORS.tooltipBg,
                border: `1px solid ${CHART_COLORS.tooltipBorder}`,
                borderRadius: "6px",
                fontSize: "12px",
              }}
            />
            {yKeys.length > 1 && (
              <Legend wrapperStyle={{ color: CHART_COLORS.textTertiary }} />
            )}
            {yKeys.map((key, i) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                name={seriesLabels?.[i] ?? key}
                stroke={chartColors[i % chartColors.length]}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        ) : chartType === "scatter" ? (
          <ScatterChart>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={CHART_COLORS.borderPrimary}
            />
            <XAxis
              dataKey={xKey}
              tick={{ fill: CHART_COLORS.textTertiary, fontSize: 11 }}
              label={{
                value: xLabel,
                position: "insideBottom",
                offset: -5,
                style: CHART_AXIS_LABEL_STYLE,
              }}
            />
            <YAxis
              tick={{ fill: CHART_COLORS.textTertiary, fontSize: 11 }}
              label={{
                value: yLabel,
                angle: -90,
                position: "insideLeft",
                style: CHART_AXIS_LABEL_STYLE,
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: CHART_COLORS.tooltipBg,
                border: `1px solid ${CHART_COLORS.tooltipBorder}`,
                borderRadius: "6px",
                fontSize: "12px",
              }}
            />
            <Scatter data={data} fill={chartColors[0]} />
          </ScatterChart>
        ) : chartType === "pie" ? (
          <PieChart>
            <Pie
              data={data}
              dataKey={yKeys[0]}
              nameKey={xKey}
              cx="50%"
              cy="50%"
              outerRadius={100}
              label={({ name, percent }) =>
                `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
              }
              labelLine={false}
            >
              {data.map((_, i) => (
                <Cell
                  key={String(data[i]?.[xKey] ?? data[i]?.[yKeys[0]] ?? i)}
                  fill={chartColors[i % chartColors.length]}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: CHART_COLORS.tooltipBg,
                border: `1px solid ${CHART_COLORS.tooltipBorder}`,
                borderRadius: "6px",
                fontSize: "12px",
              }}
            />
          </PieChart>
        ) : (
          /* bar and stacked_bar */
          <BarChart data={data}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={CHART_COLORS.borderPrimary}
            />
            <XAxis
              dataKey={xKey}
              tick={{ fill: CHART_COLORS.textTertiary, fontSize: 11 }}
              label={{
                value: xLabel,
                position: "insideBottom",
                offset: -5,
                style: CHART_AXIS_LABEL_STYLE,
              }}
            />
            <YAxis
              tick={{ fill: CHART_COLORS.textTertiary, fontSize: 11 }}
              label={{
                value: yLabel,
                angle: -90,
                position: "insideLeft",
                style: CHART_AXIS_LABEL_STYLE,
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: CHART_COLORS.tooltipBg,
                border: `1px solid ${CHART_COLORS.tooltipBorder}`,
                borderRadius: "6px",
                fontSize: "12px",
              }}
            />
            {yKeys.length > 1 && (
              <Legend wrapperStyle={{ color: CHART_COLORS.textTertiary }} />
            )}
            {yKeys.map((key, i) => (
              <Bar
                key={key}
                dataKey={key}
                name={seriesLabels?.[i] ?? key}
                fill={chartColors[i % chartColors.length]}
                stackId={chartType === "stacked_bar" ? "stack" : undefined}
                radius={chartType === "stacked_bar" ? undefined : [4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        )}
      </ResponsiveContainer>
    </Card>
  );
}
