"use client";

import Link from "next/link";
import { useMemo } from "react";
import { fitTrack, trackPath } from "@/lib/consoleTrackGeometry";

/**
 * The circuit, drawn still. Stands in for the replay when no recent round has
 * published lap data, so the panel keeps its frame rather than going hollow.
 */
export default function TrackOutline({
  polyline,
  rotationDegrees,
  circuitName,
  message,
  href,
  linkLabel,
}: {
  polyline: number[][] | undefined;
  rotationDegrees: number | null | undefined;
  circuitName: string;
  message: string;
  href?: string;
  linkLabel?: string;
}) {
  const track = useMemo(
    () => (polyline ? fitTrack(polyline, rotationDegrees) : null),
    [polyline, rotationDegrees],
  );

  return (
    <div
      className="relative flex h-full min-h-[280px] w-full flex-col justify-end overflow-hidden rounded-[3px] p-4"
      style={{
        background:
          "linear-gradient(160deg, var(--canvas-bg-start), var(--canvas-bg-end))",
      }}
    >
      {track && (
        <svg
          className="absolute inset-0 h-full w-full opacity-70"
          viewBox={`0 0 ${track.width.toFixed(1)} ${track.height.toFixed(1)}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={`${circuitName} circuit map`}
        >
          <title>{circuitName}</title>
          <path
            d={trackPath(track.polyline)}
            fill="none"
            stroke="var(--canvas-track)"
            strokeWidth={track.unit * 0.28}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
      )}
      <div className="relative max-w-[46ch]">
        <p className="m-0 text-[17px] font-bold leading-tight tracking-[-0.02em] text-ink-strong">
          {circuitName}
        </p>
        <p className="m-0 mt-1.5 text-[12.5px] leading-relaxed text-ink-soft">
          {message}
        </p>
        {href && linkLabel && (
          <Link
            href={href}
            className="mt-2 inline-block font-mono text-[9.5px] uppercase tracking-[0.14em] text-accent-light underline-offset-2 hover:underline"
          >
            {linkLabel}
          </Link>
        )}
      </div>
    </div>
  );
}
