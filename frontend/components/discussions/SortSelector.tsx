import MonoLabel from "@/components/ui/MonoLabel";

interface SortSelectorProps {
  value: "new" | "top";
  onChange: (value: "new" | "top") => void;
}

const options: Array<{ value: "new" | "top"; label: string }> = [
  { value: "new", label: "New" },
  { value: "top", label: "Top" },
];

export default function SortSelector({ value, onChange }: SortSelectorProps) {
  return (
    <div className="flex items-center gap-1.5 md:gap-2">
      <MonoLabel className="hidden font-bold sm:inline">Sort</MonoLabel>
      <div className="flex items-center gap-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`px-2.5 py-2 md:px-3 md:py-1 rounded-sm text-[10px] md:text-xs font-mono tracking-wider uppercase transition-colors duration-150 border ${
              value === option.value
                ? "bg-purple-500/20 border-purple-500 text-purple-200"
                : "border-border-primary text-text-muted hover:text-text-primary hover:bg-bg-elevated"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
