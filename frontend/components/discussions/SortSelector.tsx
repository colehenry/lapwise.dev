interface SortSelectorProps {
  value: "new" | "top" | "hot";
  onChange: (value: "new" | "top" | "hot") => void;
}

const options: Array<{ value: "new" | "top" | "hot"; label: string }> = [
  { value: "new", label: "New" },
  { value: "top", label: "Top" },
  { value: "hot", label: "Hot" },
];

export default function SortSelector({ value, onChange }: SortSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono">
        Sort
      </span>
      <div className="flex items-center gap-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`px-3 py-1 rounded-sm text-xs font-mono tracking-wider uppercase transition-colors duration-150 border ${
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
