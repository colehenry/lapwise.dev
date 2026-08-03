"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef } from "react";
import { isValidHeadshotUrl } from "@/lib/api";
import { resolveToken } from "@/lib/palette";
import {
  buildDriverLapTelemetry,
  computeGaps,
  sortDriversByProgress,
} from "@/lib/replayPreviewGeometry";
import type { ReplayData, ReplayFrame } from "@/lib/types";

const TOP_N = 10; // Drivers shown in mini leaderboard
const SPEED_MAX = 360; // km/h reference for speed normalization

export function MiniLeaderboard({
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

/** Lap-based throttle + brake trace canvas for the race leader */
export function LeaderTelemetry({
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
