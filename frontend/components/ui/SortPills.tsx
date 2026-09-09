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
      <span className="text-[10px] tracking-widest text-ink-faint font-bold uppercase font-mono">
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
                ? "bg-accent text-white"
                : "bg-surface-page text-ink-faint hover:text-ink-strong hover:bg-surface-raised border border-line-soft"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
