import { describe, expect, it } from "vitest";
import { fitTrack, trackPath } from "./consoleTrackGeometry";

/** Twice as wide as it is tall, the way a stored circuit arrives. */
const CIRCUIT = [
  [100, 50],
  [500, 50],
  [500, 250],
  [100, 250],
];

describe("fitTrack", () => {
  it("keeps the orientation the ingest already applied", () => {
    // `rotation_deg` is baked into the stored polyline, so re-applying it here
    // turned Monza through a half-turn and the track came out mirrored.
    const fitted = fitTrack(CIRCUIT);
    expect(fitted?.width).toBeGreaterThan(fitted?.height ?? 0);
    const xs = fitted?.polyline.map((point) => point[0]) ?? [];
    const ys = fitted?.polyline.map((point) => point[1]) ?? [];
    // Same shape, only translated into the box.
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(400, 5);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(200, 5);
  });

  it("boxes the polyline to its own bounds with an even pad", () => {
    const fitted = fitTrack(CIRCUIT);
    const xs = fitted?.polyline.map((point) => point[0]) ?? [];
    const ys = fitted?.polyline.map((point) => point[1]) ?? [];
    const pad = Math.min(...xs);
    expect(Math.min(...ys)).toBeCloseTo(pad, 5);
    expect((fitted?.width ?? 0) - Math.max(...xs)).toBeCloseTo(pad, 5);
    expect((fitted?.height ?? 0) - Math.max(...ys)).toBeCloseTo(pad, 5);
  });

  it("leaves a portrait circuit portrait", () => {
    const portrait = fitTrack([
      [0, 0],
      [100, 0],
      [100, 400],
      [0, 400],
    ]);
    expect(portrait?.height).toBeGreaterThan(portrait?.width ?? 0);
  });

  it("returns nothing without a usable polyline", () => {
    expect(fitTrack([])).toBeNull();
    expect(fitTrack([[0, 0]])).toBeNull();
  });
});

describe("trackPath", () => {
  it("closes the lap", () => {
    expect(
      trackPath([
        [0, 0],
        [1, 1],
      ]),
    ).toBe("M 0.0 0.0 L 1.0 1.0 Z");
  });
});
