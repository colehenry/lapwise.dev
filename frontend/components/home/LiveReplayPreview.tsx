"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import TrackCanvas from "@/app/replay/components/TrackCanvas";
import Skeleton from "@/components/ui/Skeleton";
import {
  fetchAvailableReplays,
  fetchReplayData,
  fetchReplaySeasons,
  isValidHeadshotUrl,
} from "@/lib/api";
import { resolveToken } from "@/lib/palette";
import type { ReplayData, ReplayDriverFrame, ReplayFrame } from "@/lib/types";

const PLAYBACK_SPEED = 2;
const START_LAP = 10; // Skip formation / early laps for more action
const TOP_N = 10; // Drivers shown in mini leaderboard

/** Find the first frame index at or after a given lap number */
function findLapStartFrame(frames: ReplayFrame[], lap: number): number {
  for (let i = 0; i < frames.length; i++) {
    if (frames[i].lap >= lap) return i;
  }
  return 0;
}

/** Compute arc lengths along the track polyline for gap calculation */
function computeArcLengths(polyline: [number, number][]): number[] {
  const lengths = [0];
  for (let i = 1; i < polyline.length; i++) {
    const dx = polyline[i][0] - polyline[i - 1][0];
    const dy = polyline[i][1] - polyline[i - 1][1];
    lengths.push(lengths[i - 1] + Math.sqrt(dx * dx + dy * dy));
  }
  return lengths;
}

/** Find driver's progress along the track as a fraction [0, 1) */
function getTrackProgress(
  x: number,
  y: number,
  polyline: [number, number][],
  arcLengths: number[],
): number {
  const totalLength = arcLengths[arcLengths.length - 1];
  if (totalLength === 0) return 0;

  let bestDist = Number.POSITIVE_INFINITY;
  let bestArcLength = 0;

  for (let i = 0; i < polyline.length - 1; i++) {
    const ax = polyline[i][0];
    const ay = polyline[i][1];
    const bx = polyline[i + 1][0];
    const by = polyline[i + 1][1];

    const abx = bx - ax;
    const aby = by - ay;
    const apx = x - ax;
    const apy = y - ay;

    const segLen2 = abx * abx + aby * aby;
    let t = segLen2 > 0 ? (apx * abx + apy * aby) / segLen2 : 0;
    t = Math.max(0, Math.min(1, t));

    const px = ax + t * abx;
    const py = ay + t * aby;
    const dx = x - px;
    const dy = y - py;
    const dist = dx * dx + dy * dy;

    if (dist < bestDist) {
      bestDist = dist;
      const segLength = arcLengths[i + 1] - arcLengths[i];
      bestArcLength = arcLengths[i] + t * segLength;
    }
  }

  return bestArcLength / totalLength;
}

/** Sort drivers by authoritative race position (data[8]).
 *  Falls back to lap + track progress only when position is missing,
 *  since deriving order from x/y causes a one-frame flicker at the
 *  start/finish line when the position wraps before the lap ticks. */
function sortDriversByProgress(
  frame: ReplayFrame,
  polyline: [number, number][],
  arcLengths: number[],
): { code: string; data: ReplayDriverFrame }[] {
  const entries = Object.entries(frame.d).map(([code, data]) => ({
    code,
    data,
  }));

  return entries.sort((a, b) => {
    const lapA = a.data[7];
    const lapB = b.data[7];
    if (lapA <= 0 && lapB <= 0) return 0;
    if (lapA <= 0) return 1;
    if (lapB <= 0) return -1;

    const posA = a.data[8];
    const posB = b.data[8];
    if (posA > 0 && posB > 0) return posA - posB;

    // Fallback: lap + track fraction
    const progA =
      lapA + getTrackProgress(a.data[0], a.data[1], polyline, arcLengths);
    const progB =
      lapB + getTrackProgress(b.data[0], b.data[1], polyline, arcLengths);
    return progB - progA;
  });
}

