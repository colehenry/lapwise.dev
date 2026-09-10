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
 */
export default function CircuitOutline({
  circuitId,
  circuitName,
  className = "",
  opacity = 1,
}: {
  circuitId: number | null | undefined;
  circuitName: string;
  className?: string;
  opacity?: number;
}) {
  const { data } = useQuery({
    ...replayTrackQuery(circuitId ?? 0),
    enabled: typeof circuitId === "number",
  });

  const track = useMemo(() => {
    const polyline = data?.track?.polyline;
    if (!polyline) return null;
    return fitTrack(polyline);
  }, [data]);

  if (track) {
    return (
      <svg
        className={className}
        viewBox={`0 0 ${track.width.toFixed(1)} ${track.height.toFixed(1)}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`${circuitName} circuit map`}
        style={{ opacity }}
      >
        <title>{circuitName}</title>
        <path
          d={trackPath(track.polyline)}
          fill="none"
          stroke="var(--canvas-track)"
          strokeWidth={track.unit * 0.4}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (hasStaticTrackMap(circuitId)) {
    return (
      <TrackMapImage
        circuitId={circuitId}
        circuitName={circuitName}
        fill
        sizes="220px"
        className={`object-contain ${className}`}
        style={{ opacity }}
      />
    );
  }

  return null;
}
