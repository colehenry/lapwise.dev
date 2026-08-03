import type { ReplayDriverFrame, ReplayFrame } from "@/lib/types";

/** Find the first frame index at or after a given lap number */
export function findLapStartFrame(frames: ReplayFrame[], lap: number): number {
  for (let i = 0; i < frames.length; i++) {
    if (frames[i].lap >= lap) return i;
  }
  return 0;
}

/** Compute arc lengths along the track polyline for gap calculation */
export function computeArcLengths(polyline: [number, number][]): number[] {
  const lengths = [0];
  for (let i = 1; i < polyline.length; i++) {
    const dx = polyline[i][0] - polyline[i - 1][0];
    const dy = polyline[i][1] - polyline[i - 1][1];
    lengths.push(lengths[i - 1] + Math.sqrt(dx * dx + dy * dy));
  }
  return lengths;
}

/** Find driver's progress along the track as a fraction [0, 1) */
export function getTrackProgress(
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
export function sortDriversByProgress(
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
export function computeGaps(
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

/** Build per-lap telemetry for a single driver from replay frames */
export function buildDriverLapTelemetry(
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
