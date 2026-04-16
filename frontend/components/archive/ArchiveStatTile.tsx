import MonoLabel from "@/components/ui/MonoLabel";

type ArchiveStatTileProps = {
  label: string;
  value: string | number;
  accentColor?: string | null;
  align?: "left" | "center";
  className?: string;
};

function formatStatValue(value: string | number): string | number {
  if (typeof value !== "number") return value;
  return Number.isInteger(value) ? value.toLocaleString() : value;
}

export default function ArchiveStatTile({
  label,
  value,
  accentColor,
  align = "center",
  className = "",
}: ArchiveStatTileProps) {
  return (
    <div
      className={`bg-bg-primary/25 border border-border-primary rounded-sm p-3 min-w-0 ${
        align === "center" ? "text-center" : ""
      } ${className}`}
      style={
        accentColor
          ? { borderLeftColor: accentColor, borderLeftWidth: 3 }
          : undefined
      }
    >
      <MonoLabel className="block mb-1 break-words">{label}</MonoLabel>
      <div className="text-xl md:text-2xl font-bold font-mono tabular-nums text-text-primary truncate">
        {formatStatValue(value)}
      </div>
    </div>
  );
}
