"use client";

interface SortOption<T extends string> {
  key: T;
  label: string;
}

interface SortPillsProps<T extends string> {
  active: T;
  onChange: (key: T) => void;
  options: SortOption<T>[];
}

export default function SortPills<T extends string>({
  active,
  onChange,
  options,
}: SortPillsProps<T>) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono">
        Sort by
      </span>
      <div className="flex items-center gap-1">
        {options.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            className={`px-3 py-1 rounded-sm text-xs font-mono tracking-wider uppercase transition-colors ${
              active === opt.key
                ? "bg-purple-500 text-white"
                : "bg-bg-primary text-text-muted hover:text-text-primary hover:bg-bg-elevated border border-border-primary"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
