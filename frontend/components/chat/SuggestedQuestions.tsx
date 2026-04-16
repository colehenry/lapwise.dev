"use client";

import ClutchIcon from "@/components/ui/ClutchIcon";
import { SUGGESTIONS } from "@/lib/ai/suggestions";

interface SuggestedQuestionsProps {
  onSelect: (question: string) => void;
  compact?: boolean;
  disabled?: boolean;
}

export default function SuggestedQuestions({
  onSelect,
  compact,
  disabled,
}: SuggestedQuestionsProps) {
  if (compact) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-3 py-6">
        <div className="w-full text-center">
          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-purple-500/30 bg-purple-500/15 text-purple-300">
            <ClutchIcon className="h-5 w-5" />
          </div>
          <h3 className="mb-1 text-sm font-bold text-text-primary">
            Ask <span className="text-purple-300">Clutch</span>
          </h3>
          <p className="mb-4 text-xs text-text-muted">
            Ask Clutch anything about F1
          </p>
          <div className="space-y-1.5 text-left">
            {SUGGESTIONS.slice(0, 4).map((s) => (
              <button
                key={s.category}
                type="button"
                onClick={() => !disabled && onSelect(s.question)}
                disabled={disabled}
                className={`w-full rounded-xl border border-white/[0.05] bg-white/[0.03] px-3 py-2.5 text-left transition-all ${disabled ? "cursor-not-allowed opacity-50" : "hover:border-purple-500/30 hover:bg-purple-500/[0.06] hover:-translate-y-0.5"}`}
              >
                <div
                  className={`text-[9px] font-mono uppercase tracking-[0.1em] ${s.color} mb-0.5`}
                >
                  {s.category}
                </div>
                <div className="text-xs text-text-secondary truncate">
                  {s.question}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center px-3 py-4 md:px-6 md:py-10">
      <div className="w-full max-w-3xl text-center">
        {/* Hero icon */}
        <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-purple-500/20 bg-purple-500/10 text-purple-300 shadow-[0_0_40px_-10px_rgba(160,32,240,0.25)] md:mb-3 md:h-12 md:w-12 md:rounded-2xl">
          <ClutchIcon className="h-5 w-5 md:h-6 md:w-6" />
        </div>
        <h2 className="mb-1 flex items-center justify-center gap-2 text-base font-bold tracking-tight text-text-primary md:mb-1.5 md:text-xl">
          Ask <span className="text-purple-300">Clutch</span>
        </h2>

        {/* Hero text */}
        <p className="mx-auto mb-3 max-w-lg text-xs text-text-muted leading-relaxed md:mb-6 md:text-sm">
          Dive deeper into race results, driver comparisons, and strategy. Make
          your own custom graphs and analyses.
        </p>

        {/* Suggestion cards grid */}
        <div className="grid grid-cols-1 gap-2 text-left sm:grid-cols-2 md:gap-2.5 xl:grid-cols-3">
          {SUGGESTIONS.map((s, index) => (
            <button
              key={s.category}
              type="button"
              onClick={() => !disabled && onSelect(s.question)}
              disabled={disabled}
              className={`group rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2.5 transition-all duration-200 md:rounded-2xl md:px-4 md:py-3 ${index >= 3 ? "hidden md:block" : ""} ${disabled ? "cursor-not-allowed opacity-50" : `hover:bg-purple-500/[0.04] ${s.borderHover} hover:-translate-y-0.5 hover:shadow-[0_8px_32px_-8px_rgba(160,32,240,0.12)]`}`}
            >
              <div
                className={`text-xs font-semibold ${s.color} leading-snug md:text-sm`}
              >
                {s.category}
              </div>
              <div className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-text-muted md:mt-1 md:text-xs md:leading-relaxed">
                {s.question}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
