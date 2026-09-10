"use client";

import { useEffect, useRef } from "react";
import DriverHeadshot from "@/components/entities/DriverHeadshot";
import type { RaceClockController } from "@/hooks/useRaceClock";
import { useTeamTint } from "@/hooks/useTeamTint";
import type {
  FittedTrack,
  ViewBoxProjection,
} from "@/lib/consoleTrackGeometry";
import { projectionFor } from "@/lib/consoleTrackGeometry";
import { pointAt } from "@/lib/raceClockMath";

type Box = { width: number; height: number };

/** Clearance from the map's edges, so the card never sits half outside. */
const EDGE = 8;
/** How far the card rides from the leader's marker. */
const STANDOFF = 26;

type LeaderTooltipProps = {
  clock: RaceClockController;
  track: FittedTrack;
  boxRef: React.RefObject<Box>;
};

/**
 * Rides the leader and flips side near the edges. It names the car and nothing
 * more — the running order above it already carries the gap, the tyre and the
 * last lap, and a card repeating them was the third caption on one canvas.
 */
export default function LeaderTooltip({
  clock,
  track,
  boxRef,
}: LeaderTooltipProps) {
  const tint = useTeamTint();
  const cardRef = useRef<HTMLDivElement | null>(null);
  const { subscribe } = clock;
  const leader = clock.frame?.leader;
  const hasLeader = leader != null;

  useEffect(() => {
    if (!hasLeader) return;
    let projection: ViewBoxProjection | null = null;
    let lastWidth = 0;
    let lastHeight = 0;

    return subscribe((frame) => {
      const card = cardRef.current;
      const box = boxRef.current;
      if (!card || !box || box.width === 0) return;

      if (box.width !== lastWidth || box.height !== lastHeight) {
        lastWidth = box.width;
        lastHeight = box.height;
        projection = projectionFor(box, track);
      }
      if (!projection) return;

      const point = pointAt(track.polyline, frame.leader.progress);
      if (!point) return;

      const x = projection.offsetX + point[0] * projection.scale;
      const y = projection.offsetY + point[1] * projection.scale;
      const half = (card.offsetWidth || 140) / 2;
      const side = x > box.width / 2 ? -1 : 1;

      card.style.left = `${Math.max(
        half + EDGE,
        Math.min(box.width - half - EDGE, x + side * (half + STANDOFF)),
      )}px`;
      card.style.top = `${Math.max(30, Math.min(box.height - 30, y))}px`;
    });
  }, [subscribe, track, boxRef, hasLeader]);

  if (!leader) return null;

  return (
    <div
      ref={cardRef}
      aria-hidden="true"
      className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 whitespace-nowrap rounded-sm border py-1 pl-1 pr-2.5"
      style={{
        left: "50%",
        top: "50%",
        background: "var(--glass-surface)",
        borderColor: "var(--glass-border)",
      }}
    >
      <DriverHeadshot
        code={leader.car.driver_code}
        fullName={leader.car.full_name}
        src={leader.car.headshot_url}
        size={24}
        shape="circle"
        bordered={false}
        focalY={0.12}
      />
      <span
        className="text-[12px] font-bold tracking-[-0.01em]"
        style={{ color: tint(leader.car.team_color) }}
      >
        {leader.car.full_name}
      </span>
    </div>
  );
}
