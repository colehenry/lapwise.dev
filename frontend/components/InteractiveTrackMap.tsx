"use client";

import { useQuery } from "@tanstack/react-query";
import { type RefObject, useEffect, useMemo, useRef } from "react";
import { useTheme } from "@/components/ThemeProvider";
import TrackMapImage from "@/components/TrackMapImage";
import { replayTrackQuery } from "@/lib/queries/replay";
import type { ReplayTrack } from "@/lib/types";

function DotGridPattern({ id = "track-dot-grid" }: { id?: string }) {
  return (
    <svg
      className="absolute inset-0 w-full h-full opacity-[0.07] pointer-events-none"
      aria-hidden="true"
    >
      <title>Dot grid pattern</title>
      <defs>
        <pattern id={id} width="16" height="16" patternUnits="userSpaceOnUse">
          <circle
            cx="1"
            cy="1"
            r="0.8"
            fill="currentColor"
            className="text-purple-400"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

interface InteractiveTrackMapProps {
  circuitId: number;
  circuitName: string;
  trackLengthKm?: number | null;
  location?: string;
}

const TRACK_WIDTH = 8;

function getTrackPalette(theme: "dark" | "light") {
  if (theme === "dark") {
    return {
      trackColor: "rgba(255, 255, 255, 0.88)",
      trackGlowColor: "rgba(255, 255, 255, 0.10)",
      shadowColor: "rgba(255, 255, 255, 0.22)",
      sfLineColor: "rgba(255, 255, 255, 0.72)",
      cornerLabelColor: "rgba(196, 184, 214, 0.9)",
      cornerLabelShadowColor: "rgba(8, 8, 14, 0.72)",
    };
  }

  return {
    trackColor: "rgba(61, 72, 92, 0.9)",
    trackGlowColor: "rgba(83, 93, 117, 0.08)",
    shadowColor: "rgba(83, 93, 117, 0.12)",
    sfLineColor: "rgba(71, 85, 105, 0.75)",
    cornerLabelColor: "rgba(82, 89, 112, 0.94)",
    cornerLabelShadowColor: "rgba(244, 246, 250, 0.98)",
  };
}

export default function InteractiveTrackMap({
  circuitId,
  circuitName,
  trackLengthKm,
  location,
}: InteractiveTrackMapProps) {
  const { theme } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const palette = useMemo(() => getTrackPalette(theme), [theme]);
  const { data } = useQuery(replayTrackQuery(circuitId));

  const track = data?.track ?? null;

  return (
    <div
      className="bg-bg-tertiary rounded-sm border border-border-primary relative overflow-hidden min-h-[350px] md:min-h-[400px]"
      style={
        theme === "dark"
          ? {
              background:
                "radial-gradient(ellipse at center, rgba(160, 32, 240, 0.08) 0%, rgba(160, 32, 240, 0.02) 50%, transparent 80%)",
            }
          : undefined
      }
    >
      <DotGridPattern id={`circuit-detail-dots-${circuitId}`} />

      {trackLengthKm && (
        <div className="absolute top-4 left-5 z-20 flex items-center gap-1.5">
          <span
            className={`text-[9px] font-mono font-bold tracking-widest uppercase ${
              theme === "dark" ? "text-purple-400/80" : "text-text-tertiary"
            }`}
          >
            {trackLengthKm.toFixed(3)} km
          </span>
          <div
            className={`h-px w-6 ${
              theme === "dark" ? "bg-purple-500/30" : "bg-border-secondary"
            }`}
          />
        </div>
      )}

      {location && (
        <div className="absolute bottom-4 right-5 z-20 flex items-center gap-1.5">
          <div
            className={`h-px w-6 ${
              theme === "dark" ? "bg-purple-500/30" : "bg-border-secondary"
            }`}
          />
          <span
            className={`text-[9px] font-mono font-bold tracking-widest uppercase ${
              theme === "dark" ? "text-purple-400/80" : "text-text-tertiary"
            }`}
          >
            {location}
          </span>
        </div>
      )}

      {track ? (
        <ReplayTrackCanvas
          track={track}
          canvasRef={canvasRef}
          palette={palette}
        />
      ) : (
        <StaticTrackFallback
          circuitId={circuitId}
          circuitName={circuitName}
          theme={theme}
        />
      )}
    </div>
  );
}

function ReplayTrackCanvas({
  track,
  canvasRef,
  palette,
}: {
  track: ReplayTrack;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  palette: ReturnType<typeof getTrackPalette>;
}) {
  const bounds = useMemo(() => {
    if (!track.polyline.length) return null;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const [x, y] of track.polyline) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }

    for (const corner of track.corners ?? []) {
      minX = Math.min(minX, corner.x);
      minY = Math.min(minY, corner.y);
      maxX = Math.max(maxX, corner.x);
      maxY = Math.max(maxY, corner.y);
    }

    return { minX, minY, maxX, maxY };
  }, [track]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !bounds || track.polyline.length < 2) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const padding = 46;
    const trackW = bounds.maxX - bounds.minX || 1;
    const trackH = bounds.maxY - bounds.minY || 1;
    const scale = Math.min(
      (rect.width - padding * 2) / trackW,
      (rect.height - padding * 2) / trackH,
    );
    const offsetX = (rect.width - trackW * scale) / 2 - bounds.minX * scale;
    const offsetY = (rect.height - trackH * scale) / 2 - bounds.minY * scale;

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    const path = new Path2D();
    path.moveTo(track.polyline[0][0], track.polyline[0][1]);
    for (let i = 1; i < track.polyline.length; i++) {
      path.lineTo(track.polyline[i][0], track.polyline[i][1]);
    }

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = palette.trackGlowColor;
    ctx.lineWidth = (TRACK_WIDTH + 12) / scale;
    ctx.shadowColor = palette.shadowColor;
    ctx.shadowBlur = 22 / scale;
    ctx.stroke(path);

    ctx.shadowBlur = 0;
    ctx.strokeStyle = palette.trackColor;
    ctx.lineWidth = TRACK_WIDTH / scale;
    ctx.stroke(path);

    drawStartFinishLine(ctx, track.polyline, scale, palette.sfLineColor);
    drawCornerLabels(
      ctx,
      track,
      scale,
      palette.cornerLabelColor,
      palette.cornerLabelShadowColor,
    );

    ctx.restore();
  }, [bounds, canvasRef, palette, track]);

  return (
    <canvas
      ref={canvasRef}
      className="relative z-10 block h-[350px] md:h-[400px] w-full"
      aria-label="Replay-derived circuit map with start finish line"
    />
  );
}

