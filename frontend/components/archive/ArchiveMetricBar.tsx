import MonoLabel from "@/components/ui/MonoLabel";

type ArchiveMetricBarProps = {
  label: string;
  value: string | number;
  progress?: number;
  accentColor?: string | null;
};

export default function ArchiveMetricBar({
  label,
  value,
  progress,
  accentColor,
}: ArchiveMetricBarProps) {
  const clampedProgress =
    typeof progress === "number" ? Math.max(0, Math.min(progress, 100)) : null;

  return (
    <div className="space-y-2 border-b border-border-primary py-4 last:border-b-0">
      <div className="flex items-baseline justify-between gap-4">
        <MonoLabel>{label}</MonoLabel>
        <span className="font-mono text-lg font-bold tabular-nums text-text-primary">
          {value}
        </span>
      </div>
      {clampedProgress != null && (
        <div className="h-1.5 overflow-hidden rounded-sm bg-bg-primary">
          <div
            className="h-full rounded-sm bg-red-500"
            style={{
              width: `${clampedProgress}%`,
              backgroundColor: accentColor ?? undefined,
            }}
          />
        </div>
      )}
    </div>
  );
}
