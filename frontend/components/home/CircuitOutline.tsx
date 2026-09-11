"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import TrackMapImage from "@/components/track/TrackMapImage";
import { fitTrack, trackPath } from "@/lib/consoleTrackGeometry";
import { replayTrackQuery } from "@/lib/queries/replay";
import { hasStaticTrackMap } from "@/lib/trackMapAssets";

/**
 * The shape of a circuit, in three falling-back sources: the replay polyline,
 * which is theme-aware SVG and covers anything with lap data; the static PNG
 * set, which stops at circuit 35; and nothing at all.
 *
 * Nothing at all is deliberate. `TrackMapImage`'s own fallback renders the
 * words "No map available", which is worse than an empty corner.
 *
 * The box is owned here, not by the caller. The PNG branch is a `fill` image,
 * which positions against the nearest positioned ancestor — without one it
 * fills the viewport. Every branch renders inside the same relative box so
 * the caller's sizing applies whichever source wins.
 */
export default function CircuitOutline({
  circuitId,
  circuitName,
  className = "",
  opacity = 1,
  stroke = "var(--line-strong)",
  strokeWidth = 1.25,
}: {
  circuitId: number | null | undefined;
  circuitName: string;
  className?: string;
  opacity?: number;
  /** `--canvas-track` is tuned for a near-black canvas, not a panel. */
  stroke?: string;
  /** Screen pixels, not viewBox units — see the note on the path below. */
  strokeWidth?: number;
}) {
  const { data, isSuccess, isError } = useQuery({
    ...replayTrackQuery(circuitId ?? 0),
    enabled: typeof circuitId === "number",
  });

  const track = useMemo(() => {
    const polyline = data?.track?.polyline;
    if (!polyline) return null;
    return fitTrack(polyline);
  }, [data]);

  /* The PNG stands in only once the polyline has been asked for and refused;
     showing it while the request is in flight flashes a different drawing
     for the first paint. */
  const settledWithoutTrack = !track && (isSuccess || isError);

  if (!track && !(settledWithoutTrack && hasStaticTrackMap(circuitId))) {
    return null;
  }

  return (
    <div className={`relative ${className}`} style={{ opacity }}>
      {track ? (
        <svg
          className="h-full w-full"
          viewBox={`0 0 ${track.width.toFixed(1)} ${track.height.toFixed(1)}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={`${circuitName} circuit map`}
        >
          <title>{circuitName}</title>
          {/* Circuits differ in shape, so a viewBox-relative stroke scaled to a
              different width on every card — 0.19px for Budapest against 0.27px
              for Monza. A non-scaling stroke draws them all at one weight. */}
          <path
            d={trackPath(track.polyline)}
            fill="none"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      ) : (
        <TrackMapImage
          circuitId={circuitId}
          circuitName={circuitName}
          fill
          sizes="220px"
          className="object-contain"
        />
      )}
    </div>
  );
}
