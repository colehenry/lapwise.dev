import { describe, expect, it } from "vitest";
import { fitTrack, projectionFor, trackPath } from "./consoleTrackGeometry";

/** Twice as tall as it is wide, so the fit has a real choice to make. */
const PORTRAIT = [
  [0, 0],
  [10, 0],
  [10, 40],
  [0, 40],
];

describe("fitTrack", () => {
  it("lands a portrait circuit landscape, so it fills a wide panel", () => {
    const fitted = fitTrack(PORTRAIT, 0);
    expect(fitted).not.toBeNull();
    expect(fitted?.width).toBeGreaterThan(fitted?.height ?? 0);
  });

  it("boxes the polyline to its own bounds with an even pad", () => {
    const fitted = fitTrack(PORTRAIT, 0);
    const xs = fitted?.polyline.map((point) => point[0]) ?? [];
    const ys = fitted?.polyline.map((point) => point[1]) ?? [];
    const pad = Math.min(...xs);
    expect(Math.min(...ys)).toBeCloseTo(pad, 5);
    expect((fitted?.width ?? 0) - Math.max(...xs)).toBeCloseTo(pad, 5);
  });

  it("honours the circuit's own rotation", () => {
    const landscape = [
      [0, 0],
      [40, 0],
      [40, 10],
      [0, 10],
    ];
    expect(fitTrack(landscape, 0)?.width).toBeGreaterThan(
      fitTrack(landscape, 0)?.height ?? 0,
    );
    expect(fitTrack(landscape, 90)?.width).toBeGreaterThan(
      fitTrack(landscape, 90)?.height ?? 0,
    );
  });

  it("returns nothing without a usable polyline", () => {
    expect(fitTrack([], 0)).toBeNull();
    expect(fitTrack([[0, 0]], 0)).toBeNull();
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

describe("projectionFor", () => {
  it("centres the box the way xMidYMid meet does", () => {
    const track = fitTrack(PORTRAIT, 0);
    if (!track) throw new Error("expected a fitted track");
    const projection = projectionFor({ width: 400, height: 400 }, track);
    expect(projection.scale).toBeCloseTo(400 / track.width, 5);
    expect(projection.offsetX).toBeCloseTo(0, 5);
    expect(projection.offsetY).toBeGreaterThan(0);
  });
});
