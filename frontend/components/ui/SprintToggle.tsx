"use client";

interface SprintToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  isLoading?: boolean;
  className?: string;
}

export default function SprintToggle({
  checked,
  onChange,
  isLoading = false,
  className = "",
}: SprintToggleProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[10px] font-mono tracking-wider uppercase transition-colors border ${
        checked
          ? "bg-purple-500/20 text-purple-300 border-purple-500/50 hover:bg-purple-500/30"
          : "bg-bg-primary text-text-muted border-border-primary hover:text-text-primary hover:bg-bg-elevated"
      } ${isLoading ? "animate-pulse" : ""} ${className}`}
    >
      <span
        className={`w-3 h-3 rounded-sm border flex items-center justify-center flex-shrink-0 transition-colors ${
          checked
            ? "bg-purple-500 border-purple-500"
            : "border-border-primary bg-transparent"
        }`}
      >
        {isLoading ? (
          <span className="w-2 h-2 rounded-full border border-current border-t-transparent animate-spin block" />
        ) : checked ? (
          <svg
            viewBox="0 0 10 8"
            fill="none"
            className="w-2 h-2"
            aria-hidden="true"
          >
            <title>Checked</title>
            <path
              d="M1 4l2.5 2.5L9 1"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : null}
      </span>
      <span>Include Sprints</span>
    </button>
  );
}
