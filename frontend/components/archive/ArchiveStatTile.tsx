import MonoLabel from "@/components/ui/MonoLabel";

type ArchiveStatTileProps = {
  label: string;
  value: string | number;
  accentColor?: string | null;
  align?: "left" | "center";
  className?: string;
};

export default function ArchiveStatTile({
  label,
  value,
  accentColor: _accentColor,
  align = "center",
  className = "",
}: ArchiveStatTileProps) {
  return (
    <div
      className={`bg-bg-primary/60 border border-border-primary rounded-sm p-3 min-w-0 ${
        align === "center" ? "text-center" : ""
      } ${className}`}
    >
      <MonoLabel className="block mb-1 break-words">{label}</MonoLabel>
      <div className="text-xl md:text-2xl font-bold font-mono tabular-nums text-text-primary truncate">
        {value}
      </div>
    </div>
  );
}
