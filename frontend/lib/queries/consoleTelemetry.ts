import { decode } from "@msgpack/msgpack";
import { queryOptions } from "@tanstack/react-query";
import { apiHeaders, apiUrl } from "@/lib/api";
import { hours } from "./durations";

/** One driver's channels for a whole race, already unpacked. */
export type DriverTelemetry = {
  code: string;
  /** Samples per second. */
  fps: number;
  speed: Int16Array;
  gear: Uint8Array;
  /** Nought to a hundred. */
  throttle: Uint8Array;
  /** Nought or one. */
  brake: Uint8Array;
  /** Sample index each lap begins at, indexed from lap one. -1 if never run. */
  lapStarts: number[];
};

type PackedTelemetry = {
  v: number;
  code: string;
  fps: number;
  samples: number;
  speed: Uint8Array;
  gear: Uint8Array;
  throttle: Uint8Array;
  brake: Uint8Array;
  lap_starts: number[];
};

/** Speed is delta-encoded because it does not fit in a byte. */
function expandDeltas(packed: Uint8Array, samples: number): Int16Array {
  const view = new DataView(
    packed.buffer,
    packed.byteOffset,
    packed.byteLength,
  );
  const values = new Int16Array(samples);
  let running = 0;
  for (let i = 0; i < samples; i++) {
    running += view.getInt16(i * 2, true);
    values[i] = running;
  }
  return values;
}

export const consoleTelemetryKeys = {
  driver: (season: number, round: number, code: string) =>
    ["console-telemetry", season, round, code] as const,
};

/** A finished race never changes. */
const TELEMETRY_STALE_TIME = hours(6);

/**
 * The leader's speed, gear, throttle and brake.
 *
 * Roughly 34 KB, fetched after the console has drawn and only for whoever is
 * in front — the channels live inside the multi-megabyte replay blob, so the
 * server slices them rather than sending it.
 *
 * A round with lap data but no replay blob answers 404. That is a gap in
 * ingest, not an error worth reporting, so the strip simply does not draw.
 */
export function consoleTelemetryQuery(
  season: number | null,
  round: number | null,
  driverCode: string | null,
) {
  return queryOptions({
    queryKey: consoleTelemetryKeys.driver(
      season ?? 0,
      round ?? 0,
      driverCode ?? "",
    ),
    queryFn: async (): Promise<DriverTelemetry | null> => {
      const response = await fetch(
        apiUrl(
          `/api/replay/console/${season}/${round}/telemetry/${driverCode}`,
        ),
        { headers: apiHeaders() },
      );
      if (!response.ok) return null;
      const packed = decode(
        new Uint8Array(await response.arrayBuffer()),
      ) as PackedTelemetry;
      return {
        code: packed.code,
        fps: packed.fps,
        speed: expandDeltas(packed.speed, packed.samples),
        gear: packed.gear,
        throttle: packed.throttle,
        brake: packed.brake,
        lapStarts: packed.lap_starts,
      };
    },
    enabled: season !== null && round !== null && Boolean(driverCode),
    staleTime: TELEMETRY_STALE_TIME,
    gcTime: TELEMETRY_STALE_TIME,
    retry: false,
  });
}

/** The sample range covering one lap, or null if that lap was never run. */
export function lapWindow(
  telemetry: DriverTelemetry,
  lap: number,
): { from: number; to: number } | null {
  const starts = telemetry.lapStarts;
  const from = starts[lap - 1];
  if (from == null || from < 0) return null;
  let to = telemetry.speed.length;
  for (let next = lap; next < starts.length; next++) {
    if (starts[next] >= 0) {
      to = starts[next];
      break;
    }
  }
  return to > from + 1 ? { from, to } : null;
}

export type ChannelReading = {
  speed: number;
  gear: number;
  throttle: number;
  brake: number;
};

/**
 * What the car was doing a given fraction of the way through a lap.
 *
 * Shared so the header readout and the traces cannot disagree about which
 * sample is current.
 */
export function sampleAt(
  telemetry: DriverTelemetry,
  lap: number,
  through: number,
): ChannelReading | null {
  const window = lapWindow(telemetry, lap);
  if (!window) return null;
  const count = window.to - window.from;
  const offset = Math.max(
    0,
    Math.min(count - 1, Math.round(through * count) - 1),
  );
  const index = window.from + offset;
  return {
    speed: telemetry.speed[index],
    gear: telemetry.gear[index],
    throttle: telemetry.throttle[index],
    brake: telemetry.brake[index],
  };
}
