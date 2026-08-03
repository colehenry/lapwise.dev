"use client";

import { useState } from "react";

export function QualifyingPointsInfo({ formulaBase }: { formulaBase: number }) {
  const maxPoints = formulaBase - 1;
  return (
    <div className="absolute top-3 right-3 z-30 group">
      <button
        type="button"
        aria-label="How qualifying points are calculated"
        className="w-4 h-4 rounded-full border border-border-secondary bg-bg-primary text-text-muted hover:text-purple-300 hover:border-purple-500 flex items-center justify-center text-[9px] font-bold font-mono transition-colors duration-150"
      >
        ?
      </button>
      <div className="hidden group-hover:block group-focus-within:block absolute right-0 top-full mt-2 w-56 bg-bg-primary border border-border-secondary rounded-sm p-3 shadow-lg z-30">
        <p className="text-[10px] text-text-secondary leading-relaxed normal-case tracking-normal font-sans">
          Unofficial <span className="font-mono text-purple-300">Lapwise</span>{" "}
          metric for one-lap pace. Each qualifying awards{" "}
          <span className="font-mono text-purple-300">
            {formulaBase}−position
          </span>{" "}
          points (P1 = {maxPoints}, P{maxPoints} = 1). Scales to grid size so
          every driver scores. Does not affect the championship.
        </p>
      </div>
    </div>
  );
}

export function MedalsWithBreakdown({
  p1,
  p2,
  p3,
  total,
  name,
  positionCounts,
  mode,
}: {
  p1: number;
  p2: number;
  p3: number;
  total: number;
  name: string;
  positionCounts: Record<string, number>;
  mode: "race" | "qualifying";
}) {
  const medals = [
    { count: p1, icon: "🥇", label: "P1s" },
    { count: p2, icon: "🥈", label: "P2s" },
    { count: p3, icon: "🥉", label: "P3s" },
  ].filter((medal) => medal.count > 0);
  const [tooltipPos, setTooltipPos] = useState<{
    top: number;
    right: number;
  } | null>(null);
  const positions = Object.entries(positionCounts)
    .map(([position, count]) => ({ position: Number(position), count }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => a.position - b.position);
  const showTooltip = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    setTooltipPos({
      top: rect.bottom + 8,
      right: window.innerWidth - rect.right,
    });
  };

  return (
    <div className="flex items-center gap-3">
      {medals.map((medal) => (
        <div key={medal.label} className="flex flex-col items-center">
          <span className="text-xs" title={medal.label}>
            {medal.icon}
          </span>
          <span className="text-xs font-bold text-text-primary">
            {medal.count}
          </span>
        </div>
      ))}
      <div className="relative">
        <button
          type="button"
          aria-label={`${name} ${mode === "race" ? "race finishes" : "qualifying positions"} breakdown`}
          onMouseEnter={(event) => showTooltip(event.currentTarget)}
          onMouseLeave={() => setTooltipPos(null)}
          onFocus={(event) => showTooltip(event.currentTarget)}
          onBlur={() => setTooltipPos(null)}
          className="flex items-baseline gap-1 cursor-help"
        >
          <span className="text-[9px] text-text-muted tracking-widest font-mono">
            PTS
          </span>
          <span className="text-lg font-bold text-text-primary font-mono">
            {total}
          </span>
        </button>
        {tooltipPos && (
          <div
            className="fixed w-36 bg-bg-primary border border-border-secondary rounded-sm p-2 shadow-lg z-50 pointer-events-none"
            style={{ top: tooltipPos.top, right: tooltipPos.right }}
          >
            <p className="text-[10px] font-bold text-text-primary mb-1.5 truncate">
              {name}
            </p>
            {positions.length === 0 ? (
              <p className="text-[10px] text-text-muted">No results</p>
            ) : (
              <div className="flex flex-col gap-0.5">
                {positions.map(({ position, count }) => (
                  <div
                    key={position}
                    className="flex items-center justify-between text-[10px] text-text-secondary font-mono"
                  >
                    <span>P{position}</span>
                    <span className="text-text-primary font-bold">
                      {count}x
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
