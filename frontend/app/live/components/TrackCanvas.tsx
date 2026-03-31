"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isValidHeadshotUrl } from "@/lib/api";
import type {
  ReplayCorner,
  ReplayDriverFrame,
  ReplayDriverInfo,
  ReplayFrame,
  ReplayTrack,
} from "@/lib/types";

export interface TrackTooltipData {
  screenX: number;
  screenY: number;
  code: string;
  driver: ReplayDriverInfo;
  data: ReplayDriverFrame;
}

interface TrackCanvasProps {
  track: ReplayTrack;
  drivers: Record<string, ReplayDriverInfo>;
  frame: ReplayFrame | undefined;
  selectedDriver: string | null;
  highlightedDriver?: string | null;
  scState?: number;
  drsEnabled?: boolean;
  showCorners?: boolean;
  onSelectDriver: (code: string | null) => void;
  onTooltipChange?: (tooltip: TrackTooltipData | null) => void;
}

const PADDING = 20;
const DRIVER_RADIUS = 6;
const SELECTED_RADIUS = 9;
const TRACK_WIDTH = 8;
const TRACK_COLOR = "rgba(255, 255, 255, 0.12)";
const SF_LINE_COLOR = "rgba(255, 255, 255, 0.5)";
const DRS_ZONE_COLOR_ACTIVE = "rgba(0, 220, 80, 0.35)";
const DRS_ZONE_COLOR_INACTIVE = "rgba(0, 220, 80, 0.10)";
const CORNER_LABEL_COLOR = "rgba(255, 255, 255, 0.35)";
const CORNER_LABEL_FONT_SIZE = 9;

export default function TrackCanvas({
  track,
  drivers,
  frame,
  selectedDriver,
  highlightedDriver,
  scState = 0,
  drsEnabled = false,
  showCorners = true,
  onSelectDriver,
  onTooltipChange,
}: TrackCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });
  const trackPathRef = useRef<Path2D | null>(null);
  const hoveredDriverRef = useRef<string | null>(null);

  // Compute bounding box of all track elements
  const bounds = useMemo(() => {
    const polyline = track.polyline;
    if (!polyline.length) return { minX: 0, minY: 0, maxX: 1000, maxY: 1000 };

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const [x, y] of polyline) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }

    // Include DRS zones and corners in bounds
    if (track.drs_zones) {
      for (const zone of track.drs_zones) {
        for (const [x, y] of zone) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (track.corners) {
      for (const c of track.corners) {
        if (c.x < minX) minX = c.x;
        if (c.y < minY) minY = c.y;
        if (c.x > maxX) maxX = c.x;
        if (c.y > maxY) maxY = c.y;
      }
    }

    return { minX, minY, maxX, maxY };
  }, [track.polyline, track.drs_zones, track.corners]);

  // Compute scale/offset to fit the track's actual bounds into the canvas
  const getTransform = useCallback(
    (width: number, height: number) => {
      const polyline = track.polyline;
      if (!polyline.length) return { scale: 1, offsetX: 0, offsetY: 0 };

      const { minX, minY, maxX, maxY } = bounds;
      const trackW = maxX - minX || 1;
      const trackH = maxY - minY || 1;

      const usableW = width - PADDING * 2;
      const usableH = height - PADDING * 2;
      const scale = Math.min(usableW / trackW, usableH / trackH);
      const offsetX = (width - trackW * scale) / 2 - minX * scale;
      const offsetY = (height - trackH * scale) / 2 - minY * scale;

      return { scale, offsetX, offsetY };
    },
    [track.polyline, bounds],
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
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions({ width, height });
        }
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

    // Draw DRS zones
    if (track.drs_zones?.length > 0) {
      const zoneColor = drsEnabled
        ? DRS_ZONE_COLOR_ACTIVE
        : DRS_ZONE_COLOR_INACTIVE;
      ctx.strokeStyle = zoneColor;
      ctx.lineWidth = (TRACK_WIDTH + 4) / scale;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      for (const zone of track.drs_zones) {
        if (zone.length < 2) continue;
        ctx.beginPath();
        ctx.moveTo(zone[0][0], zone[0][1]);
        for (let i = 1; i < zone.length; i++) {
          ctx.lineTo(zone[i][0], zone[i][1]);
        }
        ctx.stroke();
      }
    }

    // Draw start/finish line (perpendicular to track direction)
    if (track.polyline.length > 2) {
      const sf = track.polyline[0];
      const next = track.polyline[1];
      // Direction vector from S/F to next point
      const dx = next[0] - sf[0];
      const dy = next[1] - sf[1];
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0) {
        // Perpendicular unit vector
        const px = -dy / len;
        const py = dx / len;
        const halfWidth = 12 / scale;

        // Draw checkered-style S/F line
        ctx.strokeStyle = SF_LINE_COLOR;
        ctx.lineWidth = 3 / scale;
        ctx.setLineDash([3 / scale, 3 / scale]);
        ctx.beginPath();
        ctx.moveTo(sf[0] - px * halfWidth, sf[1] - py * halfWidth);
        ctx.lineTo(sf[0] + px * halfWidth, sf[1] + py * halfWidth);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Draw corner labels
    if (showCorners && track.corners?.length > 0) {
      drawCornerLabels(ctx, track.corners, scale);
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

      // Draw highlighted driver (from battle events)
      if (
        highlightedDriver &&
        highlightedDriver !== selectedDriver &&
        highlightedDriver !== hoveredDriverRef.current &&
        frame.d[highlightedDriver]
      ) {
        const hData = frame.d[highlightedDriver];
        const hColor = drivers[highlightedDriver]
          ? `#${drivers[highlightedDriver].color}`
          : "#fff";
        // Pulsing ring
        const ringRadius = 14 / scale;
        ctx.strokeStyle = hColor;
        ctx.lineWidth = 2 / scale;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.arc(hData[0], hData[1], ringRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        drawDriver(
          ctx,
          highlightedDriver,
          hData,
          drivers[highlightedDriver],
          scale,
          true,
        );
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
  }, [
    dimensions,
    frame,
    track,
    drivers,
    selectedDriver,
    highlightedDriver,
    drsEnabled,
    showCorners,
    getTransform,
  ]);

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

      // Resolve tooltip: hovered driver takes priority, then selected driver
      const tooltipCode = closest ?? selectedDriver;
      if (tooltipCode && frame.d[tooltipCode] && drivers[tooltipCode]) {
        const driverData = frame.d[tooltipCode];
        onTooltipChange?.({
          screenX: driverData[0] * scale + offsetX,
          screenY: driverData[1] * scale + offsetY,
          code: tooltipCode,
          driver: drivers[tooltipCode],
          data: driverData,
        });
      } else {
        onTooltipChange?.(null);
      }

      canvasRef.current.style.cursor = closest ? "pointer" : "default";
    },
    [frame, dimensions, getTransform, drivers, selectedDriver, onTooltipChange],
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
    // Fall back to selected driver tooltip
    if (selectedDriver && frame?.d[selectedDriver] && drivers[selectedDriver]) {
      const { scale, offsetX, offsetY } = getTransform(
        dimensions.width,
        dimensions.height,
      );
      const driverData = frame.d[selectedDriver];
      onTooltipChange?.({
        screenX: driverData[0] * scale + offsetX,
        screenY: driverData[1] * scale + offsetY,
        code: selectedDriver,
        driver: drivers[selectedDriver],
        data: driverData,
      });
    } else {
      onTooltipChange?.(null);
    }
  }, [
    selectedDriver,
    frame,
    drivers,
    dimensions,
    getTransform,
    onTooltipChange,
  ]);

  // Update selected driver tooltip position on frame changes (playback)
  const lastEmittedRef = useRef<string | null>(null);
  useEffect(() => {
    if (hoveredDriverRef.current) return;
    if (
      !selectedDriver ||
      !frame?.d[selectedDriver] ||
      !drivers[selectedDriver]
    ) {
      if (lastEmittedRef.current) {
        lastEmittedRef.current = null;
        onTooltipChange?.(null);
      }
      return;
    }

    const { scale, offsetX, offsetY } = getTransform(
      dimensions.width,
      dimensions.height,
    );
    const driverData = frame.d[selectedDriver];
    lastEmittedRef.current = selectedDriver;
    onTooltipChange?.({
      screenX: driverData[0] * scale + offsetX,
      screenY: driverData[1] * scale + offsetY,
      code: selectedDriver,
      driver: drivers[selectedDriver],
      data: driverData,
    });
  }, [
    selectedDriver,
    frame,
    drivers,
    dimensions,
    getTransform,
    onTooltipChange,
  ]);

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        style={{ width: dimensions.width, height: dimensions.height }}
        className="block"
        onMouseMove={handleMouseMove}
        onClick={handleClick}
        onMouseLeave={handleMouseLeave}
      />
    </div>
  );
}

