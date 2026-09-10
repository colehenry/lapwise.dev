"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  headlineSegments,
  selectHeadlines,
  tickerSeed,
} from "@/lib/homeTicker";
import type { Headline } from "@/lib/queries/headlines";
import type { EntityColors } from "@/lib/queries/standings";
import { ValueSkeleton } from "./ConsolePanel";

/** Seconds each headline spends crossing the lane, at the blueprint's pace. */
const SECONDS_PER_ITEM = 8;

function tintFor(code: string, colors: EntityColors): string | undefined {
  return colors.driverColors.get(code) ?? colors.teamColors.get(code);
}

function HeadlineBody({
  headline,
  colors,
}: {
  headline: Headline;
  colors: EntityColors;
}) {
  const segments = headlineSegments(headline);
  return (
    <>
      <span className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-accent-bright">
        {headline.kicker}
      </span>
      <span className="text-[12.5px] text-ink-base tabular-nums">
        {segments.map((segment, index) => (
          <span
            key={`${headline.id}-${index}-${segment.text}`}
            style={
              segment.code
                ? { color: tintFor(segment.code, colors), fontWeight: 600 }
                : undefined
            }
          >
            {segment.text}
          </span>
        ))}
      </span>
    </>
  );
}

const ITEM_CLASS =
  "flex h-full items-center gap-[9px] whitespace-nowrap border-r border-line-soft px-5";

export default function HomeTicker({
  headlines,
  colors,
  loading,
}: {
  headlines: Headline[] | undefined;
  colors: EntityColors;
  loading: boolean;
}) {
  const lane = useMemo(
    () => selectHeadlines(headlines ?? [], tickerSeed()),
    [headlines],
  );

  if (lane.length === 0) {
    return (
      <div className="h-[34px] overflow-hidden border-b border-line-soft bg-surface-band">
        {loading && (
          <div className="page-frame flex h-full items-center gap-5">
            <ValueSkeleton width={54} height={9} />
            <ValueSkeleton width={180} height={11} />
            <ValueSkeleton width={140} height={11} />
          </div>
        )}
      </div>
    );
  }

  return (
    <section
      aria-label="Formula 1 headlines"
      className="ticker-rail relative h-[34px] overflow-hidden border-b border-line-soft bg-surface-band"
    >
      <div
        className="ticker-lane flex h-full w-max items-center"
        style={
          {
            "--ticker-duration": `${lane.length * SECONDS_PER_ITEM}s`,
          } as React.CSSProperties
        }
      >
        {lane.map((headline) =>
          headline.href ? (
            <Link key={headline.id} href={headline.href} className={ITEM_CLASS}>
              <HeadlineBody headline={headline} colors={colors} />
            </Link>
          ) : (
            <span key={headline.id} className={ITEM_CLASS}>
              <HeadlineBody headline={headline} colors={colors} />
            </span>
          ),
        )}
        {/* The second pass is what makes the loop seamless; it is decoration,
            so it is neither announced nor reachable by keyboard. */}
        <div aria-hidden="true" className="flex h-full items-center">
          {lane.map((headline) => (
            <span key={`echo-${headline.id}`} className={ITEM_CLASS}>
              <HeadlineBody headline={headline} colors={colors} />
            </span>
          ))}
        </div>
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 w-[70px]"
        style={{
          background:
            "linear-gradient(90deg, transparent, var(--surface-band))",
        }}
      />
    </section>
  );
}
