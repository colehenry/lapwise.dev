"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildRaceClock,
  type ClockState,
  type RaceClock,
} from "@/lib/raceClock";
import type { LapTimesResponse } from "@/lib/types";

/** 15x is the default: fast enough that cars visibly move, slow enough that a
 *  lap still reads as a lap. */
export const PLAYBACK_RATES = [5, 15, 60] as const;
const DEFAULT_RATE = 15;

type Options = { autoPlay?: boolean };

export type RaceClockController = {
  clock: RaceClock | null;
  state: ClockState | null;
  playing: boolean;
  rate: number;
  duration: number;
  toggle: () => void;
  seek: (time: number) => void;
  setRate: (rate: number) => void;
};

/**
 * Runs one integrator and publishes a single state object, so every panel on
 * the page is guaranteed to be showing the same instant of the race.
 */
export function useRaceClock(
  lapTimes: LapTimesResponse | undefined,
  { autoPlay = true }: Options = {},
): RaceClockController {
  const clock = useMemo(
    () => (lapTimes ? buildRaceClock(lapTimes) : null),
    [lapTimes],
  );

  const [state, setState] = useState<ClockState | null>(null);
  const [playing, setPlaying] = useState(autoPlay);
  const [rate, setRate] = useState<number>(DEFAULT_RATE);

  const timeRef = useRef(0);
  const rateRef = useRef(rate);
  const playingRef = useRef(playing);

  rateRef.current = rate;
  playingRef.current = playing;

  // Honour the OS setting rather than animating regardless.
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (query.matches) setPlaying(false);
  }, []);

  useEffect(() => {
    if (!clock) {
      setState(null);
      return;
    }
    timeRef.current = 0;
    setState(clock.stateAt(0));
  }, [clock]);

  useEffect(() => {
    if (!clock) return;

    let raf = 0;
    let last = performance.now();
    let accumulator = 0;

    const frame = (now: number) => {
      const delta = Math.min(0.25, (now - last) / 1000);
      last = now;

      if (playingRef.current) {
        timeRef.current += delta * rateRef.current;
        if (timeRef.current > clock.duration) timeRef.current = 0;
        accumulator += delta;
        // 30fps of state churn is plenty; the canvas still paints every frame.
        if (accumulator > 1 / 30) {
          accumulator = 0;
          setState(clock.stateAt(timeRef.current));
        }
      }
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [clock]);

  return {
    clock,
    state,
    playing,
    rate,
    duration: clock?.duration ?? 0,
    toggle: () => setPlaying((p) => !p),
    seek: (time: number) => {
      if (!clock) return;
      timeRef.current = Math.max(0, Math.min(clock.duration, time));
      setState(clock.stateAt(timeRef.current));
    },
    setRate,
  };
}
