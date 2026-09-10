"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";
import type { RaceClockController } from "@/hooks/useRaceClock";
import { PLAYBACK_RATES } from "@/hooks/useRaceClock";
import { useTeamTint } from "@/hooks/useTeamTint";
import { sessionClock, utcDate } from "@/lib/consoleFormat";
import { fitTrack, trackPath } from "@/lib/consoleTrackGeometry";
import type { ConsoleReplay } from "@/lib/queries/consoleReplay";
import { pointAt } from "@/lib/raceClockMath";
import { statusColor } from "./consoleStatus";
import MapRaceFeed from "./MapRaceFeed";
import MapRunningOrder from "./MapRunningOrder";
import MapTimeline from "./MapTimeline";

/** How much of a lap the leading arc covers in the reduced map. */
const TRACE_ARC = 0.16;

/** Only the leader is captioned; three codes at once crowded the same corner. */
const LABELLED_PLACES = 1;

/** Left gutter added to the viewBox, so the circuit clears the overlay. */
const OVERLAY_GUTTER = 0.2;

/** "Italian Grand Prix" is the race; "Italian GP" fits the corner it sits in. */
function shortEvent(name: string): string {
  return name.replace("Grand Prix", "GP");
}

type RaceMapProps = {
  replay: ConsoleReplay;
  polyline: number[][];
  round: number;
  /** The newer round whose telemetry has not published yet. */
  newerRound: number | null;
  season: number | null;
  clock: RaceClockController;
  /** Below `md` the map animates and captions itself, and nothing else. */
  reduced?: boolean;
};

