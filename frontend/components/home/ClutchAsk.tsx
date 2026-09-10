"use client";

import Link from "next/link";
import { formatLapTime } from "@/lib/chart-utils";
import { seconds3, teamTint } from "@/lib/consoleFormat";
import { driverHref } from "@/lib/entityLinks";
import type { ConsoleReplay } from "@/lib/queries/consoleReplay";
import ConsolePanel from "./ConsolePanel";

type Answer = {
  question: string;
  segments: { text: string; tint?: string | null; href?: string | null }[];
};

/**
 * One worked question, answered off the same rows the console is replaying.
 *
 * Every clause is derived, never written down: the driver, the time, the lap
 * and whether it was the last one all come from `fastest_lap` and `total_laps`,
 * so the answer cannot drift from the race on screen.
 */
function buildAnswer(replay: ConsoleReplay): Answer | null {
  const fastest = replay.fastest_lap;
  if (!fastest?.driver_code || fastest.lap == null) return null;

  const car = replay.cars.find(
    (entry) => entry.driver_code === fastest.driver_code,
  );
  if (!car) return null;

  const onTheLast = fastest.lap === replay.total_laps;

  return {
    question: `Who had the fastest lap at ${replay.circuit_name} in ${replay.date.slice(0, 4)}?`,
    segments: [
      {
        text: car.full_name,
        tint: teamTint(car.team_color),
        href: driverHref(car),
      },
      { text: ` set it on lap ${fastest.lap} of ${replay.total_laps}` },
      { text: onTheLast ? " — the last lap of the race — in " : " in " },
      { text: formatLapTime(fastest.seconds) },
      { text: `, ${seconds3(fastest.seconds)} seconds.` },
    ],
  };
}

export default function ClutchAsk({
  replay,
  className = "",
}: {
  replay: ConsoleReplay | undefined;
  className?: string;
}) {
  const answer = replay ? buildAnswer(replay) : null;

  return (
    <ConsolePanel
      title={
        <h2 className="m-0 text-[14px] font-bold tracking-[-0.01em] text-ink-strong">
          Ask <span className="text-accent-bright">Clutch</span>
        </h2>
      }
      className={className}
      bodyClassName="flex flex-col"
    >
      {answer ? (
        <div className="flex min-h-0 flex-1 flex-col px-3 py-3">
          <p className="m-0 flex gap-2 font-mono text-[11.5px] leading-relaxed text-ink-soft">
            <span aria-hidden="true" className="text-accent-bright">
              ❯
            </span>
            {answer.question}
          </p>

          <p className="m-0 mt-2.5 text-[13.5px] leading-[1.65] text-ink-base">
            {answer.segments.map((segment) => {
              const style = segment.tint
                ? { color: segment.tint, fontWeight: 600 }
                : undefined;
              return segment.href ? (
                <Link
                  key={segment.text}
                  href={segment.href}
                  className="underline decoration-transparent underline-offset-2 transition-colors hover:decoration-current"
                  style={style}
                >
                  {segment.text}
                </Link>
              ) : (
                <span key={segment.text} style={style}>
                  {segment.text}
                </span>
              );
            })}
          </p>

          <Link
            href="/ask"
            className="mt-auto flex items-center justify-between gap-2 rounded-sm border border-line-strong bg-surface-page px-3 py-2 text-[12.5px] text-ink-soft transition-colors hover:border-accent hover:text-ink-base"
          >
            Ask your own
            <span aria-hidden="true" className="text-accent-bright">
              →
            </span>
          </Link>
        </div>
      ) : (
        <p className="flex flex-1 items-center px-3 text-[12.5px] text-ink-soft">
          No fastest lap was recorded for this round.
        </p>
      )}
    </ConsolePanel>
  );
}
