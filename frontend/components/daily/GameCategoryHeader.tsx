"use client";

import Image from "next/image";
import { useTheme } from "@/components/providers/ThemeProvider";
import {
  getConstructorLogoUrl,
  shouldInvertConstructorLogoOnLight,
} from "@/lib/entityImageOverrides";
import { getDriverFlagEmoji } from "@/lib/flags";
import type { GameCategory } from "@/lib/queries/dailyGrid";

export default function GameCategoryHeader({
  category,
  className,
  orientation = "column",
  size = "default",
}: {
  category: GameCategory;
  /** Corner radius for the grid's outer edge, applied per corner cell so the
   *  block reads as rounded without clipping the hover labels. */
  className?: string;
  orientation?: "column" | "row";
  /** `compact` is the review board in the editorial queue, which shows the
   *  board a player will see at a size that fits beside the queue. */
  size?: "default" | "compact";
}) {
  const compact = size === "compact";
  const { theme } = useTheme();
  const team = { team_name: category.visual.value };
  const constructorLogo =
    category.visual.kind === "constructor" ? getConstructorLogoUrl(team) : null;
  const invertLogo =
    theme === "light" && shouldInvertConstructorLogoOnLight(team);
  const flag =
    category.visual.kind === "nationality"
      ? getDriverFlagEmoji(category.visual.value)
      : null;

  return (
    <div
      className={`group relative flex min-w-0 items-center justify-center border border-border-primary bg-bg-secondary text-center ${
        compact ? "min-h-14" : "min-h-16 sm:min-h-20"
      } ${className ?? ""}`}
    >
      <div
        className={`flex h-full w-full min-w-0 items-center justify-center overflow-hidden ${
          orientation === "row" ? "px-1 py-2 sm:px-1.5" : "p-2 sm:p-3"
        }`}
      >
        {constructorLogo ? (
          <div
            className={`relative w-full min-w-0 ${compact ? "h-8" : "h-10 sm:h-12"}`}
          >
            <Image
              src={constructorLogo}
              alt={category.label}
              fill
              sizes="(max-width: 640px) 72px, 110px"
              className={`object-contain ${invertLogo ? "invert" : ""}`}
            />
          </div>
        ) : flag ? (
          <span
            className={`leading-none ${compact ? "text-2xl" : "text-3xl sm:text-4xl"}`}
            role="img"
            aria-label={category.label}
          >
            {flag}
          </span>
        ) : (
          <span
            lang="en"
            className={`block w-full min-w-0 hyphens-auto text-balance font-bold uppercase leading-snug tracking-[0.08em] text-text-secondary [overflow-wrap:anywhere] ${
              compact ? "text-[8px]" : "text-[9px] sm:text-[11px]"
            }`}
          >
            {category.label}
          </span>
        )}
      </div>
      <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-max max-w-48 -translate-x-1/2 translate-y-1 rounded-md border border-border-primary bg-bg-elevated px-2.5 py-1.5 text-[10px] font-semibold text-text-primary opacity-0 shadow-lg transition-all group-hover:translate-y-0 group-hover:opacity-100">
        {category.prompt_label}
      </span>
    </div>
  );
}
