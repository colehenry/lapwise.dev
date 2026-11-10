"use client";

import { CHART_COLORS, CHART_TYPOGRAPHY } from "./chart-primitives";

// Custom X-axis Tick Component
interface XAxisTickProps {
  x?: number;
  y?: number;
  payload?: { value: string | number };
}

export const CustomXAxisTick = (props: XAxisTickProps) => {
  const { x, y, payload } = props;
  const label = String(payload?.value ?? "").replace("-sprint", "-s");

  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={12}
        textAnchor="middle"
        fill={CHART_COLORS.textTertiary}
        fontSize={12}
      >
        {label}
      </text>
    </g>
  );
};

// Custom Tooltip Component
interface TooltipPayloadEntry {
  dataKey: string;
  value: number;
  color: string;
  name: string;
  payload: Record<string, unknown>;
}

interface TooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string | number;
  pointsType?: string;
  mode?: string;
}

export const CustomTooltip = ({
  active,
  payload,
  label,
  pointsType,
}: TooltipProps) => {
  if (!active || !payload || !payload.length) return null;

  // Skip tooltip for round 0
  if (label === "0") return null;

  // Get event name from first payload entry
  const rawEventName = payload[0]?.payload?.event_name;
  const eventName = (
    typeof rawEventName === "string" ? rawEventName : `Round ${label}`
  ).replace("Grand Prix", "GP");

  const labelStr2 = typeof label === "string" ? label : String(label ?? "");
  const isSprint = labelStr2.endsWith("-sprint");
  const isSprintQualy = labelStr2.endsWith("-sq");

  let sessionLabel = "";
  if (isSprint) sessionLabel = ": Sprint";
  if (isSprintQualy) sessionLabel = ": SQ";

  const displayName = `${eventName}${sessionLabel}`;

  // Filter out null entries
  const filteredPayload = payload.filter(
    (entry: TooltipPayloadEntry) => entry.value != null,
  );
  if (filteredPayload.length === 0) return null;

  return (
    <div className="bg-surface-panel border border-line-soft rounded-lg p-3 shadow-xl">
      <p className={`${CHART_TYPOGRAPHY.tooltipTitleClassName} mb-2`}>
        {displayName}
      </p>
      {filteredPayload.map((entry: TooltipPayloadEntry) => {
        const value = entry.value;
        const isQualy = pointsType === "qualifying";
        const labelStr = isQualy
          ? value === 21
            ? "DNF"
            : `P${value}`
          : `${value.toFixed(0)} pts`;

        return (
          <div key={entry.dataKey} className="flex items-center gap-2 mb-1">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span
              className={`${CHART_TYPOGRAPHY.tooltipValueClassName} text-sm`}
            >
              {entry.name}: {labelStr}
            </span>
          </div>
        );
      })}
    </div>
  );
};
