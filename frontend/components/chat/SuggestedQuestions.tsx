"use client";

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
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M9 4.5a.75.75 0 01.721.544l.813 2.846a3.75 3.75 0 002.576 2.576l2.846.813a.75.75 0 010 1.442l-2.846.813a3.75 3.75 0 00-2.576 2.576l-.813 2.846a.75.75 0 01-1.442 0l-.813-2.846a3.75 3.75 0 00-2.576-2.576l-2.846-.813a.75.75 0 010-1.442l2.846-.813A3.75 3.75 0 007.466 7.89l.813-2.846A.75.75 0 019 4.5zM18 1.5a.75.75 0 01.728.568l.258 1.036c.236.94.97 1.674 1.91 1.91l1.036.258a.75.75 0 010 1.456l-1.036.258c-.94.236-1.674.97-1.91 1.91l-.258 1.036a.75.75 0 01-1.456 0l-.258-1.036a2.625 2.625 0 00-1.91-1.91l-1.036-.258a.75.75 0 010-1.456l1.036-.258a2.625 2.625 0 001.91-1.91l.258-1.036A.75.75 0 0118 1.5zM16.5 15a.75.75 0 01.712.513l.394 1.183c.15.447.5.799.948.948l1.183.395a.75.75 0 010 1.422l-1.183.395c-.447.15-.799.5-.948.948l-.395 1.183a.75.75 0 01-1.422 0l-.395-1.183a1.5 1.5 0 00-.948-.948l-1.183-.395a.75.75 0 010-1.422l1.183-.395c.447-.15.799-.5.948-.948l.395-1.183A.75.75 0 0116.5 15z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <h3 className="mb-1 text-sm font-bold text-text-primary">
            AI Analyst
          </h3>
          <p className="mb-4 text-xs text-text-muted">Ask anything about F1</p>
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
          <svg
            className="h-6 w-6"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M9 4.5a.75.75 0 01.721.544l.813 2.846a3.75 3.75 0 002.576 2.576l2.846.813a.75.75 0 010 1.442l-2.846.813a3.75 3.75 0 00-2.576 2.576l-.813 2.846a.75.75 0 01-1.442 0l-.813-2.846a3.75 3.75 0 00-2.576-2.576l-2.846-.813a.75.75 0 010-1.442l2.846-.813A3.75 3.75 0 007.466 7.89l.813-2.846A.75.75 0 019 4.5zM18 1.5a.75.75 0 01.728.568l.258 1.036c.236.94.97 1.674 1.91 1.91l1.036.258a.75.75 0 010 1.456l-1.036.258c-.94.236-1.674.97-1.91 1.91l-.258 1.036a.75.75 0 01-1.456 0l-.258-1.036a2.625 2.625 0 00-1.91-1.91l-1.036-.258a.75.75 0 010-1.456l1.036-.258a2.625 2.625 0 001.91-1.91l.258-1.036A.75.75 0 0118 1.5zM16.5 15a.75.75 0 01.712.513l.394 1.183c.15.447.5.799.948.948l1.183.395a.75.75 0 010 1.422l-1.183.395c-.447.15-.799.5-.948.948l-.395 1.183a.75.75 0 01-1.422 0l-.395-1.183a1.5 1.5 0 00-.948-.948l-1.183-.395a.75.75 0 010-1.422l1.183-.395c.447-.15.799-.5.948-.948l.395-1.183A.75.75 0 0116.5 15z"
              clipRule="evenodd"
            />
          </svg>
        </div>

        {/* Hero text */}
        <h2 className="mb-1.5 text-xl font-bold tracking-tight text-text-primary">
          Got a question?
        </h2>
        <p className="mx-auto mb-6 max-w-lg text-sm text-text-muted leading-relaxed">
          Dive deeper into race results, driver comparisons, weather, strategy,
          and championship trends — all backed by real data.
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
