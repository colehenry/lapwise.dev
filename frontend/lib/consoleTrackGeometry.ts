export type FittedTrack = {
  /** Polyline in viewBox coordinates, origin at the top-left of the box. */
  polyline: number[][];
  width: number;
  height: number;
  /** One percent of the longer span, for stroke widths and marker radii. */
  unit: number;
};

/** Five percent of the longer span, so the ribbon never touches the edge. */
const PAD_FRACTION = 0.05;

function rotate(points: number[][], degrees: number) {
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const rotated = points.map(([x, y]) => [
    x * cos - y * sin,
    x * sin + y * cos,
  ]);
  const xs = rotated.map((p) => p[0]);
  const ys = rotated.map((p) => p[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return {
    points: rotated,
    minX,
    minY,
    spanX: Math.max(...xs) - minX,
    spanY: Math.max(...ys) - minY,
  };
}

/**
 * Lands the circuit landscape and boxes it to its own bounds. The canonical
 * rotation leaves some circuits portrait, which wastes half of a wide panel,
 * so both orientations are measured and the wider one wins.
 */
export function fitTrack(
  polyline: number[][],
  rotationDegrees: number | null | undefined,
): FittedTrack | null {
  if (!polyline || polyline.length < 2) return null;
  const base = rotationDegrees ?? 0;
  const upright = rotate(polyline, base);
  const turned = rotate(polyline, base + 90);
  const fit = upright.spanX >= upright.spanY ? upright : turned;

  const pad = Math.max(fit.spanX, fit.spanY) * PAD_FRACTION;
  const width = fit.spanX + pad * 2;
  const height = fit.spanY + pad * 2;

  return {
    polyline: fit.points.map(([x, y]) => [
      x - fit.minX + pad,
      y - fit.minY + pad,
    ]),
    width,
    height,
    unit: Math.max(width, height) / 100,
  };
}

/** The `d` of a closed path through every polyline point. */
export function trackPath(polyline: number[][]): string {
  return `M ${polyline
    .map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" L ")} Z`;
}

export type ViewBoxProjection = {
  scale: number;
  offsetX: number;
  offsetY: number;
};

/**
 * Maps viewBox coordinates onto the rendered box, matching what
 * `preserveAspectRatio="xMidYMid meet"` does, so an overlay can sit on a point
 * of the track.
 */
export function projectionFor(
  box: { width: number; height: number },
  track: FittedTrack,
): ViewBoxProjection {
  const scale = Math.min(box.width / track.width, box.height / track.height);
  return {
    scale,
    offsetX: (box.width - track.width * scale) / 2,
    offsetY: (box.height - track.height * scale) / 2,
  };
}
