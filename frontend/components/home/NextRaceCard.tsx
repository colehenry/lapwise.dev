"use client";

import { useQuery } from "@tanstack/react-query";
import { utcDate } from "@/lib/consoleFormat";
import { upcomingEventsQuery } from "@/lib/queries/events";
import CircuitOutline from "./CircuitOutline";

const DAY_MS = 86_400_000;

function daysUntil(date: string): number {
  const event = new Date(`${date}T00:00:00Z`).getTime();
  const today = Date.now();
  return Math.max(0, Math.ceil((event - today) / DAY_MS));
}

/**
 * The endpoint caps at ten, so this card names what is coming and never how
 * long the season is.
 */
export default function NextRaceCard() {
  const { data } = useQuery(upcomingEventsQuery());
  const races = (data ?? []).filter((event) => event.event_type === "race");
  const next = races[0];

  if (!next) return null;

  const days = daysUntil(next.event_date);

  return (
    <section
      className="relative flex flex-col overflow-hidden rounded-sm border border-line-soft p-4"
      style={{
        background:
          "radial-gradient(130% 100% at 100% 0%, color-mix(in srgb, var(--accent) 16%, transparent), transparent 62%), var(--surface-panel)",
      }}
    >
      {/* The circuit sits in the top-right corner, where the card had nothing. */}
      <CircuitOutline
        circuitId={next.circuit_id}
        circuitName={next.circuit_name ?? next.location}
        className="pointer-events-none absolute right-3 top-3 h-[104px] w-[150px]"
        opacity={0.55}
      />

      <div className="relative">
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
          Next race
        </span>
        <p className="m-0 font-mono text-[54px] leading-none tracking-[-0.045em] tabular-nums text-ink-strong">
          {days}
          <span className="ml-[7px] text-[15px] tracking-normal text-ink-base">
            {days === 1 ? "day" : "days"}
          </span>
        </p>
      </div>
      <h3 className="relative m-0 mt-3.5 text-[21px] font-bold tracking-[-0.025em] text-ink-strong">
        {next.event_name}
      </h3>
      <p className="relative m-0 mt-[5px] font-mono text-[10px] uppercase tracking-[0.12em] text-ink-base">
        {next.location}
        {next.round_number != null && ` · Round ${next.round_number}`} ·{" "}
        {utcDate(next.event_date, { day: "numeric", month: "long" })}
      </p>
      {races.length > 1 && (
        <div className="relative mt-auto border-t border-line-strong pt-3">
          {races.slice(1, 4).map((event) => (
            <div
              key={`${event.event_name}-${event.event_date}`}
              className="flex justify-between gap-3 py-[5px] text-[12.5px] text-ink-base"
            >
              <span className="truncate">{event.event_name}</span>
              <span className="font-mono text-[11px] tabular-nums text-ink-soft">
                {utcDate(event.event_date, { day: "numeric", month: "short" })}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