/** Compute gap strings for sorted driver list */
function computeGaps(
  sorted: { code: string; data: ReplayDriverFrame }[],
  polyline: [number, number][],
  arcLengths: number[],
  circuitLengthM: number,
): (string | null)[] {
  if (sorted.length === 0) return [];
  const gaps: (string | null)[] = [null];

  const leaderLap = sorted[0].data[7];
  const leaderProgress = getTrackProgress(
    sorted[0].data[0],
    sorted[0].data[1],
    polyline,
    arcLengths,
  );
  const leaderSpeed = sorted[0].data[2];
  const speedMs = leaderSpeed > 0 ? (leaderSpeed * 1000) / 3600 : 50;

  for (let i = 1; i < sorted.length; i++) {
    const driverLap = sorted[i].data[7];
    if (driverLap <= 0) {
      gaps.push(null);
      continue;
    }
    const lapDiff = leaderLap - driverLap;
    if (lapDiff > 0) {
      gaps.push(`+${lapDiff} LAP${lapDiff > 1 ? "S" : ""}`);
      continue;
    }
    const driverProgress = getTrackProgress(
      sorted[i].data[0],
      sorted[i].data[1],
      polyline,
      arcLengths,
    );
    let progressDiff = leaderProgress - driverProgress;
    if (progressDiff < 0) progressDiff += 1;
    const distMeters = progressDiff * circuitLengthM;
    const gapSeconds = distMeters / speedMs;
    if (gapSeconds < 0.1 || gapSeconds > 120) {
      gaps.push(null);
    } else {
      gaps.push(`+${gapSeconds.toFixed(1)}`);
    }
  }
  return gaps;
}

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

