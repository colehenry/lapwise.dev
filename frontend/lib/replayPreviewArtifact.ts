import type { ReplayData, ReplayDriverFrame, ReplayFrame } from "@/lib/types";

/**
 * Wire format of the home autoplay artifact, built by
 * `backend/app/services/replay_preview.py`. Positions are columnar int16
 * deltas per driver rather than per-frame dictionaries, and telemetry
 * channels are absent.
 */
export interface ReplayPreviewArtifact {
  version: number;
  metadata: ReplayData["metadata"];
  track: ReplayData["track"];
  drivers: ReplayData["drivers"];
  codes: string[];
  x: Record<string, Uint8Array>;
  y: Record<string, Uint8Array>;
  lap: Record<string, Uint8Array>;
  sc: Uint8Array;
}

const SUPPORTED_VERSION = 1;

function readI16Deltas(blob: Uint8Array, count: number): Int16Array {
  const view = new DataView(blob.buffer, blob.byteOffset, blob.byteLength);
  const out = new Int16Array(count);
  let total = 0;
  for (let i = 0; i < count; i++) {
    total += view.getInt16(i * 2, true);
    out[i] = total;
  }
  return out;
}

/**
 * Expand the artifact into the frame shape the replay canvas and leaderboard
 * already consume. Telemetry slots carry zero: the preview never reads them.
 */
export function expandPreviewArtifact(
  artifact: ReplayPreviewArtifact,
): ReplayData {
  if (artifact.version !== SUPPORTED_VERSION) {
    throw new Error(`Unsupported replay preview version ${artifact.version}`);
  }

  const frameCount = artifact.metadata.total_frames;
  const secondsPerFrame = 1 / artifact.metadata.fps;

  const channels = artifact.codes.map((code) => ({
    code,
    x: readI16Deltas(artifact.x[code], frameCount),
    y: readI16Deltas(artifact.y[code], frameCount),
    lap: artifact.lap[code],
  }));

  const frames: ReplayFrame[] = new Array(frameCount);
  for (let i = 0; i < frameCount; i++) {
    const d: Record<string, ReplayDriverFrame> = {};
    let maxLap = 0;
    for (const channel of channels) {
      const lap = channel.lap[i];
      maxLap = Math.max(maxLap, lap);
      d[channel.code] = [
        channel.x[i],
        channel.y[i],
        0,
        0,
        0,
        0,
        0,
        lap,
        0,
        0,
        0,
      ];
    }
    frames[i] = {
      t: Number((i * secondsPerFrame).toFixed(2)),
      lap: maxLap,
      d,
      sc: artifact.sc[i] ?? 0,
    };
  }

  return {
    metadata: artifact.metadata,
    track: artifact.track,
    drivers: artifact.drivers,
    frames,
    race_control: [],
  };
}
