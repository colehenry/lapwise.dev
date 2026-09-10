interface TooltipEntry {
  color?: string;
  dataKey?: string | number;
  name?: string | number;
  value?: string | number;
}

export function formatAIChartValue(
  value: string | number | undefined,
  yLabel: string,
): string {
  if (typeof value !== "number") return String(value ?? "—");
  const normalizedLabel = yLabel.toLowerCase();
  if (normalizedLabel.includes("point")) return `${value.toLocaleString()} pts`;
  if (normalizedLabel.includes("second")) {
    return `${value > 0 ? "+" : ""}${value.toFixed(3)}s`;
  }
  if (normalizedLabel.includes("win")) {
    return `${value.toLocaleString()} ${value === 1 ? "win" : "wins"}`;
  }
  return value.toLocaleString();
}

export default function AIChartTooltip({
  active,
  payload,
  label,
  xLabel,
  yLabel,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
  xLabel: string;
  yLabel: string;
}) {
  if (!active || !payload?.length) return null;
  const heading =
    label === undefined
      ? null
      : xLabel.toLowerCase() === "round"
        ? `Round ${label}`
        : String(label);

  return (
    <div className="min-w-36 rounded-sm border border-line-soft bg-surface-panel p-3 shadow-floating-soft">
      {heading && (
        <p className="mb-2 font-semibold text-ink-strong text-xs">{heading}</p>
      )}
      <div className="grid gap-1.5">
        {payload.map((entry, index) => (
          <div
            key={String(entry.dataKey ?? entry.name ?? index)}
            className="flex items-center gap-2 text-xs"
          >
            <span
              className="h-2 w-2 rounded-[2px]"
              style={{ backgroundColor: entry.color }}
              aria-hidden="true"
            />
            <span className="text-ink-base">{entry.name}</span>
            <span className="ml-auto font-semibold tabular-nums text-ink-strong">
              {formatAIChartValue(entry.value, yLabel)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
