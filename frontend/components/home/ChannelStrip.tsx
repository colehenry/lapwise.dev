"use client";

import { useEffect, useMemo, useRef } from "react";
import type { RaceClockController } from "@/hooks/useRaceClock";
import type { DriverTelemetry } from "@/lib/queries/consoleTelemetry";
import { PanelLabel } from "./ConsolePanel";

const WIDTH = 1000;
/** Each lane draws into its own box, so the two are always the same height. */
const LANE = 100;
/* The trace sits inside the lane rather than filling it. At full height every
   corner read as a cliff; the headroom calms it without shrinking the row. */
const TRACE_TOP = 20;
const TRACE_BOTTOM = 92;
const TRACE_RANGE = TRACE_BOTTOM - TRACE_TOP;

type Channel = {
  line: SVGPolylineElement | null;
  fill: SVGPolygonElement | null;
};

function point(x: number, fraction: number): string {
  return `${x.toFixed(1)},${(TRACE_BOTTOM - fraction * TRACE_RANGE).toFixed(1)}`;
}

/** Closes a trace down to its baseline so it reads as a filled channel. */
function area(points: string[]): string {
  if (points.length < 2) return "";
  const first = points[0].split(",")[0];
  const last = points[points.length - 1].split(",")[0];
  return `${first},${TRACE_BOTTOM} ${points.join(" ")} ${last},${TRACE_BOTTOM}`;
}

function lapSlice(
  telemetry: DriverTelemetry,
  lap: number,
): { from: number; to: number } | null {
  const starts = telemetry.lapStarts;
  const from = starts[lap - 1];
  if (from == null || from < 0) return null;
  let to = telemetry.speed.length;
  for (let next = lap; next < starts.length; next++) {
    if (starts[next] >= 0) {
      to = starts[next];
      break;
    }
  }
  return to > from + 1 ? { from, to } : null;
}

function Lane({
  children,
  label,
}: {
  children: React.ReactNode;
  label: React.ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 items-stretch gap-2">
      <div className="flex w-[58px] shrink-0 flex-col justify-center gap-0.5">
        {label}
      </div>
      <svg
        className="block min-h-0 w-full flex-1"
        viewBox={`0 0 ${WIDTH} ${LANE}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {children}
      </svg>
    </div>
  );
}

/**
 * The leader's lap as the car is driving it: speed in one lane, throttle and
 * brake sharing the next.
 *
 * The traces grow with the car rather than appearing whole at each lap
 * boundary, so they are written straight to the DOM on the clock's tick — at
 * thirty frames a second this cannot be React state.
 */
export default function ChannelStrip({
  telemetry,
  clock,
}: {
  telemetry: DriverTelemetry | null | undefined;
  clock: RaceClockController;
}) {
  const lap = clock.frame?.lap ?? 1;
  const { subscribe } = clock;

  const speedRef = useRef<Channel>({ line: null, fill: null });
  const throttleRef = useRef<Channel>({ line: null, fill: null });
  const brakeRef = useRef<Channel>({ line: null, fill: null });

  const chart = useMemo(() => {
    if (!telemetry) return null;
    const window = lapSlice(telemetry, lap);
    if (!window) return null;

    const { from, to } = window;
    const count = to - from;
    let peak = 1;
    for (let i = from; i < to; i++) peak = Math.max(peak, telemetry.speed[i]);

    const speed: string[] = [];
    const throttle: string[] = [];
    const brake: string[] = [];
    for (let i = from; i < to; i++) {
      const x = ((i - from) / (count - 1)) * WIDTH;
      speed.push(point(x, telemetry.speed[i] / peak));
      throttle.push(point(x, telemetry.throttle[i] / 100));
      brake.push(point(x, telemetry.brake[i]));
    }

    return { speed, throttle, brake, peak, count };
  }, [telemetry, lap]);

  const chartRef = useRef(chart);
  chartRef.current = chart;

  /* Subscribing before the polylines exist wrote into null refs, and a paused
     clock never publishes again — so the trace stayed empty. Waiting for the
     chart means `subscribe` replays the latest frame straight into it, and
     re-running each lap repaints from the new arrays. */
  const hasChart = chart !== null;

  useEffect(() => {
    if (!hasChart) return;
    let lastDrawn = -1;

    const paint = (channel: Channel, points: string[], upTo: number) => {
      const visible = points.slice(0, upTo);
      channel.line?.setAttribute("points", visible.join(" "));
      channel.fill?.setAttribute("points", area(visible));
    };

    return subscribe((frame) => {
      const current = chartRef.current;
      if (!current) return;
      const through = frame.leader.progress - Math.floor(frame.leader.progress);
      const upTo = Math.max(
        2,
        Math.min(current.count, Math.round(through * current.count)),
      );
      if (upTo === lastDrawn) return;
      lastDrawn = upTo;
      paint(speedRef.current, current.speed, upTo);
      paint(throttleRef.current, current.throttle, upTo);
      paint(brakeRef.current, current.brake, upTo);
    });
  }, [subscribe, hasChart, lap]);

  /* The frame is drawn whether or not the channels arrived, so the panel is the
     same height either way. */
  if (!chart) {
    return (
      <div className="grid min-h-0 flex-1 place-items-center rounded-[3px] border border-dashed border-line-soft">
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-faint">
          No telemetry ingested for this round
        </span>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-0 flex-1 flex-col gap-4"
      role="img"
      aria-label={`Speed, throttle and brake through lap ${lap}, peaking at ${Math.round(chart.peak)} kilometres per hour`}
    >
      <Lane
        label={
          <>
            <PanelLabel>Speed</PanelLabel>
            <span className="font-mono text-[10px] tabular-nums text-ink-soft">
              {Math.round(chart.peak)} km/h
            </span>
          </>
        }
      >
        <polygon
          ref={(node) => {
            speedRef.current.fill = node;
          }}
          fill="var(--chart-neutral-stroke)"
          opacity={0.12}
        />
        <polyline
          ref={(node) => {
            speedRef.current.line = node;
          }}
          fill="none"
          stroke="var(--chart-neutral-stroke)"
          strokeWidth={1.4}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </Lane>

      <Lane
        label={
          <>
            <span
              className="font-mono text-[9.5px] uppercase tracking-[0.12em]"
              style={{ color: "var(--delta-faster)" }}
            >
              Throttle
            </span>
            <span
              className="font-mono text-[9.5px] uppercase tracking-[0.12em]"
              style={{ color: "var(--status-red)" }}
            >
              Brake
            </span>
          </>
        }
      >
        <polygon
          ref={(node) => {
            throttleRef.current.fill = node;
          }}
          fill="var(--delta-faster)"
          opacity={0.24}
        />
        <polyline
          ref={(node) => {
            throttleRef.current.line = node;
          }}
          fill="none"
          stroke="var(--delta-faster)"
          strokeWidth={1.3}
          vectorEffect="non-scaling-stroke"
        />
        <polygon
          ref={(node) => {
            brakeRef.current.fill = node;
          }}
          fill="var(--status-red)"
          opacity={0.28}
        />
        <polyline
          ref={(node) => {
            brakeRef.current.line = node;
          }}
          fill="none"
          stroke="var(--status-red)"
          strokeWidth={1.3}
          vectorEffect="non-scaling-stroke"
        />
      </Lane>
    </div>
  );
}
