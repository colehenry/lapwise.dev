export { COMPOUND_COLORS, getCompoundColor } from "@/lib/palette";

export const formatLapTime = (seconds: number | null | undefined) => {
  if (seconds == null) return "-";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toFixed(3).padStart(6, "0")}`;
};

export const maxLapNumber = (
  drivers: { laps: { lap_number: number }[] }[],
): number =>
  Math.max(
    0,
    ...drivers.flatMap((driver) => driver.laps.map((lap) => lap.lap_number)),
  );

/**
 * Draws text the right way up inside a y-flipped canvas transform.
 *
 * Track coordinates put y upward the way the telemetry records it, so the
 * canvas is scaled by -1 on that axis to match. Glyphs would come out mirrored
 * without undoing the flip around their own origin.
 */
export const drawUprightText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, -1);
  ctx.fillText(text, 0, 0);
  ctx.restore();
};