export default function RaceMap({
  replay,
  polyline,
  round,
  newerRound,
  season,
  clock,
  reduced = false,
}: RaceMapProps) {
  const tint = useTeamTint();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const carsRef = useRef(new Map<string, SVGCircleElement>());
  const labelsRef = useRef(new Map<string, SVGTextElement>());
  const traceRef = useRef<SVGPathElement | null>(null);
  const lapRef = useRef<HTMLSpanElement | null>(null);
  const elapsedRef = useRef<HTMLSpanElement | null>(null);

  const track = useMemo(() => fitTrack(polyline), [polyline]);

  const { subscribe, frame } = clock;

  /* Positions are written straight to the DOM: re-rendering these every tick
     would recreate the markers and the tooltip's photo with them. */
  useEffect(() => {
    if (!track) return;
    const trace = traceRef.current;
    /* jsdom implements no SVG geometry, so the trace simply does not travel. */
    const total =
      typeof trace?.getTotalLength === "function" ? trace.getTotalLength() : 0;

    return subscribe((next) => {
      next.order.forEach((entry, place) => {
        const marker = carsRef.current.get(entry.key);
        if (!marker) return;
        const point = pointAt(track.polyline, entry.progress);
        if (!point) return;
        marker.setAttribute("cx", point[0].toFixed(1));
        marker.setAttribute("cy", point[1].toFixed(1));
        marker.setAttribute(
          "r",
          (place === 0 ? track.unit * 1.35 : track.unit * 0.95).toFixed(2),
        );

        const label = labelsRef.current.get(entry.key);
        if (!label) return;
        const showing = place < LABELLED_PLACES;
        label.style.display = showing ? "" : "none";
        if (!showing) return;
        label.setAttribute("x", (point[0] + track.unit * 1.9).toFixed(1));
        label.setAttribute("y", (point[1] + track.unit * 0.9).toFixed(1));
      });

      if (trace && total > 0) {
        const lapFraction =
          next.leader.progress - Math.floor(next.leader.progress);
        trace.setAttribute(
          "stroke-dasharray",
          `${total * TRACE_ARC} ${total * (1 - TRACE_ARC)}`,
        );
        trace.setAttribute(
          "stroke-dashoffset",
          (-lapFraction * total).toFixed(1),
        );
      }

      if (lapRef.current) {
        lapRef.current.textContent = `LAP ${next.lap}/${replay.total_laps}`;
      }
      if (elapsedRef.current) {
        elapsedRef.current.textContent = sessionClock(next.elapsed);
      }
    });
  }, [subscribe, track, replay.total_laps]);

  if (!track) {
    return (
      <div className="flex h-full items-center justify-center px-4 text-[12.5px] text-ink-soft">
        The circuit map for {replay.circuit_name} is not available.
      </div>
    );
  }

  const path = trackPath(track.polyline);
  const status = frame?.status ?? null;

  return (
    <div
      ref={wrapRef}
      className="relative h-full min-h-0 w-full overflow-hidden rounded-[3px]"
      style={{
        background:
          "linear-gradient(160deg, var(--canvas-bg-start), var(--canvas-bg-end))",
      }}
    >
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox={`${(-track.width * OVERLAY_GUTTER).toFixed(1)} 0 ${(track.width * (1 + OVERLAY_GUTTER)).toFixed(1)} ${track.height.toFixed(1)}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`${replay.circuit_name} circuit map`}
      >
        <title>{replay.circuit_name}</title>
        <path
          d={path}
          fill="none"
          stroke="var(--canvas-track-glow)"
          strokeWidth={track.unit * 2.6}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <path
          d={path}
          fill="none"
          stroke="var(--canvas-track)"
          strokeWidth={track.unit * 0.28}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <path
          ref={traceRef}
          d={path}
          fill="none"
          stroke="var(--accent-bright)"
          strokeWidth={track.unit * 0.55}
          strokeLinecap="round"
          opacity={reduced ? 0.95 : 0}
        />
        {!reduced && (
          <g>
            {replay.cars.map((car) => (
              <circle
                key={car.driver_code ?? car.full_name}
                ref={(node) => {
                  const key = car.driver_code ?? car.full_name;
                  if (node) carsRef.current.set(key, node);
                  else carsRef.current.delete(key);
                }}
                r={track.unit * 0.95}
                cx={-100}
                cy={-100}
                fill={tint(car.team_color) ?? "var(--ink-soft)"}
                stroke="var(--canvas-bg-end)"
                strokeWidth={track.unit * 0.28}
              />
            ))}
            {replay.cars.map((car) => (
              <text
                key={`label-${car.driver_code ?? car.full_name}`}
                ref={(node) => {
                  const key = car.driver_code ?? car.full_name;
                  if (node) labelsRef.current.set(key, node);
                  else labelsRef.current.delete(key);
                }}
                style={{ display: "none" }}
                x={-100}
                y={-100}
                fontSize={track.unit * 2.6}
                fontWeight={700}
                className="font-mono"
                fill={tint(car.team_color) ?? "var(--ink-strong)"}
                stroke="var(--canvas-bg-end)"
                strokeWidth={track.unit * 0.5}
                paintOrder="stroke"
              >
                {car.driver_code ?? ""}
              </text>
            ))}
          </g>
        )}
      </svg>

      <TransportBar
        clock={clock}
        lapRef={lapRef}
        elapsedRef={elapsedRef}
        reduced={reduced}
      />
      <div className="pointer-events-none absolute left-3 top-3 flex w-[196px] flex-col gap-2">
        <div>
          <div className="flex items-center gap-2">
            <p className="m-0 truncate text-[15px] font-bold leading-tight tracking-[-0.02em] text-ink-strong">
              {shortEvent(replay.event_name)} Replay
            </p>
            {status && (
              <span
                className="flex flex-none items-center gap-[5px] rounded-sm border border-line-soft px-1.5 py-[2px] font-mono text-[8px] uppercase tracking-[0.12em] text-ink-base"
                style={{ background: "var(--glass-surface)" }}
              >
                <span
                  className="block h-[5px] w-[5px] rounded-full"
                  style={{ background: statusColor(status.code) }}
                />
                {status.label ?? status.code}
              </span>
            )}
          </div>
          <p className="m-0 mt-[3px] font-mono text-[9px] uppercase tracking-[0.14em] text-ink-faint">
            {replay.circuit_name} · {utcDate(replay.date)} · Round {round}
          </p>
          {newerRound !== null && season !== null && (
            <Link
              href={`/results/${season}/${newerRound}`}
              className="pointer-events-auto mt-1 inline-block font-mono text-[9px] uppercase tracking-[0.14em] text-accent-light underline-offset-2 hover:underline"
            >
              Round {newerRound} has no lap data yet
            </Link>
          )}
        </div>

        {!reduced && (
          <>
            <MapRunningOrder cars={replay.cars} clock={clock} />
            <MapRaceFeed replay={replay} clock={clock} />
          </>
        )}
      </div>

      {!reduced && <MapTimeline replay={replay} clock={clock} />}
    </div>
  );
}

function TransportBar({
  clock,
  lapRef,
  elapsedRef,
  reduced,
}: {
  clock: RaceClockController;
  lapRef: React.RefObject<HTMLSpanElement | null>;
  elapsedRef: React.RefObject<HTMLSpanElement | null>;
  reduced: boolean;
}) {
  return (
    <div
      className="absolute right-2.5 top-2.5 flex items-center gap-[7px] rounded-sm border border-line-soft px-[9px] py-[5px] font-mono text-[10px] text-ink-soft backdrop-blur-sm"
      style={{ background: "var(--glass-surface)" }}
    >
      <button
        type="button"
        onClick={clock.toggle}
        aria-label={clock.playing ? "Pause the replay" : "Play the replay"}
        className="rounded-[2px] px-[5px] py-px text-ink-soft transition-colors hover:text-ink-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-bright"
      >
        {clock.playing ? "❚❚" : "▶"}
      </button>
      <span ref={lapRef} className="tabular-nums" />
      <span ref={elapsedRef} className="tabular-nums text-ink-faint" />
      {!reduced && (
        <>
          <span aria-hidden="true" className="text-line-strong">
            |
          </span>
          {PLAYBACK_RATES.map((rate) => (
            <button
              key={rate}
              type="button"
              onClick={() => clock.setRate(rate)}
              aria-pressed={clock.rate === rate}
              className={`rounded-[2px] px-[5px] py-px transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-bright ${
                clock.rate === rate
                  ? "bg-accent text-ink-strong"
                  : "hover:text-ink-strong"
              }`}
            >
              {rate}×
            </button>
          ))}
        </>
      )}
    </div>
  );
}
