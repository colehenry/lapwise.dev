"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ReplayDriverFrame,
  ReplayDriverInfo,
  ReplayFrame,
  ReplayTrack,
} from "@/lib/types";

interface TrackCanvasProps {
  track: ReplayTrack;
  drivers: Record<string, ReplayDriverInfo>;
  frame: ReplayFrame | undefined;
  selectedDriver: string | null;
  onSelectDriver: (code: string | null) => void;
}

const PADDING = 40;
const DRIVER_RADIUS = 6;
const SELECTED_RADIUS = 9;
const TRACK_WIDTH = 8;
const TRACK_COLOR = "rgba(255, 255, 255, 0.12)";
const SF_LINE_COLOR = "rgba(255, 255, 255, 0.4)";

export default function TrackCanvas({
  track,
  drivers,
  frame,
  selectedDriver,
  onSelectDriver,
}: TrackCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });
  const trackPathRef = useRef<Path2D | null>(null);
  const hoveredDriverRef = useRef<string | null>(null);
  const [_hoveredDriver, setHoveredDriver] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    code: string;
  } | null>(null);

  // Compute scale/offset to map [0, 1000] track coords to canvas
  const getTransform = useCallback(
    (width: number, height: number) => {
      const polyline = track.polyline;
      if (!polyline.length) return { scale: 1, offsetX: 0, offsetY: 0 };

      const usableW = width - PADDING * 2;
      const usableH = height - PADDING * 2;
      const scale = Math.min(usableW / 1000, usableH / 1000);
      const offsetX = (width - 1000 * scale) / 2;
      const offsetY = (height - 1000 * scale) / 2;

      return { scale, offsetX, offsetY };
    },
    [track.polyline],
  );

  // Build Path2D for track polyline (cached)
  useEffect(() => {
    const polyline = track.polyline;
    if (!polyline.length) return;

    const path = new Path2D();
    path.moveTo(polyline[0][0], polyline[0][1]);
    for (let i = 1; i < polyline.length; i++) {
      path.lineTo(polyline[i][0], polyline[i][1]);
    }
    path.closePath();
    trackPathRef.current = path;
  }, [track.polyline]);

  // ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        // Maintain aspect ratio based on track bounds
        const height = Math.min(width * 0.65, 600);
        setDimensions({ width, height });
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = dimensions;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Clear
    ctx.clearRect(0, 0, width, height);

    const { scale, offsetX, offsetY } = getTransform(width, height);

    // Apply transform
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    // Draw track polyline
    if (trackPathRef.current) {
      ctx.strokeStyle = TRACK_COLOR;
      ctx.lineWidth = TRACK_WIDTH / scale;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke(trackPathRef.current);
    }

    // Draw start/finish marker
    if (track.polyline.length > 1) {
      const sf = track.polyline[0];
      ctx.fillStyle = SF_LINE_COLOR;
      ctx.beginPath();
      ctx.arc(sf[0], sf[1], 4 / scale, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw drivers
    if (frame) {
      const driverEntries = Object.entries(frame.d);

      // Draw non-selected drivers first
      for (const [code, data] of driverEntries) {
        if (code === selectedDriver || code === hoveredDriverRef.current)
          continue;
        drawDriver(ctx, code, data, drivers[code], scale, false);
      }

      // Draw hovered driver
      if (
        hoveredDriverRef.current &&
        hoveredDriverRef.current !== selectedDriver &&
        frame.d[hoveredDriverRef.current]
      ) {
        drawDriver(
          ctx,
          hoveredDriverRef.current,
          frame.d[hoveredDriverRef.current],
          drivers[hoveredDriverRef.current],
          scale,
          true,
        );
      }

      // Draw selected driver on top
      if (selectedDriver && frame.d[selectedDriver]) {
        drawDriver(
          ctx,
          selectedDriver,
          frame.d[selectedDriver],
          drivers[selectedDriver],
          scale,
          true,
        );
      }

      // Draw safety car
      if (frame.sc > 0) {
        drawSafetyCar(ctx, frame, scale);
      }
    }

    ctx.restore();
  }, [dimensions, frame, track, drivers, selectedDriver, getTransform]);

  // Mouse handling
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!frame || !canvasRef.current) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const { scale, offsetX, offsetY } = getTransform(
        dimensions.width,
        dimensions.height,
      );

      // Convert mouse to track coords
      const trackX = (mouseX - offsetX) / scale;
      const trackY = (mouseY - offsetY) / scale;

      // Hit test each driver
      let closest: string | null = null;
      let closestDist = Number.POSITIVE_INFINITY;
      const hitRadius = 15 / scale;

      for (const [code, data] of Object.entries(frame.d)) {
        const dx = data[0] - trackX;
        const dy = data[1] - trackY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < hitRadius && dist < closestDist) {
          closest = code;
          closestDist = dist;
        }
      }

      hoveredDriverRef.current = closest;
      setHoveredDriver(closest);

      if (closest && frame.d[closest]) {
        const driverData = frame.d[closest];
        const screenX = driverData[0] * scale + offsetX;
        const screenY = driverData[1] * scale + offsetY;
        setTooltip({ x: screenX, y: screenY, code: closest });
      } else {
        setTooltip(null);
      }

      canvasRef.current.style.cursor = closest ? "pointer" : "default";
    },
    [frame, dimensions, getTransform],
  );

  const handleClick = useCallback(() => {
    if (hoveredDriverRef.current) {
      onSelectDriver(
        hoveredDriverRef.current === selectedDriver
          ? null
          : hoveredDriverRef.current,
      );
    } else {
      onSelectDriver(null);
    }
  }, [onSelectDriver, selectedDriver]);

  const handleMouseLeave = useCallback(() => {
    hoveredDriverRef.current = null;
    setHoveredDriver(null);
    setTooltip(null);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full">
      <canvas
        ref={canvasRef}
        style={{ width: dimensions.width, height: dimensions.height }}
        className="block"
        onMouseMove={handleMouseMove}
        onClick={handleClick}
        onMouseLeave={handleMouseLeave}
      />
      {/* Tooltip */}
      {tooltip && drivers[tooltip.code] && frame?.d[tooltip.code] && (
        <DriverTooltip
          x={tooltip.x}
          y={tooltip.y}
          code={tooltip.code}
          driver={drivers[tooltip.code]}
          data={frame.d[tooltip.code]}
          containerWidth={dimensions.width}
        />
      )}
    </div>
  );
}

