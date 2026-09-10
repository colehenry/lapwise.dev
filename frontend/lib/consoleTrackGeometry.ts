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

/**
 * Boxes a circuit to its own bounds.
 *
 * The polyline arrives already rotated: the ingest applies `rotation_deg`
 * before storing it, which is why the replay page plots it untouched. Applying
 * that rotation again here turned Monza through 95 degrees, and the fit then
 * spun it 90 more to force it landscape — a net half-turn, which read as the
 * track being mirrored.
 */
export function fitTrack(polyline: number[][]): FittedTrack | null {
  if (!polyline || polyline.length < 2) return null;

  /* The stored coordinates put y upward, the way the telemetry records them.
     SVG puts y downward, so drawing them untouched mirrors the circuit. Negating
     y is the whole correction: checked against Monza's official map, corners 1,
     7 and 11 land within a few percent of where they belong, where a half-turn
     put 1 and 11 on the wrong sides. Bounds are taken after the flip, so this
     reorients and never rescales. */
  const turned = polyline.map(([x, y]) => [x, -y]);

  const xs = turned.map((point) => point[0]);
  const ys = turned.map((point) => point[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const spanX = Math.max(...xs) - minX;
  const spanY = Math.max(...ys) - minY;

  const pad = Math.max(spanX, spanY) * PAD_FRACTION;
  const width = spanX + pad * 2;
  const height = spanY + pad * 2;

  return {
    polyline: turned.map(([x, y]) => [x - minX + pad, y - minY + pad]),
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
