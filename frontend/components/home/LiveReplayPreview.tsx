"use client";

import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Skeleton from "@/components/ui/Skeleton";
import { latestReplayPreviewQuery } from "@/lib/queries/replay";
import {
  computeArcLengths,
  findLapStartFrame,
} from "@/lib/replayPreviewGeometry";
import type { ReplayData } from "@/lib/types";

// The canvas player and its panel load with the frame data, not with home.
const TrackCanvas = dynamic(
  () => import("@/app/replay/components/TrackCanvas"),
  { ssr: false },
);
const MiniLeaderboard = dynamic(
  () =>
    import("./ReplayPreviewPanels").then((module) => module.MiniLeaderboard),
  { ssr: false },
);

// The artifact carries 2 frames per second, so 10x playback steps 20 samples
// per second — the same on-screen cadence the full 10fps blob gave at 2x.
const PLAYBACK_SPEED = 10;
const START_LAP = 10; // Skip formation / early laps for more action

function ReplayIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <title>Live Replay</title>
      <path
        fillRule="evenodd"
        d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export default function LiveReplayPreview() {
  // The artifact resolves the latest race and its frames in one request, and
  // is small enough to load and play without waiting for user intent.
  const { data: replayData, isLoading } = useQuery(latestReplayPreviewQuery());

  const activeSeason = replayData?.metadata.season ?? null;
  const activeRound = replayData?.metadata.round ?? null;
  const eventName = replayData?.metadata.event_name ?? null;

  const dataRef = useRef<ReplayData | null>(null);
  const [frameIndex, setFrameIndex] = useState(0);
  const [documentHidden, setDocumentHidden] = useState(false);
  const animFrameRef = useRef<number>(0);
  const lastTimestampRef = useRef<number>(0);
  const fractionalFrameRef = useRef<number>(0);
  const frameIndexRef = useRef<number>(0);

  // Precompute arc lengths for leaderboard gap calculation
  const arcLengths = useMemo(() => {
    if (!replayData) return [];
    return computeArcLengths(replayData.track.polyline);
  }, [replayData]);

  const circuitLengthM = replayData?.metadata.circuit_length_m ?? 5278; // Melbourne fallback

  // Set data ref and start frame when data loads
  useEffect(() => {
    if (replayData) {
      dataRef.current = replayData;
      const startFrame = findLapStartFrame(replayData.frames, START_LAP);
      fractionalFrameRef.current = startFrame;
      frameIndexRef.current = startFrame;
      setFrameIndex(startFrame);
    }
  }, [replayData]);

  // Keep frame ref in sync
  useEffect(() => {
    frameIndexRef.current = frameIndex;
  }, [frameIndex]);

  useEffect(() => {
    const sync = () => setDocumentHidden(document.hidden);
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  // Animation loop — auto-plays at PLAYBACK_SPEED, loops back to START_LAP
  const animate = useCallback((timestamp: number) => {
    const data = dataRef.current;
    if (!data) return;

    if (lastTimestampRef.current === 0) {
      lastTimestampRef.current = timestamp;
      animFrameRef.current = requestAnimationFrame(animate);
      return;
    }

    const elapsed = timestamp - lastTimestampRef.current;
    lastTimestampRef.current = timestamp;

    const frameDuration = 1000 / data.metadata.fps;
    fractionalFrameRef.current += PLAYBACK_SPEED * (elapsed / frameDuration);

    let newIndex = Math.floor(fractionalFrameRef.current);

    // Loop back when reaching the end
    if (newIndex >= data.metadata.total_frames) {
      const startFrame = findLapStartFrame(data.frames, START_LAP);
      fractionalFrameRef.current = startFrame;
      newIndex = startFrame;
    }

    if (newIndex !== frameIndexRef.current) {
      setFrameIndex(newIndex);
    }

    animFrameRef.current = requestAnimationFrame(animate);
  }, []);

  // Playback runs only while data is loaded and the tab is visible
  useEffect(() => {
    if (!replayData || documentHidden) return;
    lastTimestampRef.current = 0;
    animFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [replayData, documentHidden, animate]);

  const frame = replayData?.frames[frameIndex];
  const currentLap = frame?.lap ?? 0;
  const totalLaps = replayData?.metadata.total_laps ?? 0;
  const playing = Boolean(replayData) && !documentHidden;

  const noOp = useCallback(() => {}, []);

  return (
    <section className="overflow-hidden border-b border-border-primary/40 bg-bg-primary px-6 py-10">
      <div className="mx-auto max-w-4xl">
        {/* Section label */}
        <div className="mb-5 flex items-center gap-3">
          <div className="h-2 w-2 animate-pulse rounded-full bg-purple-500" />
          <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-text-muted">
            Live Replay
          </span>
        </div>

        {/* Card */}
        <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] shadow-[0_16px_64px_-16px_rgba(0,0,0,0.6)]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-purple-500/20 bg-purple-500/10 text-purple-300">
                <ReplayIcon />
              </div>
              <div>
                <span className="text-sm font-bold text-text-primary">
                  Live Replay
                </span>
                {eventName && activeSeason !== null && (
                  <span className="ml-2 text-xs text-text-muted">
                    {eventName} {activeSeason}
                  </span>
                )}
              </div>
            </div>
            <Link
              href="/replay"
              className="flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.1em] text-text-muted transition-all hover:border-purple-500/30 hover:bg-purple-500/10 hover:text-purple-300"
            >
              Try it
              <svg
                className="h-3 w-3"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <title>Open</title>
                <path
                  fillRule="evenodd"
                  d="M5.22 14.78a.75.75 0 001.06 0l7.22-7.22v5.69a.75.75 0 001.5 0v-7.5a.75.75 0 00-.75-.75h-7.5a.75.75 0 000 1.5h5.69l-7.22 7.22a.75.75 0 000 1.06z"
                  clipRule="evenodd"
                />
              </svg>
            </Link>
          </div>

          {/* Body */}
          <div className="px-5 py-5">
            {!replayData && !isLoading && (
              <div
                className="flex flex-col items-center justify-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] text-center"
                style={{ height: 380 }}
              >
                <p className="text-sm text-text-secondary">
                  Replay preview is unavailable right now.
                </p>
                <Link
                  href="/replay"
                  className="font-mono text-[10px] uppercase tracking-[0.1em] text-purple-400 transition-colors hover:text-purple-300"
                >
                  Open the replay player
                </Link>
              </div>
            )}

            {isLoading && (
              <div className="space-y-3">
                <Skeleton variant="rectangular" height="380px" />
                <div className="flex gap-3">
                  <Skeleton width="60%" height="16px" />
                  <Skeleton width="30%" height="16px" />
                </div>
              </div>
            )}

            {replayData && frame && (
              <div className="space-y-3">
                <div className="flex flex-col lg:flex-row gap-4">
                  {/* Track canvas */}
                  <div className="flex-1 min-w-0 rounded-xl border border-white/[0.06] bg-black overflow-hidden">
                    <div
                      className="relative flex items-center justify-center"
                      style={{ height: 380 }}
                    >
                      <TrackCanvas
                        track={replayData.track}
                        drivers={replayData.drivers}
                        frame={frame}
                        selectedDriver={null}
                        showCorners={false}
                        onSelectDriver={noOp}
                      />
                    </div>
                  </div>

                  {/* Mini leaderboard */}
                  <div className="lg:w-48 shrink-0 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                    <p className="mb-2 text-[9px] font-mono uppercase tracking-[0.1em] text-text-muted">
                      Positions
                    </p>
                    <MiniLeaderboard
                      frame={frame}
                      drivers={replayData.drivers}
                      polyline={replayData.track.polyline}
                      arcLengths={arcLengths}
                      circuitLengthM={circuitLengthM}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bottom bar — playback info + CTA */}
          <div className="flex items-center justify-between border-t border-white/[0.06] px-5 py-3">
            <div className="flex items-center gap-4 text-xs text-text-muted">
              {/* Play indicator */}
              <div className="flex items-center gap-1.5">
                <div
                  className={`h-2 w-2 rounded-full ${playing ? "animate-pulse bg-green-500" : "bg-text-muted"}`}
                />
                <span className="font-mono text-[10px] uppercase tracking-wide">
                  {playing ? "Playing" : "Paused"}
                </span>
              </div>

              {/* Lap counter */}
              {replayData && (
                <span className="font-mono text-[10px] tabular-nums">
                  Lap {currentLap}/{totalLaps}
                </span>
              )}

              {/* Speed badge */}
              <span className="rounded-md border border-white/[0.06] bg-white/[0.03] px-1.5 py-0.5 font-mono text-[10px] font-bold text-text-secondary">
                {PLAYBACK_SPEED}x
              </span>
            </div>

            <Link
              href={
                activeSeason !== null && activeRound !== null
                  ? `/replay?season=${activeSeason}&round=${activeRound}`
                  : "/replay"
              }
              className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.1em] text-purple-400 transition-colors hover:text-purple-300"
            >
              Watch full replay
              <svg
                className="h-3 w-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <title>Arrow right</title>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7l5 5m0 0l-5 5m5-5H6"
                />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
