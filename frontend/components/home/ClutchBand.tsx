"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ClutchContext, ResolvedScript } from "@/lib/homeClutchScript";
import { pickClutchScript } from "@/lib/homeClutchScript";
import { pointsProgressionQuery } from "@/lib/queries/pointsProgression";
import type { EntityColors } from "@/lib/queries/standings";
import ClutchProgressionChart from "./ClutchProgressionChart";

/** Reading pace, in characters per second. */
const TYPE_RATE = 52;
/** A beat before the answer starts, so the question is read first. */
const LEAD_IN = 0.7;

function tintFor(
  segment: ResolvedScript["segments"][number],
  colors: EntityColors,
): string | undefined {
  if (!segment.code) return undefined;
  return segment.tint === "team"
    ? colors.teamColors.get(segment.code)
    : colors.driverColors.get(segment.code);
}

function useTypedAnswer(
  script: ResolvedScript | null,
  enabled: boolean,
): {
  spanRefs: React.RefObject<(HTMLSpanElement | null)[]>;
  finished: boolean;
} {
  const spanRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (!script) return;
    const lengths = script.segments.map((segment) => segment.text.length);
    const total = lengths.reduce((sum, length) => sum + length, 0);

    const paint = (shown: number) => {
      let consumed = 0;
      lengths.forEach((length, index) => {
        const element = spanRefs.current[index];
        if (element) {
          const visible = Math.max(0, Math.min(length, shown - consumed));
          element.textContent = script.segments[index].text.slice(0, visible);
        }
        consumed += length;
      });
    };

    if (!enabled) {
      paint(total);
      setFinished(true);
      return;
    }

    setFinished(false);
    let raf = 0;
    const started = performance.now();
    const step = (now: number) => {
      const elapsed = (now - started) / 1000 - LEAD_IN;
      const shown = Math.max(
        0,
        Math.min(total, Math.floor(elapsed * TYPE_RATE)),
      );
      paint(shown);
      if (shown >= total) {
        setFinished(true);
        return;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [script, enabled]);

  return { spanRefs, finished };
}

export default function ClutchBand({
  context,
  colors,
  animate,
}: {
  context: ClutchContext;
  colors: EntityColors;
  animate: boolean;
}) {
  const router = useRouter();
  const script = useMemo(() => pickClutchScript(context), [context]);
  const { spanRefs, finished } = useTypedAnswer(script, animate);

  const progression = useQuery({
    ...pointsProgressionQuery(context.season),
    enabled: context.season !== null && script?.visual != null,
  });

  if (!script) return null;

  const ask = () => {
    router.push(`/ask?q=${encodeURIComponent(script.question)}`);
  };

  return (
    <section className="border-y border-line-soft bg-surface-band px-3 pb-10 pt-[38px]">
      <div className="mx-auto max-w-[1060px] px-2">
        <h2 className="m-0 text-[30px] font-bold leading-[1.08] tracking-[-0.035em] text-ink-strong">
          <span className="text-accent-bright">Ask Clutch</span> anything about
          Formula 1.
        </h2>

        <button
          type="button"
          onClick={ask}
          className="mt-5 flex w-full items-center gap-3 rounded-[5px] border border-line-strong bg-surface-panel py-3 pl-[15px] pr-3 text-left transition-colors hover:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-bright"
        >
          <span
            aria-hidden="true"
            className="caret-blink block h-[17px] w-0.5 flex-none bg-accent-bright"
          />
          <span className="flex-1 text-[15.5px] font-semibold tracking-[-0.015em] text-ink-strong">
            {script.question}
          </span>
          <span className="rounded-sm border border-accent-bright bg-accent px-4 py-2 text-[13px] font-semibold text-ink-strong">
            Ask
          </span>
        </button>

        <div className="mt-4 grid gap-6 lg:grid-cols-[58fr_42fr]">
          <div className="min-h-[76px] border-l-2 border-accent py-0.5 pl-4">
            <p className="m-0 max-w-[80ch] text-[15.5px] leading-[1.75] text-ink-base">
              {script.segments.map((segment, index) => (
                <span
                  key={`${script.id}-${index}`}
                  ref={(node) => {
                    spanRefs.current[index] = node;
                  }}
                  style={{
                    color: tintFor(segment, colors),
                    fontWeight: segment.tint ? 600 : undefined,
                  }}
                />
              ))}
              {!finished && (
                <span
                  aria-hidden="true"
                  className="caret-blink ml-1 inline-block h-[14px] w-[7px] -mb-0.5 bg-accent-bright align-baseline"
                />
              )}
            </p>
          </div>

          {script.visual && (
            <div
              className={`hidden h-[200px] transition-opacity duration-500 sm:block lg:h-auto lg:min-h-[220px] ${
                finished ? "opacity-100" : "opacity-0"
              }`}
            >
              <ClutchProgressionChart drivers={progression.data?.drivers} />
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {script.followups.map((followup, index) => (
            <button
              key={followup}
              type="button"
              onClick={() =>
                router.push(`/ask?q=${encodeURIComponent(followup)}`)
              }
              className={`rounded-sm border bg-surface-panel px-3 py-[7px] text-[13px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-bright ${
                index === script.followups.length - 1
                  ? "border-accent text-accent-light"
                  : "border-line-soft text-ink-soft hover:text-ink-base"
              }`}
            >
              {followup}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
