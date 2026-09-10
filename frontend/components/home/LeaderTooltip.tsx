"use client";

import { useEffect, useRef } from "react";
import DriverHeadshot from "@/components/entities/DriverHeadshot";
import type { RaceClockController } from "@/hooks/useRaceClock";
import { gapLabel, seconds3, teamTint } from "@/lib/consoleFormat";
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
 * Rides the leader and flips side near the edges. Everything it says is about
 * the car it is pointing at, so nothing else on the map has to caption itself.
 */
export default function LeaderTooltip({
  clock,
  track,
  boxRef,
}: LeaderTooltipProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const gapRef = useRef<HTMLSpanElement | null>(null);
  const lapRef = useRef<HTMLSpanElement | null>(null);
  const tyreRef = useRef<HTMLSpanElement | null>(null);

  const { subscribe } = clock;
  const leader = clock.frame?.leader;

  useEffect(() => {
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
      const half = (card.offsetWidth || 200) / 2;
      const side = x > box.width / 2 ? -1 : 1;

      card.style.left = `${Math.max(
        half + EDGE,
        Math.min(box.width - half - EDGE, x + side * (half + STANDOFF)),
      )}px`;
      card.style.top = `${Math.max(44, Math.min(box.height - 44, y))}px`;

      const runningLap = frame.leader.car.laps[frame.leader.lapIndex];
      const completed =
        frame.leader.car.laps[Math.max(0, frame.leader.lapIndex - 1)] ??
        runningLap;
      const second = frame.order[1];

      if (gapRef.current) {
        gapRef.current.textContent = second
          ? `${gapLabel(second.gapSeconds)} to P2`
          : "Leading";
      }
      if (lapRef.current) lapRef.current.textContent = seconds3(completed?.t);
      if (tyreRef.current) {
        tyreRef.current.textContent = runningLap
          ? `${runningLap.c} ${runningLap.age ?? "?"}`
          : "";
      }
    });
  }, [subscribe, track, boxRef]);

  if (!leader) return null;

  return (
    <div
      ref={cardRef}
      aria-hidden="true"
      className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-2.5 whitespace-nowrap rounded-md border px-2.5 py-2 backdrop-blur-md"
      style={{
        left: "50%",
        top: "50%",
        background: "var(--glass-surface)",
        borderColor: "var(--glass-border)",
        boxShadow: "var(--shadow-floating)",
      }}
    >
      <DriverHeadshot
        code={leader.car.driver_code}
        fullName={leader.car.full_name}
        src={leader.car.headshot_url}
        size={38}
        focalY={0.14}
        bordered={false}
      />
      <div className="min-w-0">
        <div
          className="text-[13.5px] font-bold leading-tight tracking-[-0.01em]"
          style={{ color: teamTint(leader.car.team_color) }}
        >
          {leader.car.full_name}
        </div>
        <div className="mt-1 flex items-center gap-2 font-mono text-[11px] text-ink-base tabular-nums">
          <span ref={gapRef} />
          <span className="text-line-strong">·</span>
          <span ref={lapRef} />
          <span className="text-line-strong">·</span>
          <span ref={tyreRef} className="text-ink-soft" />
        </div>
      </div>
    </div>
  );
}
