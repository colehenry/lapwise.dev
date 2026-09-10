"use client";

import { useEffect, useMemo, useRef } from "react";
import type { RaceClockController } from "@/hooks/useRaceClock";
import { compoundFromInitial, getCompoundColor } from "@/lib/palette";
import type { ConsoleCar } from "@/lib/queries/consoleReplay";

const WIDTH = 1000;
const HEIGHT = 100;

/**
 * Pit, safety-car and red-flag laps run to minutes. Holding them in the domain
 * would flatten every racing lap into one line, so the scale holds the racing
 * laps and an off-scale lap breaks the trace and gets a marker at the ceiling.
 */
const RACING_QUANTILE = 0.62;
const CEILING_HEADROOM = 1.04;
const FLOOR_HEADROOM = 0.995;

type Domain = { low: number; high: number };

function domainFor(times: (number | null)[]): Domain | null {
  const clean = times
    .filter((value): value is number => value != null && Number.isFinite(value))
    .sort((a, b) => a - b);
  if (clean.length === 0) return null;
  return {
    low: clean[0] * FLOOR_HEADROOM,
    high: clean[Math.floor(clean.length * RACING_QUANTILE)] * CEILING_HEADROOM,
  };
}

export default function LapTimeChart({
  car,
  clock,
}: {
  car: ConsoleCar;
  clock: RaceClockController;
}) {
  const playheadRef = useRef<SVGLineElement | null>(null);
  const { subscribe } = clock;

  const chart = useMemo(() => {
    const times = car.laps.map((lap) => lap.t);
    const domain = domainFor(times);
    if (!domain) return null;

    const span = Math.max(0.001, domain.high - domain.low);
    const x = (index: number) =>
      (index / Math.max(1, times.length - 1)) * WIDTH;
    const y = (value: number) =>
      HEIGHT - ((value - domain.low) / span) * (HEIGHT - 8) - 4;

    const runs: string[][] = [];
    let run: string[] = [];
    times.forEach((value, index) => {
      if (value == null || value > domain.high) {
        if (run.length > 1) runs.push(run);
        run = [];
        return;
      }
      run.push(`${x(index).toFixed(1)},${y(value).toFixed(1)}`);
    });
    if (run.length > 1) runs.push(run);

    const offScale = times
      .map((value, index) =>
        value != null && value > domain.high ? x(index) : null,
      )
      .filter((value): value is number => value != null);

    const best = Math.min(
      ...times.filter((value): value is number => value != null),
    );

    return {
      runs,
      offScale,
      bestY: y(best),
      domain,
      compounds: [...new Set(car.laps.map((lap) => lap.c))],
    };
  }, [car]);

  useEffect(() => {
    if (!chart) return;
    const lapCount = Math.max(1, car.laps.length - 1);
    return subscribe((frame) => {
      const playhead = playheadRef.current;
      if (!playhead) return;
      const progress =
        frame.leader.car === car ? frame.leader.progress : frame.lap - 1;
      const x = ((Math.min(progress, lapCount) / lapCount) * WIDTH).toFixed(1);
      playhead.setAttribute("x1", x);
      playhead.setAttribute("x2", x);
    });
  }, [subscribe, chart, car]);

  if (!chart) {
    return (
      <p className="m-0 text-[12.5px] text-ink-soft">
        No lap times were recorded for this car.
      </p>
    );
  }

  return (
    <>
      <div className="relative min-h-0 flex-1">
        <svg
          className="absolute inset-0 block h-full w-full"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`Lap times for ${car.full_name}, ${chart.domain.low.toFixed(1)} to ${chart.domain.high.toFixed(1)} seconds`}
        >
          <title>Lap time by lap</title>
          <line
            x1={0}
            y1={chart.bestY}
            x2={WIDTH}
            y2={chart.bestY}
            stroke="var(--status-fastest)"
            strokeWidth={1}
            strokeDasharray="5 5"
            opacity={0.55}
            vectorEffect="non-scaling-stroke"
          />
          {chart.runs.map((run) => (
            <polyline
              key={run[0]}
              points={run.join(" ")}
              fill="none"
              stroke="var(--chart-neutral-stroke)"
              strokeWidth={1.4}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {chart.offScale.map((x) => (
            <circle
              key={x}
              cx={x}
              cy={4}
              r={2.4}
              fill="var(--status-pit)"
              opacity={0.8}
            />
          ))}
          <line
            ref={playheadRef}
            x1={0}
            y1={0}
            x2={0}
            y2={HEIGHT}
            stroke="var(--ink-soft)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>

      <div className="mt-[7px] flex h-[5px] flex-none gap-px overflow-hidden rounded-[2px]">
        {car.laps.map((lap, index) => (
          <i
            key={`${car.driver_code}-${index}-${lap.c}`}
            className="block h-full flex-1"
            style={{
              background: getCompoundColor(compoundFromInitial(lap.c)),
              boxShadow: lap.pit
                ? "inset 0 0 0 1px var(--status-pit)"
                : undefined,
            }}
          />
        ))}
      </div>

      <div className="mt-1.5 flex flex-none items-center gap-[11px] overflow-hidden font-mono text-[8px] uppercase tracking-[0.1em] text-ink-faint">
        {chart.compounds.map((code) => (
          <span
            key={code}
            className="flex items-center gap-1 whitespace-nowrap"
          >
            <i
              className="block h-[3px] w-[7px] rounded-[1px]"
              style={{
                background: getCompoundColor(compoundFromInitial(code)),
              }}
            />
            {code}
          </span>
        ))}
        <span className="flex items-center gap-1 whitespace-nowrap">
          <i
            className="block h-[3px] w-[7px] rounded-[1px]"
            style={{ background: "var(--status-pit)" }}
          />
          Off scale
        </span>
        <span className="ml-auto whitespace-nowrap tabular-nums">
          {chart.domain.low.toFixed(1)}–{chart.domain.high.toFixed(1)}s
        </span>
      </div>
    </>
  );
}
