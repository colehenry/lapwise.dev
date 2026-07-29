"use client";

import Image from "next/image";
import Link from "next/link";
import { isValidHeadshotUrl } from "@/lib/api";
import { circuitHref, driverHref } from "@/lib/entityLinks";
import type { RoundSummary, SessionResultsResponse } from "@/lib/types";
import TrackOutline from "./TrackOutline";

type Props = {
  latest: RoundSummary | undefined;
  results: SessionResultsResponse | undefined;
  polyline: [number, number][] | undefined;
  rotation: number;
};

function raceTime(seconds: number | null | undefined) {
  if (typeof seconds !== "number") return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds - h * 3600) / 60);
  const s = seconds - h * 3600 - m * 60;
  const mm = String(m).padStart(2, "0");
  const ss = s.toFixed(3).padStart(6, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

/**
 * The newest classified result. Narrow by design so it can sit beside the
 * circuit outline, and carrying the supporting numbers — grid, points, fastest
 * lap, finishers — that make it a result rather than a headline.
 */
export default function LatestResult({
  latest,
  results,
  polyline,
  rotation,
}: Props) {
  if (!latest) {
    return (
      <section className="h-64 animate-pulse rounded-sm border border-border-primary bg-bg-tertiary" />
    );
  }

  const detail = results?.results ?? [];
  const byCode = new Map(detail.map((r) => [r.driver.driver_code, r]));
  const fastest = detail.find((r) => r.fastest_lap);
  const finishers = detail.filter((r) => r.status === "Finished").length;
  const winner = latest.podium[0];
  const winnerGrid = winner
    ? byCode.get(winner.driver_code)?.grid_position
    : null;

  return (
    <section className="overflow-hidden rounded-sm border border-border-primary bg-bg-tertiary">
      <header className="flex items-center justify-between border-b border-border-primary px-4 py-2.5">
        <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-purple-400">
          Latest result
        </p>
        <span className="font-mono text-[9px] uppercase tracking-wider text-text-muted">
          Round {latest.round}
        </span>
      </header>

      <div className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_9rem]">
        <div className="min-w-0">
          <h3 className="text-base font-bold tracking-tight text-text-primary">
            {latest.event_name}
          </h3>
          <Link
            href={circuitHref(latest.circuit_id) ?? "/circuits"}
            className="font-mono text-[10px] uppercase tracking-wider text-text-muted transition-colors hover:text-purple-300"
          >
            {latest.circuit_location}, {latest.circuit_country}
          </Link>

          <ol className="mt-3 grid gap-1.5">
            {latest.podium.map((driver, i) => {
              const extra = byCode.get(driver.driver_code);
              const teamColor = driver.team_color
                ? `#${driver.team_color.replace("#", "")}`
                : undefined;
              return (
                <li
                  key={driver.driver_code}
                  className="grid grid-cols-[1rem_auto_minmax(0,1fr)_auto] items-center gap-2.5"
                >
                  <span className="font-mono text-[11px] font-bold text-text-tertiary">
                    {i + 1}
                  </span>
                  <span
                    className="relative h-8 w-8 overflow-hidden rounded-full border-2 bg-bg-secondary"
                    style={{
                      borderColor: teamColor ?? "var(--border-secondary)",
                    }}
                  >
                    {isValidHeadshotUrl(driver.headshot_url) ? (
                      <Image
                        src={driver.headshot_url as string}
                        alt=""
                        fill
                        sizes="32px"
                        className="scale-125 object-cover object-[50%_10%]"
                      />
                    ) : (
                      <span className="grid h-full w-full place-items-center font-mono text-[9px] text-text-muted">
                        {driver.driver_code}
                      </span>
                    )}
                  </span>
                  <span className="min-w-0">
                    <Link
                      href={driverHref(driver) ?? "/drivers"}
                      className="block truncate text-sm font-bold tracking-tight transition-opacity hover:opacity-80"
                      style={{ color: teamColor }}
                    >
                      {driver.full_name}
                    </Link>
                    <span className="block truncate text-[10px] text-text-muted">
                      {driver.team_name}
                      {extra?.grid_position
                        ? ` · started P${extra.grid_position}`
                        : ""}
                    </span>
                  </span>
                  <span className="text-right font-mono text-[11px] tabular-nums text-text-secondary">
                    {i === 0
                      ? raceTime(driver.time_seconds)
                      : `+${(driver.time_seconds ?? 0).toFixed(3)}`}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="flex flex-col items-center justify-between gap-2">
          <TrackOutline
            polyline={polyline}
            rotation={rotation}
            className="h-24 w-full text-text-tertiary"
          />
          <span className="font-mono text-[9px] uppercase tracking-wider text-text-muted">
            {latest.circuit_name}
          </span>
        </div>
      </div>

      <dl className="grid grid-cols-3 border-t border-border-primary">
        {/* The race endpoint flags who set the fastest lap but not its time,
            so this names the driver rather than inventing a number. */}
        <Fact
          label="Fastest lap"
          value={fastest?.driver.driver_code ?? "—"}
          sub="of the race"
        />
        <Fact
          label="Won from"
          value={winnerGrid ? `P${winnerGrid}` : "—"}
          sub="on the grid"
          bordered
        />
        <Fact
          label="Classified"
          value={detail.length ? `${finishers}/${detail.length}` : "—"}
          sub="finished"
          bordered
        />
      </dl>

      <Link
        href="/results"
        className="block border-t border-border-primary px-4 py-2.5 text-center font-mono text-[10px] font-bold uppercase tracking-widest text-purple-400 transition-colors hover:bg-purple-500/10"
      >
        Full classification →
      </Link>
    </section>
  );
}

function Fact({
  label,
  value,
  sub,
  bordered,
}: {
  label: string;
  value: string;
  sub?: string;
  bordered?: boolean;
}) {
  return (
    <div
      className={`px-4 py-2.5 ${bordered ? "border-l border-border-primary" : ""}`}
    >
      <dt className="font-mono text-[9px] uppercase tracking-widest text-text-muted">
        {label}
      </dt>
      <dd className="font-mono text-sm font-semibold tabular-nums text-text-primary">
        {value}
      </dd>
      {sub && <dd className="font-mono text-[9px] text-text-muted">{sub}</dd>}
    </div>
  );
}
