"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { UpcomingEvent } from "@/hooks/useHomeData";
import { isValidHeadshotUrl } from "@/lib/api";
import SeasonGlobe, { type GlobeRound } from "./SeasonGlobe";

type Props = {
  rounds: GlobeRound[];
  season: number;
  next: UpcomingEvent | undefined;
};

function daysUntil(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const target = Date.UTC(y, m - 1, d);
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / 86400000);
}

function longDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const months =
    "January February March April May June July August September October November December".split(
      " ",
    );
  return `${d} ${months[m - 1]} ${y}`;
}

/**
 * The season, mapped. Only completed rounds are plotted, and the globe eases
 * round to whichever one is selected. The next race sits alongside so the
 * section covers where the season has been and where it goes next.
 */
export default function SeasonSection({ rounds, season, next }: Props) {
  const [focus, setFocus] = useState<number | null>(null);

  useEffect(() => {
    if (focus === null && rounds.length)
      setFocus(rounds[rounds.length - 1].round);
  }, [rounds, focus]);

  const active =
    rounds.find((r) => r.round === focus) ?? rounds[rounds.length - 1];
  const winners = new Set(
    rounds.map((r) => r.podium[0]?.driver_code).filter(Boolean),
  );

  return (
    <section className="border-t border-border-primary px-4 py-16 md:px-6 md:py-24">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-center">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-purple-400">
            The season
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-text-primary md:text-4xl">
            Every round, everywhere it went.
          </h2>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-text-secondary">
            <strong className="font-semibold text-text-primary">
              {rounds.length} races
            </strong>{" "}
            run so far in {season}, across{" "}
            {new Set(rounds.map((r) => r.circuitName)).size} circuits and{" "}
            {winners.size} different winners. Click any round for its podium.
          </p>

          <div className="relative mt-6 aspect-[4/3] w-full">
            <SeasonGlobe
              rounds={rounds}
              focusRound={focus}
              onFocusChange={setFocus}
            />
            {active && (
              <div className="absolute bottom-2 left-2 grid min-w-[13rem] gap-1 rounded-sm border border-border-primary bg-bg-primary/85 p-3 backdrop-blur-md">
                <div className="flex justify-between gap-4 font-mono text-[9px] uppercase tracking-widest text-text-muted">
                  <span>Round {String(active.round).padStart(2, "0")}</span>
                  <span>{active.date.slice(5)}</span>
                </div>
                <p className="text-base font-bold tracking-tight text-text-primary">
                  {active.shortName}
                </p>
                <ol className="mt-1 grid gap-1 border-t border-border-primary pt-2">
                  {active.podium.slice(0, 3).map((p, i) => (
                    <li key={p.driver_code} className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-text-muted">
                        {i + 1}
                      </span>
                      <span
                        className="relative h-5 w-5 shrink-0 overflow-hidden rounded-full border bg-bg-secondary"
                        style={{
                          borderColor: p.team_color
                            ? `#${p.team_color.replace("#", "")}`
                            : "var(--border-secondary)",
                        }}
                      >
                        {isValidHeadshotUrl(p.headshot_url) ? (
                          <Image
                            src={p.headshot_url as string}
                            alt=""
                            fill
                            sizes="20px"
                            className="scale-125 object-cover object-[50%_12%]"
                          />
                        ) : null}
                      </span>
                      <span
                        className="truncate text-xs font-semibold"
                        style={{
                          color: p.team_color
                            ? `#${p.team_color.replace("#", "")}`
                            : undefined,
                        }}
                      >
                        {p.full_name}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            <span className="pointer-events-none absolute right-0 top-0 font-mono text-[9px] uppercase tracking-widest text-text-muted">
              Drag to rotate · click a round
            </span>
          </div>
        </div>

        <aside className="grid gap-4 rounded-sm border border-border-primary bg-bg-tertiary p-5">
          <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-purple-400">
            Next race
          </p>
          {next ? (
            <>
              <div>
                <h3 className="text-2xl font-bold leading-tight tracking-tight text-text-primary">
                  {next.event_name}
                </h3>
                <p className="mt-1 text-[13px] text-text-muted">
                  {next.location}, {next.country}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-border-primary bg-border-primary">
                <div className="bg-bg-secondary px-3 py-2.5">
                  <p className="font-mono text-[9px] uppercase tracking-widest text-text-muted">
                    Lights out
                  </p>
                  <p className="font-mono text-sm font-semibold text-text-primary">
                    {longDate(next.event_date)}
                  </p>
                </div>
                <div className="bg-bg-secondary px-3 py-2.5">
                  <p className="font-mono text-[9px] uppercase tracking-widest text-text-muted">
                    Countdown
                  </p>
                  <p className="font-mono text-sm font-semibold text-purple-300">
                    {Math.max(0, daysUntil(next.event_date))} days
                  </p>
                </div>
              </div>
              {next.round_number && (
                <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                  Round {next.round_number} ·{" "}
                  {next.circuit_name ?? next.location}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-text-muted">Season complete.</p>
          )}
          <Link
            href="/results"
            className="mt-1 rounded-sm bg-purple-500 px-4 py-2.5 text-center text-sm font-bold text-white transition-colors hover:bg-purple-400"
          >
            Race Weekend Hub
          </Link>
        </aside>
      </div>
    </section>
  );
}
