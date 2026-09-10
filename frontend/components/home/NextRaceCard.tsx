"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";
import { utcDate } from "@/lib/consoleFormat";
import { upcomingEventsQuery } from "@/lib/queries/events";
import CircuitOutline from "./CircuitOutline";

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;

function daysUntil(date: string): number {
  const event = new Date(`${date}T00:00:00Z`).getTime();
  const today = Date.now();
  return Math.max(0, Math.ceil((event - today) / DAY_MS));
}

type Countdown = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

function remaining(startUtc: string): Countdown {
  const left = Math.max(0, new Date(`${startUtc}Z`).getTime() - Date.now());
  return {
    days: Math.floor(left / DAY_MS),
    hours: Math.floor((left % DAY_MS) / HOUR_MS),
    minutes: Math.floor((left % HOUR_MS) / MINUTE_MS),
    seconds: Math.floor((left % MINUTE_MS) / 1000),
  };
}

/**
 * Counts down to lights out, not to midnight.
 *
 * Starts null so the server and the first client render agree — a clock
 * rendered on the server is wrong by the time it arrives.
 */
function useCountdown(startUtc: string | null | undefined): Countdown | null {
  const [left, setLeft] = useState<Countdown | null>(null);

  useEffect(() => {
    if (!startUtc) {
      setLeft(null);
      return;
    }
    setLeft(remaining(startUtc));
    const timer = window.setInterval(() => setLeft(remaining(startUtc)), 1000);
    return () => window.clearInterval(timer);
  }, [startUtc]);

  return left;
}

function LastTime({
  season,
  round,
}: {
  season: number | null;
  round: number | null;
}) {
  /* A circuit making its debut has no last time, and says nothing rather than
     linking somewhere that is not the same track. */
  if (season == null || round == null) return null;
  return (
    <Link
      href={`/results/${season}/${round}`}
      className="group/last flex flex-none items-center gap-1 font-mono text-[9.5px] uppercase tracking-[0.12em] text-accent-bright transition-colors hover:text-accent-light"
    >
      See {season}
      <span
        aria-hidden="true"
        className="transition-transform group-hover/last:translate-x-0.5"
      >
        →
      </span>
    </Link>
  );
}

function Unit({ value, label }: { value: number; label: string }) {
  return (
    <span className="flex items-baseline gap-1">
      <span className="font-mono text-[30px] leading-none tracking-[-0.04em] tabular-nums text-ink-strong">
        {String(value).padStart(2, "0")}
      </span>
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
        {label}
      </span>
    </span>
  );
}

/**
 * The endpoint caps at ten, so this card names what is coming and never how
 * long the season is.
 */
export default function NextRaceCard() {
  const { data } = useQuery(upcomingEventsQuery());
  const races = (data ?? []).filter((event) => event.event_type === "race");
  const next = races[0];
  const countdown = useCountdown(next?.race_start_utc);

  if (!next) return null;

  const days = daysUntil(next.event_date);

  return (
    <section
      className="relative flex h-full flex-col overflow-hidden rounded-sm border border-line-soft p-5"
      style={{
        background:
          "radial-gradient(130% 100% at 100% 0%, color-mix(in srgb, var(--accent) 16%, transparent), transparent 62%), var(--surface-panel)",
      }}
    >
      {/* The circuit sits in the top-right corner, where the card had nothing. */}
      <CircuitOutline
        circuitId={next.circuit_id}
        circuitName={next.circuit_name ?? next.location}
        className="pointer-events-none absolute right-4 top-4 h-[110px] w-[110px]"
        stroke="var(--ink-soft)"
        strokeWidth={1.5}
        opacity={0.8}
      />

      <div className="relative">
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
          Next race
        </span>
        {countdown ? (
          <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <Unit value={countdown.days} label="d" />
            <Unit value={countdown.hours} label="h" />
            <Unit value={countdown.minutes} label="m" />
            <Unit value={countdown.seconds} label="s" />
          </div>
        ) : (
          <p className="m-0 font-mono text-[54px] leading-none tracking-[-0.045em] tabular-nums text-ink-strong">
            {days}
            <span className="ml-[7px] text-[15px] tracking-normal text-ink-base">
              {days === 1 ? "day" : "days"}
            </span>
          </p>
        )}
      </div>

      <h3 className="relative m-0 mt-3.5 text-[21px] font-bold tracking-[-0.025em] text-ink-strong">
        {next.event_name}
      </h3>
      <p className="relative m-0 mt-[5px] font-mono text-[10px] uppercase tracking-[0.12em] text-ink-base">
        {next.location}
        {next.round_number != null && ` · Round ${next.round_number}`} ·{" "}
        {utcDate(next.event_date, { day: "numeric", month: "long" })}
      </p>
      <div className="relative mt-2">
        <LastTime
          season={next.last_raced_season}
          round={next.last_raced_round}
        />
      </div>
      {races.length > 1 && (
        <div className="relative mt-auto border-t border-line-strong pt-3">
          {races.slice(1, 4).map((event) => (
            <div
              key={`${event.event_name}-${event.event_date}`}
              className="flex items-center justify-between gap-3 py-[5px] text-[12.5px] text-ink-base"
            >
              <span className="min-w-0 truncate">{event.event_name}</span>
              <span className="flex flex-none items-center gap-3">
                <LastTime
                  season={event.last_raced_season}
                  round={event.last_raced_round}
                />
                <span className="w-[46px] text-right font-mono text-[11px] tabular-nums text-ink-soft">
                  {utcDate(event.event_date, {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
