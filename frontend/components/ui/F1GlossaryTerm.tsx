"use client";

import { useId } from "react";

export default function F1GlossaryTerm({
  children,
  definition,
}: {
  children: string;
  definition: string;
}) {
  const tooltipId = useId();
  return (
    <button
      type="button"
      aria-label={children}
      aria-describedby={tooltipId}
      className="group/f1-term relative inline cursor-help rounded-[2px] bg-transparent p-0 font-inherit text-inherit underline decoration-dotted decoration-ink-faint underline-offset-[3px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-bright"
    >
      {children}
      <span
        id={tooltipId}
        role="tooltip"
        className="pointer-events-none invisible absolute bottom-full left-1/2 z-[1400] mb-1.5 w-[min(16rem,calc(100vw-3rem))] -translate-x-1/2 rounded-sm border border-line-strong bg-surface-raised px-2.5 py-2 text-left text-[11px] font-normal leading-[1.4] text-ink-base opacity-0 shadow-floating-soft transition-opacity group-hover/f1-term:visible group-hover/f1-term:opacity-100 group-focus/f1-term:visible group-focus/f1-term:opacity-100"
      >
        {definition}
      </span>
    </button>
  );
}
