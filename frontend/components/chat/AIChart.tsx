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
import Card from "@/components/ui/Card";
import type { ChartConfig } from "@/lib/chat";

const DEFAULT_COLORS = [
  "#a020f0",
  "#e10600",
  "#0090ff",
  "#00d084",
  "#ff6b00",
  "#ffd700",
  "#ff69b4",
  "#00ced1",
];

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
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a35" />
            <XAxis
              dataKey={xKey}
              tick={{ fill: "#999", fontSize: 11 }}
              label={{
                value: xLabel,
                position: "insideBottom",
                offset: -5,
                fill: "#999",
                fontSize: 11,
              }}
            />
            <YAxis
              tick={{ fill: "#999", fontSize: 11 }}
              label={{
                value: yLabel,
                angle: -90,
                position: "insideLeft",
                fill: "#999",
                fontSize: 11,
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1e1e28",
                border: "1px solid #2a2a35",
                borderRadius: "6px",
                fontSize: "12px",
              }}
            />
            {yKeys.length > 1 && <Legend />}
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
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a35" />
            <XAxis
              dataKey={xKey}
              tick={{ fill: "#999", fontSize: 11 }}
              label={{
                value: xLabel,
                position: "insideBottom",
                offset: -5,
                fill: "#999",
                fontSize: 11,
              }}
            />
            <YAxis
              tick={{ fill: "#999", fontSize: 11 }}
              label={{
                value: yLabel,
                angle: -90,
                position: "insideLeft",
                fill: "#999",
                fontSize: 11,
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1e1e28",
                border: "1px solid #2a2a35",
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
                backgroundColor: "#1e1e28",
                border: "1px solid #2a2a35",
                borderRadius: "6px",
                fontSize: "12px",
              }}
            />
          </PieChart>
        ) : (
          /* bar and stacked_bar */
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a35" />
            <XAxis
              dataKey={xKey}
              tick={{ fill: "#999", fontSize: 11 }}
              label={{
                value: xLabel,
                position: "insideBottom",
                offset: -5,
                fill: "#999",
                fontSize: 11,
              }}
            />
            <YAxis
              tick={{ fill: "#999", fontSize: 11 }}
              label={{
                value: yLabel,
                angle: -90,
                position: "insideLeft",
                fill: "#999",
                fontSize: 11,
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1e1e28",
                border: "1px solid #2a2a35",
                borderRadius: "6px",
                fontSize: "12px",
              }}
            />
            {yKeys.length > 1 && <Legend />}
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
