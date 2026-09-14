"use client";

import Link from "next/link";
import { teamTint } from "@/lib/consoleFormat";
import { driverHref } from "@/lib/entityLinks";
import type { ConsoleCar, ConsoleReplay } from "@/lib/queries/consoleReplay";
import ConsolePanel from "./ConsolePanel";

type Answer = {
  question: string;
  segments: { text: string; tint?: string | null; href?: string | null }[];
};

function surname(car: ConsoleCar): string {
  return car.full_name.trim().split(/\s+/).at(-1) ?? car.full_name;
}

function driverSegment(car: ConsoleCar) {
  return {
    text: surname(car),
    tint: teamTint(car.team_color),
    href: driverHref(car),
  };
}

function positionAt(car: ConsoleCar, seconds: number): number | null {
  let lapIndex = -1;
  for (let index = 0; index < car.start.length; index += 1) {
    if (car.start[index] > seconds) break;
    lapIndex = index;
  }
  return lapIndex < 0 ? null : (car.laps[lapIndex]?.pos ?? null);
}

/** FastF1 records "VSC" and "VSC ending" as adjacent windows. */
function vscPeriods(replay: ConsoleReplay) {
  const periods: { from: number; to: number }[] = [];
  const windows = replay.status
    .filter((window) => window.code === "vsc")
    .sort((left, right) => left.from - right.from);

  for (const window of windows) {
    const previous = periods.at(-1);
    if (previous && window.from <= previous.to + 1) {
      previous.to = Math.max(previous.to, window.to);
    } else {
      periods.push({ from: window.from, to: window.to });
    }
  }
  return periods;
}

/**
 * Detect the leader being caught beyond pit entry as a VSC begins: rivals can
 * take a reduced-cost stop, while the leader must return after racing resumes.
 */
function buildMissedVscAnswer(replay: ConsoleReplay): Answer | null {
  const pitEvents = replay.feed
    .filter((event) => event.kind === "pit" && event.driver_code)
    .sort((left, right) => left.t - right.t);

  for (const period of vscPeriods(replay)) {
    const leader = replay.cars.find(
      (car) => car.driver_code && positionAt(car, period.from) === 1,
    );
    if (!leader?.driver_code || leader.final_position === 1) continue;

    const nextLapIndex = leader.start.findIndex(
      (start) => start >= period.from,
    );
    if (nextLapIndex < 0) continue;
    const secondsToLine = leader.start[nextLapIndex] - period.from;
    if (secondsToLine < 0 || secondsToLine > 10) continue;

    const leaderStop = pitEvents.find(
      (event) =>
        event.driver_code === leader.driver_code &&
        event.t > period.to &&
        event.t <= period.to + 45,
    );
    if (!leaderStop) continue;

    const rejoinLapIndex = leader.start.findIndex(
      (start) => start >= leaderStop.t,
    );
    const rejoinPosition = leader.laps[rejoinLapIndex]?.pos;
    if (rejoinPosition == null || rejoinPosition <= 1) continue;

    const stoppedUnderVsc = new Set(
      pitEvents
        .filter((event) => event.t >= period.from && event.t <= period.to)
        .map((event) => event.driver_code),
    );
    const beneficiaries = replay.cars
      .filter(
        (car) =>
          car.driver_code !== leader.driver_code &&
          stoppedUnderVsc.has(car.driver_code) &&
          car.final_position != null &&
          leader.final_position != null &&
          car.final_position < leader.final_position,
      )
      .sort(
        (left, right) =>
          (left.final_position ?? Infinity) -
          (right.final_position ?? Infinity),
      )
      .slice(0, 2);
    if (beneficiaries.length === 0) continue;

    const secondsAfterGreen = leaderStop.t - period.to;
    const finalPosition = leader.final_position;
    const recovery =
      finalPosition != null && finalPosition < rejoinPosition
        ? ` before recovering to P${finalPosition}.`
        : finalPosition != null
          ? ` and finished P${finalPosition}.`
          : ".";
    const beneficiarySegments = beneficiaries.flatMap((car, index) => [
      ...(index === 0 ? [] : [{ text: " and " }]),
      driverSegment(car),
    ]);

    return {
      question: `How did the VSC cost ${surname(leader)} the lead?`,
      segments: [
        {
          text: `The VSC began ${secondsToLine.toFixed(1)} seconds before `,
        },
        driverSegment(leader),
        {
          text: ` started lap ${nextLapIndex + 1}—too late to pit immediately. `,
        },
        ...beneficiarySegments,
        {
          text: ` stopped while the field was slowed. ${surname(leader)} had to drive around and pitted ${secondsAfterGreen.toFixed(1)} seconds after green-flag racing resumed, dropping from P1 to P${rejoinPosition}${recovery}`,
        },
      ],
    };
  }
  return null;
}

/** A compact fallback when the replay has no explanatory strategic swing. */
function buildWinnerLeadAnswer(replay: ConsoleReplay): Answer | null {
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
  const winnerSurname = surname(winner);
  const ledThroughout = finalLeadLap === 1 && lapsLed === positions.length;

  const raceShape = ledThroughout
    ? ` held P1 at the end of every recorded lap, leading all ${positions.length}.`
    : ` moved into P1 for the final time on lap ${finalLeadLap} and stayed there for the last ${closingLaps} lap${closingLaps === 1 ? "" : "s"}. ${winnerSurname} led ${lapsLed} of ${positions.length} laps overall${lowestPosition !== null && lowestPosition > 1 ? ` after running as low as P${lowestPosition}` : ""}.`;

  return {
    question: ledThroughout
      ? `Did ${winnerSurname} lead from start to finish?`
      : `When did ${winnerSurname} take the lead for good?`,
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

function buildAnswer(replay: ConsoleReplay): Answer | null {
  return buildMissedVscAnswer(replay) ?? buildWinnerLeadAnswer(replay);
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
            {answer.segments.map((segment, index) => {
              const style = segment.tint
                ? { color: segment.tint, fontWeight: 600 }
                : undefined;
              return segment.href ? (
                <Link
                  key={`${index}-${segment.text}`}
                  href={segment.href}
                  className="underline decoration-transparent underline-offset-2 transition-colors hover:decoration-current"
                  style={style}
                >
                  {segment.text}
                </Link>
              ) : (
                <span key={`${index}-${segment.text}`} style={style}>
                  {segment.text}
                </span>
              );
            })}
          </p>

          <Link
            href="/ask"
            className="mt-auto flex items-center justify-between gap-2 rounded-sm border border-line-strong bg-surface-page px-3 py-2 text-[12.5px] text-ink-soft transition-colors hover:border-accent hover:text-ink-base"
          >
            Ask your own question...
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