function MiniLeaderboard({
  frame,
  drivers,
  polyline,
  arcLengths,
  circuitLengthM,
}: {
  frame: ReplayFrame;
  drivers: ReplayData["drivers"];
  polyline: [number, number][];
  arcLengths: number[];
  circuitLengthM: number;
}) {
  const sorted = useMemo(
    () => sortDriversByProgress(frame, polyline, arcLengths),
    [frame, polyline, arcLengths],
  );
  const gaps = useMemo(
    () => computeGaps(sorted, polyline, arcLengths, circuitLengthM),
    [sorted, polyline, arcLengths, circuitLengthM],
  );

  return (
    <div className="flex flex-col gap-0.5">
      {sorted.slice(0, TOP_N).map(({ code, data }, idx) => {
        const info = drivers[code];
        const position = data[7] > 0 ? idx + 1 : 0;
        if (position === 0) return null;

        return (
          <div
            key={code}
            className="flex items-center gap-2 px-2 py-1 rounded-md text-[11px]"
          >
            <span className="w-4 text-right font-mono font-bold text-text-muted tabular-nums">
              {position}
            </span>
            {info && isValidHeadshotUrl(info.headshot_url) ? (
              <Image
                src={info.headshot_url}
                alt={info.full_name}
                width={18}
                height={18}
                className="w-[18px] h-[18px] rounded-full object-cover shrink-0"
                unoptimized
              />
            ) : (
              <div className="w-[18px] h-[18px] rounded-full bg-bg-tertiary shrink-0" />
            )}
            <span
              className="font-mono font-bold tracking-wide"
              style={{
                color: info ? `#${info.color}` : "var(--delta-neutral)",
              }}
            >
              {code}
            </span>
            <span className="ml-auto font-mono text-[10px] text-text-muted tabular-nums">
              {gaps[idx] ?? ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Build per-lap telemetry for a single driver from replay frames */
function buildDriverLapTelemetry(
  allFrames: ReplayFrame[],
  driverCode: string,
): Map<
  number,
  {
    frameIndices: number[];
    throttles: number[];
    brakes: number[];
    speeds: number[];
  }
> {
  const map = new Map<
    number,
    {
      frameIndices: number[];
      throttles: number[];
      brakes: number[];
      speeds: number[];
    }
  >();
  for (let i = 0; i < allFrames.length; i++) {
    const d = allFrames[i]?.d[driverCode];
    if (!d) continue;
    const lap = d[7];
    if (lap <= 0) continue;
    let entry = map.get(lap);
    if (!entry) {
      entry = {
        frameIndices: [],
        throttles: [],
        brakes: [],
        speeds: [],
      };
      map.set(lap, entry);
    }
    entry.frameIndices.push(i);
    entry.throttles.push(d[9] ?? 0);
    entry.brakes.push(d[10] ?? 0);
    entry.speeds.push(d[2] ?? 0);
  }
  return map;
}

const SPEED_MAX = 360; // km/h reference for speed normalization

/** Lap-based throttle + brake trace canvas for the race leader */
function LeaderTelemetry({
  frame,
  drivers,
  allFrames,
  frameIndex,
  polyline,
  arcLengths,
}: {
  frame: ReplayFrame;
  drivers: ReplayData["drivers"];
  allFrames: ReplayFrame[];
  frameIndex: number;
  polyline: [number, number][];
  arcLengths: number[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const sorted = useMemo(
    () => sortDriversByProgress(frame, polyline, arcLengths),
    [frame, polyline, arcLengths],
  );

  const leaderCode = sorted[0]?.data[7] > 0 ? sorted[0].code : null;
  const leaderInfo = leaderCode ? drivers[leaderCode] : null;

  const lapTelemetry = useMemo(() => {
    if (!leaderCode) return null;
    return buildDriverLapTelemetry(allFrames, leaderCode);
  }, [allFrames, leaderCode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !leaderCode || !lapTelemetry) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const labelW = 32;
    const chartW = w - labelW;
    const stripH = h / 3;
    const thrBot = stripH;
    const brkTop = stripH;
    const brkBot = stripH * 2;
    const spdTop = stripH * 2;
    const spdBot = h;

    ctx.clearRect(0, 0, w, h);

    // Divider lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(labelW, thrBot);
    ctx.lineTo(w, thrBot);
    ctx.moveTo(labelW, brkBot);
    ctx.lineTo(w, brkBot);
    ctx.stroke();

    // Labels
    ctx.font = "bold 8px monospace";
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("THR", 4, thrBot / 2);
    ctx.fillText("BRK", 4, brkTop + stripH / 2);
    ctx.fillText("SPD", 4, spdTop + stripH / 2);

    // Find current lap data
    const currentLap = frame.d[leaderCode]?.[7] ?? 0;
    const lapData = lapTelemetry.get(currentLap);
    if (!lapData || lapData.frameIndices.length < 2) return;

    const totalSamples = lapData.frameIndices.length;
    // How far into this lap are we
    let progressIdx = 0;
    for (let i = 0; i < totalSamples; i++) {
      if (lapData.frameIndices[i] <= frameIndex) progressIdx = i;
      else break;
    }
    const drawUpTo = progressIdx + 1;
    const xScale = chartW / (totalSamples - 1);
    const innerH = stripH - 4;

    // Throttle fill
    ctx.fillStyle = "rgba(34, 197, 94, 0.12)";
    ctx.beginPath();
    ctx.moveTo(labelW, thrBot);
    for (let i = 0; i < drawUpTo; i++) {
      const x = labelW + i * xScale;
      const tVal = lapData.throttles[i] / 100;
      ctx.lineTo(x, thrBot - tVal * innerH);
    }
    ctx.lineTo(labelW + (drawUpTo - 1) * xScale, thrBot);
    ctx.closePath();
    ctx.fill();

    // Throttle line
    ctx.strokeStyle = resolveToken("--delta-faster");
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < drawUpTo; i++) {
      const x = labelW + i * xScale;
      const y = thrBot - (lapData.throttles[i] / 100) * innerH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Brake fill
    ctx.fillStyle = "rgba(239, 68, 68, 0.15)";
    ctx.beginPath();
    ctx.moveTo(labelW, brkBot);
    for (let i = 0; i < drawUpTo; i++) {
      const x = labelW + i * xScale;
      const bVal = lapData.brakes[i];
      ctx.lineTo(x, brkBot - bVal * innerH);
    }
    ctx.lineTo(labelW + (drawUpTo - 1) * xScale, brkBot);
    ctx.closePath();
    ctx.fill();

    // Brake line
    ctx.strokeStyle = resolveToken("--delta-slower");
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < drawUpTo; i++) {
      const x = labelW + i * xScale;
      const y = brkBot - lapData.brakes[i] * innerH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Speed fill
    ctx.fillStyle = "rgba(96, 165, 250, 0.12)";
    ctx.beginPath();
    ctx.moveTo(labelW, spdBot);
    for (let i = 0; i < drawUpTo; i++) {
      const x = labelW + i * xScale;
      const sVal = Math.min(lapData.speeds[i] / SPEED_MAX, 1);
      ctx.lineTo(x, spdBot - sVal * innerH);
    }
    ctx.lineTo(labelW + (drawUpTo - 1) * xScale, spdBot);
    ctx.closePath();
    ctx.fill();

    // Speed line
    ctx.strokeStyle = resolveToken("--status-pit");
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < drawUpTo; i++) {
      const x = labelW + i * xScale;
      const sVal = Math.min(lapData.speeds[i] / SPEED_MAX, 1);
      const y = spdBot - sVal * innerH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }, [frameIndex, leaderCode, lapTelemetry, frame]);

  if (!leaderCode) return null;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-1.5 border-b border-white/[0.06]">
        <div
          className="h-2.5 w-1 rounded-full"
          style={{
            backgroundColor: leaderInfo
              ? `#${leaderInfo.color}`
              : "var(--delta-neutral)",
          }}
        />
        <span className="font-mono text-[10px] font-bold text-text-primary tracking-wide">
          {leaderCode}
        </span>
        <span className="text-[9px] font-mono text-text-muted">P1</span>
      </div>
      <canvas ref={canvasRef} className="w-full" style={{ height: 96 }} />
    </div>
  );
}

export default function LiveReplayPreview() {
  // 1. Find the latest season that has replay data
  const { data: replaySeasons } = useQuery({
    queryKey: ["replaySeasons"],
    queryFn: fetchReplaySeasons,
    staleTime: 5 * 60 * 1000,
  });

  const latestSeason = useMemo(() => {
    if (!replaySeasons || replaySeasons.length === 0) return null;
    return Math.max(...replaySeasons);
  }, [replaySeasons]);

  // 2. Find the most recent replay within that season
  const { data: availableReplays } = useQuery({
    queryKey: ["availableReplays", latestSeason],
    queryFn: () => fetchAvailableReplays(latestSeason as number),
    enabled: latestSeason !== null,
    staleTime: 5 * 60 * 1000,
  });

  const latestReplay = useMemo(() => {
    if (!availableReplays || availableReplays.replays.length === 0) return null;
    // Pick the most recent by date (fall back to highest round)
    return [...availableReplays.replays].sort((a, b) => {
      const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (dateDiff !== 0) return dateDiff;
      return b.round - a.round;
    })[0];
  }, [availableReplays]);

  const activeSeason = latestSeason;
  const activeRound = latestReplay?.round ?? null;

  // 3. Fetch the replay frame data for the chosen session
  const {
    data: replayData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["preview-replay", activeSeason, activeRound],
    queryFn: () =>
      fetchReplayData(activeSeason as number, activeRound as number),
    enabled: activeSeason !== null && activeRound !== null,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 30 * 60 * 1000,
  });

  const dataRef = useRef<ReplayData | null>(null);
  const [frameIndex, setFrameIndex] = useState(0);
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

  // Animation loop — auto-plays at 4x, loops back to START_LAP at end
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

  // Auto-start playback when data is ready
  useEffect(() => {
    if (!replayData) return;
    lastTimestampRef.current = 0;
    animFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [replayData, animate]);

  const frame = replayData?.frames[frameIndex];
  const currentLap = frame?.lap ?? 0;
  const totalLaps = replayData?.metadata.total_laps ?? 0;

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
                {replayData && activeSeason !== null && (
                  <span className="ml-2 text-xs text-text-muted">
                    {replayData.metadata.event_name} {activeSeason}
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
            {isLoading && (
              <div className="space-y-3">
                <Skeleton variant="rectangular" height="280px" />
                <div className="flex gap-3">
                  <Skeleton width="60%" height="16px" />
                  <Skeleton width="30%" height="16px" />
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-center justify-center py-16 text-sm text-text-muted">
                Failed to load replay data
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

                {/* Leader telemetry trace */}
                <LeaderTelemetry
                  frame={frame}
                  drivers={replayData.drivers}
                  allFrames={replayData.frames}
                  frameIndex={frameIndex}
                  polyline={replayData.track.polyline}
                  arcLengths={arcLengths}
                />
              </div>
            )}
          </div>

          {/* Bottom bar — playback info + CTA */}
          <div className="flex items-center justify-between border-t border-white/[0.06] px-5 py-3">
            <div className="flex items-center gap-4 text-xs text-text-muted">
              {/* Play indicator */}
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span className="font-mono text-[10px] uppercase tracking-wide">
                  Playing
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
