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
        <fieldset className="flex rounded-sm border border-border-secondary bg-bg-secondary p-0.5">
          <legend className="sr-only">Points display</legend>
          {(["championship", "scored"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              onClick={() => onChange(value)}
              className={`rounded-sm px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wide transition-colors ${
                mode === value
                  ? "bg-purple-500/20 text-purple-300"
                  : "text-text-muted hover:text-text-secondary"
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
          className="flex h-4 w-4 items-center justify-center rounded-full border border-border-secondary bg-bg-primary font-mono text-[9px] font-bold text-text-muted hover:border-purple-500 hover:text-purple-300"
        >
          ?
        </button>
        <div className="absolute right-0 top-full z-50 mt-2 hidden w-64 rounded-sm border border-border-secondary bg-bg-primary p-3 shadow-lg group-hover:block group-focus-within:block">
          {info.short_label && (
            <p className="mb-1 font-mono text-[10px] font-bold text-text-primary">
              {info.short_label}
            </p>
          )}
          <p className="text-[10px] leading-relaxed text-text-secondary">
            {info.explanation}
          </p>
          {info.source_url && (
            <a
              href={info.source_url}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block font-mono text-[9px] uppercase text-purple-300 hover:text-purple-200"
            >
              Source
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
