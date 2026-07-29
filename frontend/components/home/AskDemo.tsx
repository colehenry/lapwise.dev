"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { RaceClock } from "@/lib/raceClock";

type QA = { question: string; answer: string };

type Props = {
  clock: RaceClock | null;
  eventName: string;
  /** Compact form for the sidebar tile; full form gets its own section frame. */
  compact?: boolean;
};

const TYPE_MS = 34;
const HOLD_MS = 3400;

/**
 * A live question-and-answer demo. Every answer is computed from the loaded lap
 * data at render time, so the tile can never claim something the database does
 * not actually support.
 */
export default function AskDemo({ clock, eventName, compact = false }: Props) {
  const pairs = useMemo(() => buildPairs(clock, eventName), [clock, eventName]);

  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState("");
  const [revealed, setRevealed] = useState(false);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
  }, []);

  useEffect(() => {
    if (!pairs.length) return;
    const current = pairs[index % pairs.length];

    if (reduced.current) {
      setTyped(current.question);
      setRevealed(true);
      return;
    }

    setTyped("");
    setRevealed(false);

    let char = 0;
    let holdTimer: ReturnType<typeof setTimeout>;
    let revealTimer: ReturnType<typeof setTimeout>;

    const tick = setInterval(() => {
      char += 1;
      setTyped(current.question.slice(0, char));
      if (char >= current.question.length) {
        clearInterval(tick);
        revealTimer = setTimeout(() => {
          setRevealed(true);
          holdTimer = setTimeout(() => setIndex((i) => i + 1), HOLD_MS);
        }, 380);
      }
    }, TYPE_MS);

    return () => {
      clearInterval(tick);
      clearTimeout(holdTimer);
      clearTimeout(revealTimer);
    };
  }, [index, pairs]);

  if (!pairs.length) {
    return compact ? null : (
      <div className="h-40 animate-pulse rounded-sm border border-border-primary bg-bg-tertiary" />
    );
  }

  const current = pairs[index % pairs.length];

  const body = (
    <div className={compact ? "grid gap-2" : "grid gap-4"}>
      <p className="flex items-start gap-2">
        <span className="font-mono text-sm font-bold text-purple-400">?</span>
        <span
          className={`text-text-primary ${compact ? "text-[13px] leading-snug" : "text-lg md:text-xl"}`}
        >
          {typed}
          <span className="ml-0.5 inline-block h-[1em] w-[2px] animate-pulse bg-purple-400 align-text-bottom" />
        </span>
      </p>
      <p
        className={`pl-5 font-mono text-success transition-all duration-300 ${
          revealed ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
        } ${compact ? "text-[11px] leading-snug" : "text-sm md:text-base"}`}
      >
        {current.answer}
      </p>
    </div>
  );

  if (compact) return body;

  return (
    <div className="rounded-sm border border-border-primary bg-bg-tertiary p-5 md:p-7">
      {body}
      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border-primary pt-4">
        <Link
          href="/ask"
          className="rounded-sm bg-purple-500 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-purple-400"
        >
          Ask your own question
        </Link>
        <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
          Answers computed live from {eventName}
        </span>
      </div>
    </div>
  );
}

/** Only questions this dataset can actually answer make it into the rotation. */
function buildPairs(clock: RaceClock | null, eventName: string): QA[] {
  if (!clock) return [];
  const pairs: QA[] = [];
  const short = eventName.replace(" Grand Prix", "");

  const timed = clock.cars.flatMap((c) =>
    c.laps
      .filter(
        (l) => typeof l.lap_time_seconds === "number" && l.lap_time_seconds > 0,
      )
      .map((l) => ({ car: c, lap: l })),
  );

  // Fastest compound on green-flag running.
  const byCompound = new Map<string, { sum: number; n: number }>();
  const ceiling = quantile(
    timed.map((t) => t.lap.lap_time_seconds as number),
    0.9,
  );
  for (const { lap } of timed) {
    if (!lap.compound || (lap.lap_time_seconds as number) > ceiling) continue;
    const g = byCompound.get(lap.compound) ?? { sum: 0, n: 0 };
    g.sum += lap.lap_time_seconds as number;
    g.n += 1;
    byCompound.set(lap.compound, g);
  }
  const compounds = [...byCompound.entries()]
    .map(([c, g]) => ({ compound: c, avg: g.sum / g.n }))
    .sort((a, b) => a.avg - b.avg);
  if (compounds.length > 1) {
    const best = compounds[0];
    pairs.push({
      question: `Which tyre was quickest at ${short}?`,
      answer: `${title(best.compound)} — ${format(best.avg)} average on green-flag laps, ${(compounds[compounds.length - 1].avg - best.avg).toFixed(2)}s clear of the slowest.`,
    });
  }

  // Biggest recovery drive.
  const gains = clock.cars
    .map((c) => {
      const grid = c.laps[0]?.position ?? null;
      const finish = c.finalPosition;
      if (!grid || !finish) return null;
      return { code: c.code, gained: grid - finish, grid, finish };
    })
    .filter(
      (g): g is NonNullable<typeof g> =>
        Boolean(g) && (g as { gained: number }).gained > 0,
    )
    .sort((a, b) => b.gained - a.gained);
  if (gains.length) {
    const top = gains[0];
    pairs.push({
      question: "Who made up the most places?",
      answer: `${top.code} — up ${top.gained} from P${top.grid} on lap one to P${top.finish} at the flag.`,
    });
  }

  // Neutralised running.
  if (clock.flags.length) {
    const laps = clock.flags.reduce((n, f) => n + (f.to - f.from + 1), 0);
    pairs.push({
      question: "How much of the race was neutralised?",
      answer: `${laps} of ${clock.totalLaps} laps across ${clock.flags.length} period${clock.flags.length === 1 ? "" : "s"} — ${clock.flags.map((f) => f.label).join(", ")}.`,
    });
  }

  // Fastest lap of the race.
  const quickest = timed.reduce<{ car: string; t: number } | null>(
    (acc, cur) => {
      const t = cur.lap.lap_time_seconds as number;
      return !acc || t < acc.t ? { car: cur.car.code, t } : acc;
    },
    null,
  );
  if (quickest) {
    pairs.push({
      question: "What was the fastest lap?",
      answer: `${format(quickest.t)} by ${quickest.car}.`,
    });
  }

  return pairs;
}

function quantile(values: number[], q: number) {
  if (!values.length) return Number.POSITIVE_INFINITY;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] !== undefined
    ? sorted[base] + rest * (sorted[base + 1] - sorted[base])
    : sorted[base];
}

function format(seconds: number) {
  const m = Math.floor(seconds / 60);
  return `${m}:${(seconds - m * 60).toFixed(3).padStart(6, "0")}`;
}

function title(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}