function drawDriver(
  ctx: CanvasRenderingContext2D,
  code: string,
  data: ReplayDriverFrame,
  info: ReplayDriverInfo | undefined,
  scale: number,
  isHighlighted: boolean,
) {
  const [x, y] = data;
  const color = info ? `#${info.color}` : "#999";
  const radius = (isHighlighted ? SELECTED_RADIUS : DRIVER_RADIUS) / scale;

  // Glow for highlighted
  if (isHighlighted) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 12 / scale;
  }

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;

  // Label for highlighted drivers
  if (isHighlighted) {
    ctx.font = `bold ${11 / scale}px monospace`;
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(code, x, y - radius - 3 / scale);
  }
}

function drawSafetyCar(
  ctx: CanvasRenderingContext2D,
  frame: ReplayFrame,
  scale: number,
) {
  // Find leader position to place SC nearby
  let leaderX = 0;
  let leaderY = 0;
  let leaderFound = false;

  for (const [, data] of Object.entries(frame.d)) {
    if (data[8] === 1) {
      leaderX = data[0];
      leaderY = data[1];
      leaderFound = true;
      break;
    }
  }

  if (!leaderFound) return;

  const scColor = frame.sc === 1 ? "#FFA500" : "#FFD700"; // SC = orange, VSC = gold
  const radius = 8 / scale;

  // Pulsing effect via simple alpha
  ctx.globalAlpha = 0.8;
  ctx.fillStyle = scColor;
  ctx.beginPath();
  ctx.arc(leaderX + 15 / scale, leaderY - 15 / scale, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = `bold ${9 / scale}px monospace`;
  ctx.fillStyle = "#000";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(
    frame.sc === 1 ? "SC" : "VSC",
    leaderX + 15 / scale,
    leaderY - 15 / scale,
  );

  ctx.globalAlpha = 1;
}

const COMPOUND_COLORS: Record<number, string> = {
  0: "#FF3333",
  1: "#FFD700",
  2: "#FFFFFF",
  3: "#33CC33",
  4: "#3399FF",
};

const COMPOUND_LABELS: Record<number, string> = {
  0: "S",
  1: "M",
  2: "H",
  3: "I",
  4: "W",
};

function DriverTooltip({
  x,
  y,
  code,
  driver,
  data,
  containerWidth,
}: {
  x: number;
  y: number;
  code: string;
  driver: ReplayDriverInfo;
  data: ReplayDriverFrame;
  containerWidth: number;
}) {
  const [, , speed, gear, drs, compound, tyreLife, _lap, position] = data;
  const flipX = x > containerWidth - 180;

  return (
    <div
      className="absolute pointer-events-none bg-bg-primary/95 backdrop-blur-sm border border-border-primary rounded-sm px-3 py-2 text-xs z-10"
      style={{
        left: flipX ? x - 170 : x + 12,
        top: Math.max(y - 60, 8),
      }}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <div
          className="w-2.5 h-2.5 rounded-full"
          style={{ backgroundColor: `#${driver.color}` }}
        />
        <span className="font-semibold text-text-primary font-mono">
          {code}
        </span>
        <span className="text-text-muted">P{position}</span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-text-secondary font-mono">
        <span>Speed</span>
        <span className="text-text-primary">{Math.round(speed)} km/h</span>
        <span>Gear</span>
        <span className="text-text-primary">{gear}</span>
        <span>DRS</span>
        <span className={drs ? "text-green-400" : "text-text-muted"}>
          {drs ? "OPEN" : "OFF"}
        </span>
        <span>Tyre</span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ backgroundColor: COMPOUND_COLORS[compound] ?? "#999" }}
          />
          <span className="text-text-primary">
            {COMPOUND_LABELS[compound] ?? "?"} ({tyreLife}L)
          </span>
        </span>
      </div>
    </div>
  );
}
