/**
 * Derives a replayable race from stored lap times.
 *
 * Everything here comes from rows the API already returns: cumulative lap time
 * gives each car a fractional lap, which maps to a real distance around the
 * real polyline, and a gap is how long ago the leader stood at this car's
 * progress. No positions are invented.
 */

import type { DriverLapTimes, LapData, LapTimesResponse } from "@/lib/types";

export type ClockCar = {
  code: string;
  name: string;
  slug: string | null;
  color: string | null;
  finalPosition: number | null;
  laps: LapData[];
  /** Session seconds at the end of each lap. */
  cumulative: number[];
  total: number;
};

export type ClockRow = {
  car: ClockCar;
  position: number;
  lapNumber: number;
  lap: LapData | undefined;
  /** Completed laps plus fraction of the lap in progress. */
  progress: number;
  gap: number;
  retired: boolean;
  lastLapTime: number | null;
};

export type FlagSpan = { from: number; to: number; label: string };

export type ClockState = {
  time: number;
  rows: ClockRow[];
  flag: FlagSpan | null;
  lap: number;
  totalLaps: number;
};

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Track-status digits FastF1 emits; 1 is green and needs no band. */
const FLAG_LABELS: Record<string, string> = {
  "2": "YELLOW",
  "4": "SC",
  "5": "RED",
  "6": "VSC",
  "7": "VSC",
};

export type RaceClock = {
  cars: ClockCar[];
  totalLaps: number;
  duration: number;
  flags: FlagSpan[];
  fastestLap: number;
  stateAt(time: number): ClockState;
};

export function buildRaceClock(data: LapTimesResponse): RaceClock | null {
  const source = data.drivers?.filter((d) => d.laps?.length) ?? [];
  if (!source.length) return null;

  const cars: ClockCar[] = source.map((d: DriverLapTimes) => {
    const cumulative: number[] = [];
    let running = 0;
    for (const lap of d.laps) {
      running += lap.lap_time_seconds ?? 0;
      cumulative.push(running);
    }
    return {
      code: d.driver_code ?? d.full_name.slice(0, 3).toUpperCase(),
      name: d.full_name,
      slug: d.driver_slug,
      color: d.team_color,
      finalPosition: d.final_position,
      laps: d.laps,
      cumulative,
      total: running,
    };
  });

  const totalLaps =
    data.total_laps ?? Math.max(...cars.map((c) => c.laps.length));
  const duration = Math.max(...cars.map((c) => c.total));

  const timed = cars.flatMap((c) =>
    c.laps
      .map((l) => l.lap_time_seconds)
      .filter((t): t is number => typeof t === "number" && t > 0),
  );
  const fastestLap = timed.length ? Math.min(...timed) : 0;

  const leader = cars.find((c) => c.finalPosition === 1) ?? cars[0];
  const flags = deriveFlagSpans(
    data.track_status_events ?? [],
    leader,
    totalLaps,
  );

  function stateAt(time: number): ClockState {
    const rows: ClockRow[] = cars.map((car) => {
      let i = 0;
      while (i < car.cumulative.length && car.cumulative[i] <= time) i++;
      const previousEnd = i > 0 ? car.cumulative[i - 1] : 0;
      const currentEnd = i < car.cumulative.length ? car.cumulative[i] : null;
      const lapDuration = currentEnd === null ? null : currentEnd - previousEnd;
      const fraction =
        lapDuration && lapDuration > 0
          ? clamp((time - previousEnd) / lapDuration, 0, 1)
          : 1;

      return {
        car,
        position: 0,
        lapNumber: currentEnd === null ? car.laps.length : i + 1,
        lap: currentEnd === null ? car.laps[car.laps.length - 1] : car.laps[i],
        progress: i + (currentEnd === null ? 0 : fraction),
        gap: 0,
        retired: currentEnd === null && time > car.total + 1,
        lastLapTime: i > 0 ? (car.laps[i - 1]?.lap_time_seconds ?? null) : null,
      };
    });

    rows.sort((a, b) => b.progress - a.progress);

    const front = rows[0];
    rows.forEach((row, index) => {
      row.position = index + 1;
      if (row === front) {
        row.gap = 0;
        return;
      }
      // How long ago the leader stood where this car is now.
      const marks = front.car.cumulative;
      const idx = clamp(Math.floor(row.progress), 0, marks.length - 1);
      const before = idx > 0 ? marks[idx - 1] : 0;
      const leaderAt = lerp(
        before,
        marks[idx],
        row.progress - Math.floor(row.progress),
      );
      row.gap = time - leaderAt;
    });

    const lap = leaderLapAt(front.car, time, totalLaps);
    return {
      time,
      rows,
      flag: flags.find((f) => lap >= f.from && lap <= f.to) ?? null,
      lap,
      totalLaps,
    };
  }

  return { cars, totalLaps, duration, flags, fastestLap, stateAt };
}

function leaderLapAt(car: ClockCar, time: number, totalLaps: number): number {
  let i = 0;
  while (i < car.cumulative.length && car.cumulative[i] <= time) i++;
  return clamp(i + 1, 1, totalLaps);
}

/**
 * Track status arrives as session timestamps; the charts need lap ranges, so
 * map each event onto the leader's own lap boundaries and merge the flurry of
 * adjacent flags into readable bands.
 */
function deriveFlagSpans(
  events: { session_time_seconds: number; status: string }[],
  leader: ClockCar,
  totalLaps: number,
): FlagSpan[] {
  if (!events.length) return [];

  const bounds = leader.cumulative.map((end, i) => ({
    lap: i + 1,
    start: i > 0 ? leader.cumulative[i - 1] : 0,
    end,
  }));
  const lapAt = (seconds: number) => {
    const hit = bounds.find((b) => seconds >= b.start && seconds < b.end);
    if (hit) return hit.lap;
    return seconds <= 0 ? 1 : totalLaps;
  };

  const spans: FlagSpan[] = [];
  let open: { from: number; label: string } | null = null;

  for (const event of events) {
    const label = FLAG_LABELS[String(event.status)[0]];
    if (label && !open) {
      open = { from: lapAt(event.session_time_seconds), label };
    } else if (!label && open) {
      const to = lapAt(event.session_time_seconds);
      if (to >= open.from) spans.push({ ...open, to });
      open = null;
    }
  }
  if (open) spans.push({ ...open, to: totalLaps });

  return spans.reduce<FlagSpan[]>((acc, span) => {
    const prev = acc[acc.length - 1];
    if (prev && prev.label === span.label && span.from - prev.to <= 1) {
      prev.to = Math.max(prev.to, span.to);
      return acc;
    }
    acc.push({ ...span });
    return acc;
  }, []);
}

/** Arc-length lookup so a fractional lap becomes a point on the polyline. */
export function buildTrackPath(polyline: [number, number][]) {
  const segments: {
    a: [number, number];
    b: [number, number];
    len: number;
    at: number;
  }[] = [];
  let total = 0;
  for (let i = 0; i < polyline.length; i++) {
    const a = polyline[i];
    const b = polyline[(i + 1) % polyline.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    segments.push({ a, b, len, at: total });
    total += len;
  }
  return (fraction: number): [number, number] => {
    if (!total) return polyline[0] ?? [0, 0];
    const target = (((fraction % 1) + 1) % 1) * total;
    const seg =
      segments.find((s) => target >= s.at && target < s.at + s.len) ??
      segments[0];
    const k = seg.len ? (target - seg.at) / seg.len : 0;
    return [lerp(seg.a[0], seg.b[0], k), lerp(seg.a[1], seg.b[1], k)];
  };
}
