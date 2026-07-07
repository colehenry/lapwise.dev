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
  allFrames: ReplayFrame[];
  frameIndex: number;
  track: ReplayTrack;
  metadata: ReplayMetadata;
  selectedDriver: string | null;
  compareDriver?: string | null;
  onSelectDriver: (code: string | null) => void;
}

import { COMPOUND_COLORS as COMPOUND } from "@/lib/palette";

const COMPOUND_COLORS: Record<number, string> = {
  0: COMPOUND.SOFT,
  1: COMPOUND.MEDIUM,
  2: COMPOUND.HARD,
  3: COMPOUND.INTERMEDIATE,
  4: COMPOUND.WET,
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

    if (driverLap <= 0) {
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

/** Precomputed lap completion: { frameIndex, driver, lapTime } sorted by frame index */
interface LapCompletion {
  frameIdx: number;
  driver: string;
  lapTime: number;
}

export default function Leaderboard({
  drivers,
  frame,
  allFrames,
  frameIndex,
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

  // Compute grid positions from lap 1 start
  const gridPositions = useMemo(() => {
    const grid: Record<string, number> = {};
    for (const f of allFrames) {
      for (const [code, data] of Object.entries(f.d)) {
        if (data[8] > 0 && !(code in grid)) {
          grid[code] = data[8];
        }
      }
      if (Object.keys(grid).length >= Object.keys(f.d).length) break;
    }
    return grid;
  }, [allFrames]);

  // Precompute all lap completions once (sorted by frame index)
  const lapCompletions = useMemo(() => {
    const lapStarts: Record<
      string,
      Record<number, { t: number; fi: number }>
    > = {};
    const completions: LapCompletion[] = [];

    for (let fi = 0; fi < allFrames.length; fi++) {
      const f = allFrames[fi];
      for (const [code, data] of Object.entries(f.d)) {
        const lap = data[7];
        if (lap <= 0) continue;
        if (!lapStarts[code]) lapStarts[code] = {};
        if (!(lap in lapStarts[code])) {
          lapStarts[code][lap] = { t: f.t, fi };
          const prev = lapStarts[code][lap - 1];
          if (prev !== undefined && lap > 1) {
            const lapTime = f.t - prev.t;
            if (lapTime > 10) {
              completions.push({ frameIdx: fi, driver: code, lapTime });
            }
          }
        }
      }
    }
    return completions;
  }, [allFrames]);

  // Derive current fastest lap holder from precomputed data + current frame index
  const fastestLapDriver = useMemo(() => {
    let bestDriver: string | null = null;
    let bestTime = Infinity;
    for (const lc of lapCompletions) {
      if (lc.frameIdx > frameIndex) break;
      if (lc.lapTime < bestTime) {
        bestTime = lc.lapTime;
        bestDriver = lc.driver;
      }
    }
    return bestDriver;
  }, [lapCompletions, frameIndex]);

  if (!frame) return null;

  // Compute real-time race progress for each driver: lap + track fraction
  // Higher = further ahead in the race
  const driverProgress = Object.entries(frame.d).map(([code, data]) => {
    const lap = data[7];
    const progress = getTrackProgress(
      data[0],
      data[1],
      track.polyline,
      arcLengths,
    );
    return { code, data, raceProgress: lap + progress };
  });

  // Sort by race progress descending (furthest ahead = P1)
  const sorted = driverProgress.sort((a, b) => {
    // Drivers with lap 0 go to the bottom
    if (a.data[7] <= 0 && b.data[7] <= 0) return 0;
    if (a.data[7] <= 0) return 1;
    if (b.data[7] <= 0) return -1;
    return b.raceProgress - a.raceProgress;
  });

  // Assign computed positions (1-indexed)
  const computedPositions: Record<string, number> = {};
  for (let i = 0; i < sorted.length; i++) {
    computedPositions[sorted[i].code] = sorted[i].data[7] > 0 ? i + 1 : 0;
  }

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
          const position = computedPositions[code] ?? 0;
          const compound = data[5];
          const tyreLife = data[6];
          const isSelected = code === selectedDriver;
          const isCompare = code === compareDriver;
          const gap = gaps[idx];
          const isFastestLap = code === fastestLapDriver;

          // Position change vs grid
          const gridPos = gridPositions[code];
          const posChange = gridPos && position > 0 ? gridPos - position : 0;

          return (
            <button
              key={code}
              type="button"
              onClick={() => onSelectDriver(code)}
              className={`w-full flex items-center gap-1.5 px-3 py-1.5 text-left transition-colors hover:bg-bg-elevated ${
                isSelected
                  ? "bg-bg-elevated"
                  : isCompare
                    ? "bg-bg-elevated/50"
                    : ""
              } ${isFastestLap ? "border-l-2 border-purple-500" : ""}`}
            >
              {/* Position + change indicator */}
              <div className="flex items-center w-8 shrink-0 justify-end gap-0.5">
                {posChange > 0 && (
                  <span className="text-[8px] text-green-400">
                    ▲{posChange}
                  </span>
                )}
                {posChange < 0 && (
                  <span className="text-[8px] text-red-400">
                    ▼{Math.abs(posChange)}
                  </span>
                )}
                <span className="text-xs font-mono text-text-muted w-5 text-right">
                  {position || "–"}
                </span>
              </div>

              {/* Team color bar */}
              <div
                className="w-1 h-5 rounded-full shrink-0"
                style={{
                  backgroundColor: info
                    ? `#${info.color}`
                    : "var(--delta-neutral)",
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

              {/* Driver number + code */}
              <div className="flex items-baseline gap-1 flex-1 min-w-0">
                {info && (
                  <span className="text-[9px] font-mono text-text-muted">
                    {info.number}
                  </span>
                )}
                <span
                  className={`text-xs font-mono font-semibold truncate ${
                    isSelected ? "text-text-primary" : "text-text-secondary"
                  }`}
                >
                  {code}
                </span>
                {isFastestLap && (
                  <span className="text-[8px] text-purple-400 font-mono">
                    FL
                  </span>
                )}
              </div>

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
                    backgroundColor:
                      COMPOUND_COLORS[compound] ?? "var(--delta-neutral)",
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
