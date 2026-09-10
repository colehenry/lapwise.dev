"use client";

import ClutchIcon from "@/components/ui/ClutchIcon";
import { SUGGESTIONS } from "@/lib/ai/suggestions";

interface SuggestedQuestionsProps {
  onSelect: (question: string) => void;
  disabled?: boolean;
}

/**
 * The transcript before it has anything in it. The last three questions are
 * held back on mobile so the composer stays in reach.
 */
export default function SuggestedQuestions({
  onSelect,
  disabled,
}: SuggestedQuestionsProps) {
  return (
    <div className="page-frame flex min-h-full flex-col justify-center py-6 md:py-8">
      <div className="mx-auto w-full max-w-3xl">
        <h2 className="m-0 whitespace-nowrap text-center text-[clamp(1rem,4.9vw,1.625rem)] font-bold leading-[1.12] tracking-[-0.03em] text-ink-strong">
          Ask <span className="text-accent-bright">Clutch</span>
          <ClutchIcon className="mx-[0.22em] inline-block h-[0.82em] w-[0.82em] align-[-0.08em] text-accent-bright" />
          anything about Formula 1.
        </h2>

        <div className="mt-6 grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {SUGGESTIONS.map((s, index) => (
            <button
              key={s.category}
              type="button"
              onClick={() => !disabled && onSelect(s.question)}
              disabled={disabled}
              className={`rounded-sm border border-line-soft bg-surface-panel px-3 py-2.5 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-bright ${
                index >= 3 ? "hidden sm:block" : ""
              } ${
                disabled
                  ? "cursor-not-allowed opacity-50"
                  : "hover:border-accent hover:bg-surface-raised"
              }`}
            >
              <span className="block font-mono text-[9.5px] font-bold uppercase tracking-[0.12em] text-ink-faint">
                {s.category}
              </span>
              <span className="mt-1.5 block text-[12.5px] leading-[1.45] text-ink-base">
                {s.question}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
