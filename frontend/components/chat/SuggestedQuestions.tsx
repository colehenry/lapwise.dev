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
    <div className="flex flex-col items-center px-6 py-10">
      <div className="w-full max-w-3xl text-center">
        {/* Hero icon */}
        <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-purple-500/20 bg-purple-500/10 text-purple-300 shadow-[0_0_40px_-10px_rgba(160,32,240,0.25)]">
          <ClutchIcon className="h-6 w-6" />
        </div>
        <h2 className="mb-1.5 flex items-center justify-center gap-2 text-xl font-bold tracking-tight text-text-primary">
          Ask <span className="text-purple-300">Clutch</span>
        </h2>

        {/* Hero text */}
        <p className="mx-auto mb-6 max-w-lg text-sm text-text-muted leading-relaxed">
          Dive deeper into race results, driver comparisons, and strategy. Make
          your own custom graphs and analyses.
        </p>

        {/* Suggestion cards grid */}
        <div className="grid gap-2.5 text-left md:grid-cols-2 xl:grid-cols-3">
          {SUGGESTIONS.map((s) => (
            <button
              key={s.category}
              type="button"
              onClick={() => !disabled && onSelect(s.question)}
              disabled={disabled}
              className={`group rounded-2xl border border-white/[0.05] bg-white/[0.02] px-4 py-3 transition-all duration-200 ${disabled ? "cursor-not-allowed opacity-50" : `hover:bg-purple-500/[0.04] ${s.borderHover} hover:-translate-y-0.5 hover:shadow-[0_8px_32px_-8px_rgba(160,32,240,0.12)]`}`}
            >
              <div className={`text-sm font-semibold ${s.color} leading-snug`}>
                {s.category}
              </div>
              <div className="mt-1 text-xs leading-relaxed text-text-muted">
                {s.question}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
