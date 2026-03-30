"use client";

import Image from "next/image";
import { useMemo } from "react";
import { TrianglePattern } from "@/components/Patterns";
import { isValidHeadshotUrl } from "@/lib/api";
import type {
  ReplayDriverFrame,
  ReplayDriverInfo,
  ReplayFrame,
  ReplayMetadata,
  ReplayTrack,
} from "@/lib/types";

interface LeaderboardProps {
  drivers: Record<string, ReplayDriverInfo>;
  frame: ReplayFrame | undefined;
  track: ReplayTrack;
  metadata: ReplayMetadata;
  selectedDriver: string | null;
  compareDriver?: string | null;
  onSelectDriver: (code: string | null) => void;
}

const COMPOUND_COLORS: Record<number, string> = {
  0: "#FF3333",
  1: "#FFD700",
  2: "#FFFFFF",
  3: "#33CC33",
  4: "#3399FF",
};

const COMPOUND_LABELS: Record<number, string> = {
  0: "S",
  1: "M",
  2: "H",
  3: "I",
  4: "W",
};

/** Precompute cumulative arc lengths along the polyline */
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

/** Compute gaps between consecutive drivers */
function computeGaps(
  sorted: { code: string; data: ReplayDriverFrame }[],
  polyline: [number, number][],
  arcLengths: number[],
  circuitLengthM: number,
): (string | null)[] {
  if (sorted.length === 0) return [];

  const gaps: (string | null)[] = [null]; // Leader has no gap

  const leaderLap = sorted[0].data[7];
  const leaderProgress = getTrackProgress(
    sorted[0].data[0],
    sorted[0].data[1],
    polyline,
    arcLengths,
  );
  const leaderSpeed = sorted[0].data[2]; // km/h

  const speedMs = leaderSpeed > 0 ? (leaderSpeed * 1000) / 3600 : 50; // m/s fallback

  for (let i = 1; i < sorted.length; i++) {
    const driverLap = sorted[i].data[7];
    const driverPos = sorted[i].data[8];

    if (driverPos === 0) {
      gaps.push(null);
      continue;
    }

    const lapDiff = leaderLap - driverLap;

    if (lapDiff > 0) {
      gaps.push(`+${lapDiff} LAP${lapDiff > 1 ? "S" : ""}`);
      continue;
    }

    // Same lap - compute gap from track progress
    const driverProgress = getTrackProgress(
      sorted[i].data[0],
      sorted[i].data[1],
      polyline,
      arcLengths,
    );

    // Distance behind leader in track units
    let progressDiff = leaderProgress - driverProgress;
    if (progressDiff < 0) progressDiff += 1; // Handle wrap-around

    // Convert to meters using actual circuit length, then to seconds
    const distMeters = progressDiff * circuitLengthM;
    const gapSeconds = distMeters / speedMs;

    if (gapSeconds < 0.1) {
      gaps.push(null);
    } else if (gapSeconds > 120) {
      gaps.push(null); // Probably invalid data
    } else {
      gaps.push(`+${gapSeconds.toFixed(1)}`);
    }
  }

  return gaps;
}

export default function Leaderboard({
  drivers,
  frame,
  track,
  metadata,
  selectedDriver,
  compareDriver,
  onSelectDriver,
}: LeaderboardProps) {
  // Precompute arc lengths once
  const arcLengths = useMemo(
    () => computeArcLengths(track.polyline),
    [track.polyline],
  );

  // Use actual circuit length from metadata, fallback to 5000m
  const circuitLengthM = metadata.circuit_length_m ?? 5000;

  if (!frame) return null;

  // Sort drivers by position
  const sorted = Object.entries(frame.d)
    .map(([code, data]) => ({ code, data }))
    .sort((a, b) => {
      const posA = a.data[8];
      const posB = b.data[8];
      if (posA === 0 && posB === 0) return 0;
      if (posA === 0) return 1;
      if (posB === 0) return -1;
      return posA - posB;
    });

  // Compute gaps
  const gaps = computeGaps(sorted, track.polyline, arcLengths, circuitLengthM);

  return (
    <div className="bg-bg-tertiary border border-border-primary rounded-sm flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="relative h-10 bg-bg-primary border-b border-border-primary px-4 flex items-center overflow-hidden shrink-0">
        <TrianglePattern id="replay-leaderboard-triangles" />
        <h3 className="relative z-10 text-[10px] font-mono tracking-widest text-text-muted uppercase font-bold">
          Positions
        </h3>
      </div>
      <div className="overflow-y-auto flex-1 min-h-0">
        {sorted.map(({ code, data }, idx) => {
          const info = drivers[code];
          const position = data[8];
          const compound = data[5];
          const tyreLife = data[6];
          const isSelected = code === selectedDriver;
          const isCompare = code === compareDriver;
          const gap = gaps[idx];

          return (
            <button
              key={code}
              type="button"
              onClick={() => onSelectDriver(code)}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-bg-elevated ${
                isSelected
                  ? "bg-bg-elevated"
                  : isCompare
                    ? "bg-bg-elevated/50"
                    : ""
              }`}
            >
              {/* Position */}
              <span className="text-xs font-mono text-text-muted w-5 text-right shrink-0">
                {position || "–"}
              </span>

              {/* Team color bar */}
              <div
                className="w-1 h-5 rounded-full shrink-0"
                style={{
                  backgroundColor: info ? `#${info.color}` : "#999",
                }}
              />

              {/* Headshot */}
              {info && isValidHeadshotUrl(info.headshot_url) ? (
                <Image
                  src={info.headshot_url}
                  alt={info.full_name}
                  width={20}
                  height={20}
                  className="w-5 h-5 rounded-full object-cover shrink-0"
                  unoptimized
                />
              ) : (
                <div className="w-5 h-5 rounded-full bg-bg-primary shrink-0" />
              )}

              {/* Driver code */}
              <span
                className={`text-xs font-mono font-semibold flex-1 ${
                  isSelected ? "text-text-primary" : "text-text-secondary"
                }`}
              >
                {code}
              </span>

              {/* Gap interval */}
              {gap && (
                <span className="text-[10px] font-mono text-text-muted shrink-0">
                  {gap}
                </span>
              )}

              {/* Tyre */}
              <div className="flex items-center gap-1 shrink-0">
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: COMPOUND_COLORS[compound] ?? "#999",
                  }}
                />
                <span className="text-[10px] font-mono text-text-muted">
                  {COMPOUND_LABELS[compound] ?? "?"}
                  {tyreLife > 0 ? tyreLife : ""}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