function drawCornerLabels(
  ctx: CanvasRenderingContext2D,
  corners: ReplayCorner[],
  scale: number,
) {
  ctx.font = `bold ${CORNER_LABEL_FONT_SIZE / scale}px monospace`;
  ctx.fillStyle = CORNER_LABEL_COLOR;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Deduplicate: only show unique corner numbers (some circuits have 2A, 2B, etc)
  const seen = new Set<number>();
  for (const corner of corners) {
    if (seen.has(corner.number)) continue;
    seen.add(corner.number);

    const label = `T${corner.number}`;
    ctx.fillText(label, corner.x, corner.y);
  }
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

  const scColors: Record<number, string> = {
    1: "#FFA500", // SC = orange
    2: "#FFD700", // VSC = gold
    3: "#FF0000", // Red flag = red
  };
  const scColor = scColors[frame.sc] ?? "#FFA500";
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
  const scLabels: Record<number, string> = { 1: "SC", 2: "VSC", 3: "RED" };
  ctx.fillText(
    scLabels[frame.sc] ?? "SC",
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

export function DriverTooltip({
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
  const [
    ,
    ,
    speed,
    gear,
    drs,
    compound,
    tyreLife,
    _lap,
    position,
    throttle,
    brake,
  ] = data;
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
        {isValidHeadshotUrl(driver.headshot_url) ? (
          <Image
            src={driver.headshot_url}
            alt={driver.full_name}
            width={24}
            height={24}
            className="w-6 h-6 rounded-full object-cover"
            unoptimized
          />
        ) : (
          <div
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: `#${driver.color}` }}
          />
        )}
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
        <span>Throttle</span>
        <span className="text-text-primary">{Math.round(throttle ?? 0)}%</span>
        <span>Brake</span>
        <span className={brake ? "text-red-400" : "text-text-muted"}>
          {brake ? "ON" : "OFF"}
        </span>
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
