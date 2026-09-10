"use client";

import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { constructorHref, driverHref } from "@/lib/entityLinks";
import type { ClutchContext, ResolvedScript } from "@/lib/homeClutchScript";
import { pickClutchScript } from "@/lib/homeClutchScript";
import { pointsProgressionQuery } from "@/lib/queries/pointsProgression";
import type { EntityColors } from "@/lib/queries/standings";
import type { ProgressionSeries } from "./ClutchProgressionChart";

/* Recharts is heavier than the rest of the console put together, and the band
   sits below the fold, so it arrives with the band rather than the page. */
const ClutchProgressionChart = dynamic(
  () => import("./ClutchProgressionChart"),
  { ssr: false },
);

/** Reading pace, in characters per second. */
export const TYPE_RATE = 52;
/** A beat before the answer starts, so the question is read first. */
export const LEAD_IN = 0.7;

/** Where a named entity in an answer points. */
function hrefFor(segment: ResolvedScript["segments"][number]): string | null {
  if (!segment.code) return null;
  return segment.tint === "team"
    ? constructorHref(segment.code)
    : driverHref({ driver_code: segment.code });
}

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
  spanRefs: React.RefObject<(HTMLElement | null)[]>;
  finished: boolean;
} {
  const spanRefs = useRef<(HTMLElement | null)[]>([]);
  const [finished, setFinished] = useState(false);

  /* Keyed on the answer's text, never on the script's identity. Every render
     builds a fresh script object, so an identity-keyed effect restarted the
     typewriter before it could reach the end. */
  const answer = script?.segments.map((segment) => segment.text).join("") ?? "";
  const scriptRef = useRef(script);
  scriptRef.current = script;

  useEffect(() => {
    const current = scriptRef.current;
    if (!current || answer.length === 0) return;
    const lengths = current.segments.map((segment) => segment.text.length);
    const total = answer.length;

    const paint = (shown: number) => {
      let consumed = 0;
      lengths.forEach((length, index) => {
        const element = spanRefs.current[index];
        if (element) {
          const visible = Math.max(0, Math.min(length, shown - consumed));
          element.textContent = current.segments[index].text.slice(0, visible);
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
  }, [answer, enabled]);

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
  const [draft, setDraft] = useState("");

  const mode = script?.visual?.mode ?? "drivers";
  const progression = useQuery({
    ...pointsProgressionQuery(context.season, mode),
    enabled: context.season !== null && script?.visual != null,
  });

  const series: ProgressionSeries[] | undefined = useMemo(() => {
    const data = progression.data;
    if (!data) return undefined;
    if (mode === "constructors") {
      return data.constructors?.map((team) => ({
        key: team.team_name,
        name: team.team_name,
        color: team.team_color,
        progression: team.progression,
        finalPosition: team.final_position,
      }));
    }
    return data.drivers?.map((driver) => ({
      key: driver.driver_slug ?? driver.driver_code ?? driver.full_name,
      name: driver.full_name,
      color: driver.team_color,
      progression: driver.progression,
      finalPosition: driver.final_position,
    }));
  }, [progression.data, mode]);

  if (!script) return null;

  const goToAsk = (question: string) => {
    router.push(`/ask?q=${encodeURIComponent(question)}`);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    goToAsk(draft.trim() || script.question);
  };

  return (
    <section className="border-y border-line-soft bg-surface-band px-3 pb-12 pt-10">
      <div className="mx-auto max-w-[1060px] px-2">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="m-0 text-[30px] font-bold leading-[1.08] tracking-[-0.035em] text-ink-strong">
            <span className="text-accent-bright">Ask Clutch</span> anything
            about Formula 1.
          </h2>
          <button
            type="button"
            onClick={() => goToAsk(script.question)}
            className="flex-none rounded-sm border border-accent-bright bg-accent px-5 py-2.5 text-[14px] font-semibold text-ink-strong transition-colors hover:bg-accent-bright focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-bright"
          >
            Try it out
          </button>
        </div>

        {/* One transcript, top to bottom: what was asked, what came back, and
            the rows it came from. A second column only stretched the answer to
            the chart's height and left a hole under two lines of text. */}
        <p className="m-0 mt-7 flex max-w-[78ch] justify-end gap-2.5 text-right text-[17px] font-medium leading-[1.6] text-ink-strong">
          <span className="min-w-0">{script.question}</span>
          {/* Outfit has no glyph for the chevron, so it keeps the mono face
              rather than falling back differently on every platform. */}
          <span
            aria-hidden="true"
            className="shrink-0 font-mono text-accent-bright"
          >
            ❮
          </span>
        </p>

        <p className="m-0 mt-3 max-w-[78ch] whitespace-pre-line text-[16px] leading-[1.7] text-ink-base">
          {script.segments.map((segment, index) => {
            const href = hrefFor(segment);
            const style = {
              color: tintFor(segment, colors),
              fontWeight: segment.tint ? 600 : undefined,
            };
            const attach = (node: HTMLElement | null) => {
              spanRefs.current[index] = node;
            };
            /* The typewriter writes into whichever element this is, so a named
               entity can be an anchor without the typing changing. */
            return href ? (
              <Link
                key={`${script.id}-${index}`}
                href={href}
                ref={attach}
                className="underline decoration-transparent underline-offset-2 transition-colors hover:decoration-current"
                style={style}
              />
            ) : (
              <span key={`${script.id}-${index}`} ref={attach} style={style} />
            );
          })}
          {!finished && (
            <span
              aria-hidden="true"
              className="caret-blink ml-0.5 inline-block h-[15px] w-[8px] translate-y-px bg-accent-bright"
            />
          )}
        </p>

        {script.visual && (
          <figure
            className={`m-0 mt-7 hidden transition-opacity duration-500 sm:block ${
              finished ? "opacity-100" : "opacity-0"
            }`}
          >
            <figcaption className="mb-3 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft">
              Cumulative {mode === "constructors" ? "constructor" : "driver"}{" "}
              points by round
              {context.season ? ` · ${context.season}` : ""}
            </figcaption>
            <div className="h-[280px] w-full">
              <ClutchProgressionChart series={series} />
            </div>
          </figure>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          {script.followups.map((followup) => (
            <button
              key={followup}
              type="button"
              onClick={() => goToAsk(followup)}
              className="rounded-sm border border-line-soft bg-surface-panel px-3 py-[7px] text-[13px] text-ink-soft transition-colors hover:border-accent hover:text-ink-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-bright"
            >
              {followup}
            </button>
          ))}
        </div>

        {/* A real prompt, not a button dressed as one. The caret waits until the
            answer has finished, so attention hands off rather than competing. */}
        <form
          onSubmit={submit}
          className="mt-7 flex items-center gap-3 rounded-[5px] border border-line-strong bg-surface-panel py-2.5 pl-[15px] pr-2.5 transition-colors focus-within:border-accent"
        >
          <span
            aria-hidden="true"
            className={`font-mono text-[15px] text-accent-bright ${
              finished && draft.length === 0 ? "caret-blink" : ""
            }`}
          >
            ❯
          </span>
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Ask about any race, driver or season…"
            aria-label="Ask Clutch a question about Formula 1"
            className="min-w-0 flex-1 bg-transparent text-[15px] text-ink-strong outline-none placeholder:text-ink-faint"
          />
          <button
            type="submit"
            aria-label="Send this question to Clutch"
            className="flex h-9 w-9 flex-none items-center justify-center rounded-sm border border-accent-bright bg-accent text-ink-strong transition-colors hover:bg-accent-bright focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-bright"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <title>Send</title>
              <path d="M4 12h14" />
              <path d="M13 6l6 6-6 6" />
            </svg>
          </button>
        </form>
      </div>
    </section>
  );
}
