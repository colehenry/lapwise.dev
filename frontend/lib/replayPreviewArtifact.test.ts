import { describe, expect, it } from "vitest";
import {
  expandPreviewArtifact,
  type ReplayPreviewArtifact,
} from "./replayPreviewArtifact";

const CODES = ["VER", "NOR"];

function packI16Deltas(values: number[]): Uint8Array {
  const out = new Uint8Array(values.length * 2);
  const view = new DataView(out.buffer);
  let previous = 0;
  values.forEach((value, i) => {
    view.setInt16(i * 2, value - previous, true);
    previous = value;
  });
  return out;
}

function makeArtifact(
  overrides: Partial<ReplayPreviewArtifact> = {},
): ReplayPreviewArtifact {
  const xs = { VER: [100, 110, 120], NOR: [200, 190, 180] };
  const ys = { VER: [50, 55, 60], NOR: [70, 75, 80] };
  const laps = { VER: [1, 1, 2], NOR: [1, 2, 2] };

  return {
    version: 1,
    metadata: {
      session_id: 1,
      season: 2026,
      round: 11,
      event_name: "Test Grand Prix",
      total_frames: 3,
      fps: 2,
      total_duration_seconds: 1.5,
      total_laps: 2,
      circuit_length_m: 4094.7,
    },
    track: {
      polyline: [
        [0, 0],
        [1, 1],
      ],
      rotation_deg: 0,
      corners: [],
      drs_zones: [],
    },
    drivers: Object.fromEntries(
      CODES.map((code) => [
        code,
        { color: "FF8000", full_name: code, number: 1, headshot_url: null },
      ]),
    ),
    codes: CODES,
    x: Object.fromEntries(
      CODES.map((c) => [c, packI16Deltas(xs[c as keyof typeof xs])]),
    ),
    y: Object.fromEntries(
      CODES.map((c) => [c, packI16Deltas(ys[c as keyof typeof ys])]),
    ),
    lap: Object.fromEntries(
      CODES.map((c) => [c, new Uint8Array(laps[c as keyof typeof laps])]),
    ),
    sc: new Uint8Array([0, 0, 1]),
    ...overrides,
  };
}

describe("expandPreviewArtifact", () => {
  it("reconstructs one frame per sample", () => {
    const data = expandPreviewArtifact(makeArtifact());
    expect(data.frames).toHaveLength(3);
  });

  it("decodes delta-encoded coordinates back to absolute positions", () => {
    const data = expandPreviewArtifact(makeArtifact());

    expect(data.frames.map((f) => f.d.VER[0])).toEqual([100, 110, 120]);
    expect(data.frames.map((f) => f.d.NOR[0])).toEqual([200, 190, 180]);
    expect(data.frames.map((f) => f.d.VER[1])).toEqual([50, 55, 60]);
  });

  it("places lap in the slot the leaderboard reads", () => {
    const data = expandPreviewArtifact(makeArtifact());
    expect(data.frames.map((f) => f.d.VER[7])).toEqual([1, 1, 2]);
  });

  it("derives frame lap from the furthest driver", () => {
    const data = expandPreviewArtifact(makeArtifact());
    expect(data.frames.map((f) => f.lap)).toEqual([1, 2, 2]);
  });

  it("spaces frame timestamps by the artifact frame rate", () => {
    const data = expandPreviewArtifact(makeArtifact());
    expect(data.frames.map((f) => f.t)).toEqual([0, 0.5, 1]);
  });

  it("carries track status through", () => {
    const data = expandPreviewArtifact(makeArtifact());
    expect(data.frames.map((f) => f.sc)).toEqual([0, 0, 1]);
  });

  it("keeps track geometry and driver metadata intact", () => {
    const artifact = makeArtifact();
    const data = expandPreviewArtifact(artifact);

    expect(data.track).toEqual(artifact.track);
    expect(data.drivers).toEqual(artifact.drivers);
  });

  it("zeroes the telemetry slots the artifact does not carry", () => {
    const data = expandPreviewArtifact(makeArtifact());
    const frame = data.frames[0].d.VER;

    // speed, gear, drs, compound, tyre life, position, throttle, brake
    expect([
      frame[2],
      frame[3],
      frame[4],
      frame[5],
      frame[6],
      frame[8],
      frame[9],
      frame[10],
    ]).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it("rejects an artifact written by a newer builder", () => {
    expect(() => expandPreviewArtifact(makeArtifact({ version: 2 }))).toThrow(
      /Unsupported replay preview version 2/,
    );
  });
});
