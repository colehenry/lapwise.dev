import type {
  ConsoleCar,
  ConsoleReplay,
  ConsoleStatusWindow,
} from "@/lib/queries/consoleReplay";

/** One car's place in the running order at a single instant. */
export type OrderEntry = {
  car: ConsoleCar;
  key: string;
  /** Laps completed, fractional. */
  progress: number;
  /** Index of the lap in progress, clamped to the car's last lap. */
  lapIndex: number;
  /** Seconds since the leader passed this point; null for the leader. */
  gapSeconds: number | null;
  /** Whole laps down; 0 while on the lead lap. */
  lapsBehind: number;
};

/** The instant every panel reads. */
export type ClockFrame = {
  t: number;
  /** Seconds since the first lap start. */
  elapsed: number;
  /** The leader's lap number, 1-based. */
  lap: number;
  order: OrderEntry[];
  leader: OrderEntry;
  status: ConsoleStatusWindow | null;
  /** Feed events at or before `t`. */
  feedCount: number;
};

/** Playback opens a third of the way in, past the opening-lap scramble. */
const OPENING_FRACTION = 1 / 3;

export function carKey(car: ConsoleCar): string {
  return car.driver_code ?? car.full_name;
}

/**
 * Laps completed at `t`, fractional. Zero before the car's first lap start,
 * `start.length` once it is parked or finished.
 */
export function progressAt(car: ConsoleCar, t: number): number {
  const s = car.start;
  if (s.length === 0) return 0;
  if (t <= s[0]) return 0;
  if (t >= car.end) return s.length;
  let i = s.length - 1;
  while (i > 0 && s[i] > t) i--;
  const next = i + 1 < s.length ? s[i + 1] : car.end;
  return i + Math.min(1, (t - s[i]) / (next - s[i]));
}

/** The inverse: when this car was at `x` laps completed. */
export function timeAtProgress(car: ConsoleCar, x: number): number {
  const s = car.start;
  if (s.length === 0) return car.end;
  const i = Math.floor(x);
  if (i <= 0) return s[0];
  if (i >= s.length) return car.end;
  const next = i + 1 < s.length ? s[i + 1] : car.end;
  return s[i] + (x - i) * (next - s[i]);
}

/** The point on a closed polyline at `frac` of one lap. */
export function pointAt(
  polyline: number[][],
  frac: number,
): [number, number] | null {
  if (polyline.length === 0) return null;
  const wrapped = frac - Math.floor(frac);
  const index = Math.min(
    polyline.length - 1,
    Math.floor(wrapped * (polyline.length - 1)),
  );
  const point = polyline[index];
  return [point[0], point[1]];
}

export function statusAt(
  windows: ConsoleStatusWindow[],
  t: number,
): ConsoleStatusWindow | null {
  return windows.find((w) => t >= w.from && t < w.to) ?? null;
}

/**
 * A stoppage window has no lap starts in it, so playback jumps to its end.
 * Monza 2026 stands still for 31 minutes without this.
 */
export function skipStoppages(t: number, skips: number[][]): number {
  let time = t;
  for (const window of skips) {
    const [from, to] = window;
    if (time > from && time < to) time = to;
  }
  return time;
}

/** Where playback starts: the whole field is under way and racing. */
export function openingTime(replay: ConsoleReplay): number {
  const openingLap = Math.floor(replay.total_laps * OPENING_FRACTION);
  const starts = replay.cars
    .filter((car) => car.start.length > 0)
    .map((car) => car.start[Math.min(openingLap, car.start.length - 1)]);
  return starts.length > 0 ? Math.max(...starts) : replay.t0;
}

/** Feed events at or before `t`, counted off a chronologically ordered list. */
export function feedCountAt(replay: ConsoleReplay, t: number): number {
  let low = 0;
  let high = replay.feed.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (replay.feed[mid].t <= t) low = mid + 1;
    else high = mid;
  }
  return low;
}

/** Everything the page shows at one instant, derived once per tick. */
export function buildFrame(
  replay: ConsoleReplay,
  t: number,
): ClockFrame | null {
  if (replay.cars.length === 0) return null;

  const ranked = replay.cars
    .map((car) => ({ car, progress: progressAt(car, t) }))
    .sort((a, b) => b.progress - a.progress);

  const leaderCar = ranked[0].car;
  const leaderProgress = ranked[0].progress;

  const order: OrderEntry[] = ranked.map(({ car, progress }, index) => {
    const behind = leaderProgress - progress;
    const lapsBehind = behind >= 1 ? Math.floor(behind) : 0;
    return {
      car,
      key: carKey(car),
      progress,
      lapIndex: Math.max(
        0,
        Math.min(car.laps.length - 1, Math.floor(progress)),
      ),
      gapSeconds:
        index === 0
          ? null
          : t - timeAtProgress(leaderCar, Math.min(progress, leaderProgress)),
      lapsBehind,
    };
  });

  const leader = order[0];
  return {
    t,
    elapsed: t - replay.t0,
    lap: Math.min(replay.total_laps, leader.lapIndex + 1),
    order,
    leader,
    status: statusAt(replay.status, t),
    feedCount: feedCountAt(replay, t),
  };
}

/**
 * What must change on screen before React re-renders. Positions, the tooltip
 * and the playhead move every tick and are written through refs instead.
 */
export function frameSignature(frame: ClockFrame): string {
  return [
    frame.lap,
    frame.feedCount,
    frame.status?.code ?? "green",
    frame.order.map((entry) => entry.key).join(","),
  ].join("|");
}
