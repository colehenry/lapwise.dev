"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ConsoleReplay } from "@/lib/queries/consoleReplay";
import {
  buildFrame,
  type ClockFrame,
  frameSignature,
  openingTime,
  skipStoppages,
} from "@/lib/raceClockMath";

export const PLAYBACK_RATES = [1, 3, 10, 30] as const;
const DEFAULT_RATE = 10;

/**
 * Positions are written every animation frame, because a car drawn at 30 Hz on
 * a 60 Hz display moves in visible steps. React still re-renders only when
 * `frameSignature` changes, so the state churn stays where it was.
 */

/** A tab restored after a minute must not integrate the minute it missed. */
const MAX_DELTA = 0.25;

export type ClockSubscriber = (frame: ClockFrame) => void;

export type RaceClockController = {
  /** Re-renders only when the order, the lap, the flag or the feed changes. */
  frame: ClockFrame | null;
  /** Every tick, for the writes that go through refs. */
  subscribe: (subscriber: ClockSubscriber) => () => void;
  playing: boolean;
  rate: number;
  reducedMotion: boolean;
  toggle: () => void;
  setRate: (rate: number) => void;
  /** Attach to the console; playback stops when it leaves the viewport. */
  viewportRef: React.RefObject<HTMLDivElement | null>;
};

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * One integrator for the whole page. Every panel reads the frame it publishes,
 * so two panels can never disagree about the instant being shown.
 */
export function useRaceClock(
  replay: ConsoleReplay | undefined,
): RaceClockController {
  const [frame, setFrame] = useState<ClockFrame | null>(null);
  const [playing, setPlaying] = useState(true);
  const [rate, setRate] = useState<number>(DEFAULT_RATE);
  const [reducedMotion, setReducedMotion] = useState(false);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const subscribersRef = useRef(new Set<ClockSubscriber>());
  const latestRef = useRef<ClockFrame | null>(null);
  const signatureRef = useRef("");
  const timeRef = useRef(0);
  const rateRef = useRef(rate);
  const playingRef = useRef(playing);
  const onScreenRef = useRef(true);
  const tabVisibleRef = useRef(true);

  rateRef.current = rate;
  playingRef.current = playing;

  const start = useMemo(() => (replay ? openingTime(replay) : 0), [replay]);

  const publish = useCallback((next: ClockFrame) => {
    latestRef.current = next;
    for (const subscriber of subscribersRef.current) subscriber(next);
    const signature = frameSignature(next);
    if (signature !== signatureRef.current) {
      signatureRef.current = signature;
      setFrame(next);
    }
  }, []);

  const subscribe = useCallback((subscriber: ClockSubscriber) => {
    subscribersRef.current.add(subscriber);
    if (latestRef.current) subscriber(latestRef.current);
    return () => {
      subscribersRef.current.delete(subscriber);
    };
  }, []);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    const onVisibility = () => {
      tabVisibleRef.current = document.visibilityState === "visible";
    };
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    const target = viewportRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        onScreenRef.current = entry.isIntersecting;
      },
      { rootMargin: "120px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!replay) {
      latestRef.current = null;
      signatureRef.current = "";
      setFrame(null);
      return;
    }

    timeRef.current = start;
    const first = buildFrame(replay, start);
    if (first) publish(first);

    /* Reduced motion renders the opening frame and never animates. */
    if (prefersReducedMotion()) return;

    let raf = 0;
    let last = performance.now();

    const step = (now: number) => {
      raf = requestAnimationFrame(step);
      const delta = Math.min(MAX_DELTA, (now - last) / 1000);
      last = now;

      const running =
        playingRef.current && onScreenRef.current && tabVisibleRef.current;
      if (!running) return;

      let time = timeRef.current + delta * rateRef.current;
      time = skipStoppages(time, replay.skips);
      if (time > replay.t_end) time = start;
      timeRef.current = time;

      const next = buildFrame(replay, time);
      if (next) publish(next);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [replay, start, publish]);

  return {
    frame,
    subscribe,
    playing,
    rate,
    reducedMotion,
    toggle: () => setPlaying((value) => !value),
    setRate,
    viewportRef,
  };
}