function drawStartFinishLine(
  ctx: CanvasRenderingContext2D,
  polyline: [number, number][],
  scale: number,
  color: string,
) {
  const start = polyline[0];
  const next = polyline[1];
  const dx = next[0] - start[0];
  const dy = next[1] - start[1];
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len <= 0) return;

  const px = -dy / len;
  const py = dx / len;
  const halfWidth = 14 / scale;

  ctx.strokeStyle = color;
  ctx.lineWidth = 3 / scale;
  ctx.setLineDash([3 / scale, 3 / scale]);
  ctx.beginPath();
  ctx.moveTo(start[0] - px * halfWidth, start[1] - py * halfWidth);
  ctx.lineTo(start[0] + px * halfWidth, start[1] + py * halfWidth);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawCornerLabels(
  ctx: CanvasRenderingContext2D,
  track: ReplayTrack,
  scale: number,
  labelColor: string,
  shadowColor: string,
) {
  if (!track.corners?.length) return;

  ctx.strokeStyle = shadowColor;
  ctx.lineWidth = 2 / scale;
  ctx.fillStyle = labelColor;
  ctx.shadowColor = shadowColor;
  ctx.shadowBlur = 0.75 / scale;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.font = `600 ${8.5 / scale}px ui-sans-serif, Inter, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (const corner of track.corners) {
    const label = corner.letter
      ? `${corner.number}${corner.letter}`
      : String(corner.number);
    ctx.strokeText(label, corner.x, corner.y);
    ctx.fillText(label, corner.x, corner.y);
  }

  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

function StaticTrackFallback({
  circuitId,
  circuitName,
  theme,
}: {
  circuitId: number;
  circuitName: string;
  theme: "dark" | "light";
}) {
  return (
    <div className="relative z-10 h-[350px] md:h-[400px] w-full">
      <TrackMapImage
        circuitId={circuitId}
        circuitName={circuitName}
        fill
        className="object-contain p-8"
        fallbackClassName="h-full w-full px-4"
        draggable={false}
        style={
          theme === "dark"
            ? {
                filter:
                  "drop-shadow(0 0 12px rgba(160, 32, 240, 0.35)) drop-shadow(0 0 30px rgba(160, 32, 240, 0.12))",
              }
            : undefined
        }
      />
    </div>
  );
}
