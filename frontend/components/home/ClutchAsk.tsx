"use client";

import Link from "next/link";
import { teamTint } from "@/lib/consoleFormat";
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
 * It follows the winner's recorded position by lap, showing when the final
 * lead began and how much of the race they actually led.
 */
function buildAnswer(replay: ConsoleReplay): Answer | null {
  const winner = replay.cars.find(
    (entry) => entry.final_position === 1 && entry.driver_code,
  );
  if (!winner?.driver_code) return null;

  const positions = winner.laps
    .slice(0, replay.total_laps)
    .map((lap) => lap.pos);
  if (positions.length === 0 || positions.at(-1) !== 1) return null;

  let finalLeadIndex = positions.length - 1;
  while (finalLeadIndex > 0 && positions[finalLeadIndex - 1] === 1) {
    finalLeadIndex -= 1;
  }

  const lapsLed = positions.filter((position) => position === 1).length;
  const finalLeadLap = finalLeadIndex + 1;
  const closingLaps = positions.length - finalLeadIndex;
  const recordedPositions = positions.filter(
    (position): position is number => position !== null,
  );
  const lowestPosition =
    recordedPositions.length > 0 ? Math.max(...recordedPositions) : null;
  const surname =
    winner.full_name.trim().split(/\s+/).at(-1) ?? winner.full_name;
  const ledThroughout = finalLeadLap === 1 && lapsLed === positions.length;

  const raceShape = ledThroughout
    ? ` held P1 at the end of every recorded lap, leading all ${positions.length}.`
    : ` moved into P1 for the final time on lap ${finalLeadLap} and stayed there for the last ${closingLaps} lap${closingLaps === 1 ? "" : "s"}. ${surname} led ${lapsLed} of ${positions.length} laps overall${lowestPosition !== null && lowestPosition > 1 ? ` after running as low as P${lowestPosition}` : ""}.`;

  return {
    question: ledThroughout
      ? `Did ${surname} lead from start to finish?`
      : `When did ${surname} take the lead for good?`,
    segments: [
      {
        text: winner.full_name,
        tint: teamTint(winner.team_color),
        href: driverHref(winner),
      },
      { text: raceShape },
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
          <p className="m-0 flex justify-end gap-2 text-right text-[12.5px] leading-[1.5] text-ink-soft">
            <span className="min-w-0">{answer.question}</span>
            <span
              aria-hidden="true"
              className="shrink-0 font-mono text-accent-bright"
            >
              ❮
            </span>
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
          No complete winner position path was recorded for this round.
        </p>
      )}
    </ConsolePanel>
  );
}
