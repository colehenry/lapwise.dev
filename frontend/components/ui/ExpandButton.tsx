"use client";

interface ExpandButtonProps {
  isExpanded: boolean;
  onToggle: () => void;
  remainingCount: number;
}

export default function ExpandButton({
  isExpanded,
  onToggle,
  remainingCount,
}: ExpandButtonProps) {
  return (
    <div className="mt-6 flex justify-center">
      <button
        type="button"
        onClick={onToggle}
        className="border border-border-secondary rounded-sm text-text-secondary hover:border-purple-500 hover:text-purple-300 font-mono text-xs uppercase tracking-widest px-6 py-2 transition-colors duration-150 flex items-center gap-2"
      >
        {isExpanded ? "COLLAPSE" : `SHOW ALL (${remainingCount} more)`}
        <svg
          className={`w-3 h-3 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
    </div>
  );
}
