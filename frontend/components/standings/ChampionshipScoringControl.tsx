"use client";

import type { ChampionshipScoringInfo } from "@/lib/types";

export type ChampionshipPointsMode = "championship" | "scored";

type Props = {
  info: ChampionshipScoringInfo | undefined;
  mode: ChampionshipPointsMode;
  onChange: (mode: ChampionshipPointsMode) => void;
};

export default function ChampionshipScoringControl({
  info,
  mode,
  onChange,
}: Props) {
  if (!info || (!info.has_discrepancy && !info.explanation)) return null;
  const showComparison =
    info.has_discrepancy && info.comparison_mode === "comparison";

  return (
    <div className="relative z-20 ml-auto flex items-center gap-1">
      {showComparison && (
        <fieldset className="flex rounded-sm border border-line-strong bg-surface-band p-0.5">
          <legend className="sr-only">Points display</legend>
          {(["championship", "scored"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              onClick={() => onChange(value)}
              className={`rounded-sm px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wide transition-colors ${
                mode === value
                  ? "bg-accent/20 text-accent-light"
                  : "text-ink-faint hover:text-ink-base"
              }`}
            >
              {value === "championship" ? "Champ" : "Scored"}
            </button>
          ))}
        </fieldset>
      )}
      <div className="group relative">
        <button
          type="button"
          aria-label="Explain championship scoring"
          className="flex h-4 w-4 items-center justify-center rounded-full border border-line-strong bg-surface-page font-mono text-[9px] font-bold text-ink-faint hover:border-accent hover:text-accent-light"
        >
          ?
        </button>
        <div className="absolute right-0 top-full z-50 mt-2 hidden w-64 rounded-sm border border-line-strong bg-surface-page p-3 shadow-lg group-hover:block group-focus-within:block">
          {info.short_label && (
            <p className="mb-1 font-mono text-[10px] font-bold text-ink-strong">
              {info.short_label}
            </p>
          )}
          <p className="text-[10px] leading-relaxed text-ink-base">
            {info.explanation}
          </p>
          {info.source_url && (
            <a
              href={info.source_url}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block font-mono text-[9px] uppercase text-accent-light hover:text-accent-light"
            >
              Source
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
