"use client";
import { useMemo } from "react";

type Props = {
  polyline: [number, number][] | undefined;
  rotation?: number;
  className?: string;
  strokeWidth?: number;
};

/**
 * A circuit drawn from its real polyline, fitted to its own bounding box so the
 * shape fills the frame. Inherits `currentColor`, so the caller sets the tone.
 */
export default function TrackOutline({
  polyline,
  rotation = 0,
  className = "",
  strokeWidth = 3,
}: Props) {
  const path = useMemo(() => {
    if (!polyline?.length) return null;
    const rad = (rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const spun = polyline.map(([x, y]) => [
      x * cos - y * sin,
      x * sin + y * cos,
    ]);

    const xs = spun.map((p) => p[0]);
    const ys = spun.map((p) => p[1]);
    const x0 = Math.min(...xs);
    const y0 = Math.min(...ys);
    const w = Math.max(...xs) - x0 || 1;
    const h = Math.max(...ys) - y0 || 1;
    const scale = Math.min(92 / w, 92 / h);
    const ox = (100 - w * scale) / 2;
    const oy = (100 - h * scale) / 2;

    return spun
      .map(([x, y], i) => {
        const px = ((x - x0) * scale + ox).toFixed(2);
        const py = ((y - y0) * scale + oy).toFixed(2);
        return `${i ? "L" : "M"}${px} ${py}`;
      })
      .join("")
      .concat("Z");
  }, [polyline, rotation]);

  if (!path) {
    return (
      <div
        className={`rounded-sm bg-bg-elevated/40 ${className}`}
        aria-hidden="true"
      />
    );
  }

  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <title>Circuit outline</title>
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
    </svg>
  );
}
