"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { isValidHeadshotUrl } from "@/lib/api";
import type { ClockState, RaceClock } from "@/lib/raceClock";
import type { DriverStanding, ReplayTrack } from "@/lib/types";
import AskDemo from "./AskDemo";

type Props = {
  clock: RaceClock | null;
  state: ClockState | null;
  track: ReplayTrack | undefined;
  standings: DriverStanding[];
  eventName: string;
  seasons: number;
  firstSeason: number;
  lastSeason: number;
};

const COMPOUND_COLORS: Record<string, string> = {
  SOFT: "#e8002d",
  MEDIUM: "#ffd700",
  HARD: "#e8e8ea",
  INTERMEDIATE: "#39b54a",
  WET: "#3399ff",
};

/**
 * The rail answers "what else is here" by showing it rather than describing it:
 * a moving replay map, Clutch answering a real question, the strategy picture,
 * and the faces in the archive.
 */
export default function CapabilityRail({
  clock,
  state,
  track,
  standings,
  eventName,
  seasons,
  firstSeason,
  lastSeason,
}: Props) {
  return (
    <div className="grid content-start gap-3">
      <Tile href="/replay" kicker="Replay" title="Watch any race back">
        <MiniReplay track={track} state={state} />
      </Tile>

      <Tile href="/ask" kicker="Ask" title="Question in, answer out">
        <AskDemo clock={clock} eventName={eventName} compact />
      </Tile>

      <Tile
        href="/results"
        kicker="Race Weekend Hub"
        title="Every session, taken apart"
      >
        <MiniStrategy clock={clock} />
      </Tile>

      <Tile href="/drivers" kicker="Archive" title="Drivers, teams, circuits">
        <div className="grid w-full gap-2">
          <div className="flex">
            {standings.slice(0, 7).map((driver) => (
              <span
                key={driver.driver_code}
                className="relative -mr-2 h-7 w-7 overflow-hidden rounded-full border-[1.5px] bg-bg-secondary"
                style={{
                  borderColor: driver.team_color
                    ? `#${driver.team_color.replace("#", "")}`
                    : "var(--border-secondary)",
                }}
              >
                {isValidHeadshotUrl(driver.headshot_url) ? (
                  <Image
                    src={driver.headshot_url as string}
                    alt=""
                    fill
                    sizes="28px"
                    className="scale-125 object-cover object-[50%_12%]"
                  />
                ) : (
                  <span className="grid h-full w-full place-items-center font-mono text-[8px] text-text-muted">
                    {driver.driver_code}
                  </span>
                )}
              </span>
            ))}
          </div>
          <p className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold tracking-tight text-text-primary">
              {seasons}
            </span>
            <span className="font-mono text-[10px] text-text-muted">
              seasons · {firstSeason}–{lastSeason}
            </span>
          </p>
        </div>
      </Tile>
    </div>
  );
}

function Tile({
  href,
  kicker,
  title,
  children,
}: {
  href: string;
  kicker: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col overflow-hidden rounded-sm border border-border-primary bg-bg-tertiary transition-all duration-200 hover:-translate-y-0.5 hover:border-purple-500/70"
    >
      <div className="grid min-h-[5.5rem] place-items-center border-b border-border-primary bg-bg-secondary/40 p-3">
        {children}
      </div>
      <div className="grid grid-cols-[1fr_auto] items-center gap-x-2 p-3">
        <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-purple-400">
          {kicker}
        </span>
        <span className="row-span-2 text-sm text-text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-purple-400">
          →
        </span>
        <span className="text-[13px] font-semibold tracking-tight text-text-primary">
          {title}
        </span>
      </div>
    </Link>
  );
}

/** The same race the hero is running, at thumbnail scale. */
function MiniReplay({
  track,
  state,
}: {
  track: ReplayTrack | undefined;
  state: ClockState | null;
}) {
  if (!track?.polyline?.length) {
    return (
      <div className="h-16 w-full animate-pulse rounded-sm bg-bg-elevated/50" />
    );
  }

  const xs = track.polyline.map((p) => p[0]);
  const ys = track.polyline.map((p) => p[1]);
  const x0 = Math.min(...xs);
  const y0 = Math.min(...ys);
  const w = Math.max(...xs) - x0 || 1;
  const h = Math.max(...ys) - y0 || 1;
  const scale = Math.min(96 / w, 56 / h);
  const ox = (100 - w * scale) / 2;
  const oy = (62 - h * scale) / 2;

  const total = track.polyline.length;

  return (
    <svg viewBox="0 0 100 62" className="h-16 w-full" aria-hidden="true">
      <title>Live replay preview</title>
      <path
        d={track.polyline
          .map(([x, y], i) => {
            const px = ((x - x0) * scale + ox).toFixed(2);
            const py = ((y - y0) * scale + oy).toFixed(2);
            return `${i ? "L" : "M"}${px} ${py}`;
          })
          .join("")
          .concat("Z")}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.4}
        className="text-text-tertiary"
        strokeLinejoin="round"
      />
      {(state?.rows ?? []).slice(0, 8).map((row) => {
        const idx = Math.floor((((row.progress % 1) + 1) % 1) * total) % total;
        const [x, y] = track.polyline[idx];
        return (
          <circle
            key={row.car.code}
            cx={(x - x0) * scale + ox}
            cy={(y - y0) * scale + oy}
            r={1.7}
            fill={
              row.car.color ? `#${row.car.color.replace("#", "")}` : "#8a8a94"
            }
          />
        );
      })}
    </svg>
  );
}

/** Real stint bars for the top runners — the strategy picture in miniature. */
function MiniStrategy({ clock }: { clock: RaceClock | null }) {
  if (!clock) {
    return (
      <div className="h-16 w-full animate-pulse rounded-sm bg-bg-elevated/50" />
    );
  }

  const cars = [...clock.cars]
    .sort((a, b) => (a.finalPosition ?? 99) - (b.finalPosition ?? 99))
    .slice(0, 6);
  const rowHeight = 60 / cars.length;

  return (
    <svg
      viewBox="0 0 100 60"
      preserveAspectRatio="none"
      className="h-16 w-full"
      aria-hidden="true"
    >
      <title>Tyre strategy preview</title>
      {cars.map((car, i) => {
        const stints: {
          start: number;
          end: number;
          compound: string | null;
        }[] = [];
        for (const lap of car.laps) {
          const last = stints[stints.length - 1];
          if (!last || last.compound !== lap.compound) {
            stints.push({
              start: lap.lap_number,
              end: lap.lap_number,
              compound: lap.compound,
            });
          } else {
            last.end = lap.lap_number;
          }
        }
        return stints.map((stint) => (
          <rect
            key={`${car.code}-${stint.start}`}
            x={((stint.start - 1) / clock.totalLaps) * 100}
            y={i * rowHeight + 0.8}
            width={Math.max(
              0.8,
              ((stint.end - stint.start + 1) / clock.totalLaps) * 100,
            )}
            height={rowHeight - 1.6}
            fill={
              COMPOUND_COLORS[String(stint.compound ?? "").toUpperCase()] ??
              "#3a3a45"
            }
            fillOpacity={0.9}
          />
        ));
      })}
    </svg>
  );
}
