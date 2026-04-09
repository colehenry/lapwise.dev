"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TrianglePattern } from "@/components/Patterns";
import type { ReplayData } from "@/lib/types";

interface TelemetryPanelProps {
  replayData: ReplayData;
  selectedDriver: string | null;
  compareDriver: string | null;
  frameIndex: number;
  hasDrs?: boolean;
  onClearCompare: () => void;
}

/** Per-lap telemetry samples for a single driver */
interface LapTelemetry {
  frameIndices: number[];
  speeds: number[];
  throttles: number[];
  brakes: number[];
  gears: number[];
  drs: number[];
}

// Chart layout
const CHART_PADDING_LEFT = 48;
const CHART_PADDING_RIGHT = 12;
const CHART_PADDING_TOP = 6;
const CHART_GAP = 4;
const SPEED_HEIGHT = 90;
const DELTA_HEIGHT = 40;
const THROTTLE_HEIGHT = 55;
const GEAR_HEIGHT = 40;
const DRS_HEIGHT = 14;

function getTotalHeight(showDelta: boolean, showDrs: boolean) {
  return (
    CHART_PADDING_TOP +
    SPEED_HEIGHT +
    (showDelta ? CHART_GAP + DELTA_HEIGHT : 0) +
    CHART_GAP +
    THROTTLE_HEIGHT +
    CHART_GAP +
    GEAR_HEIGHT +
    (showDrs ? CHART_GAP + DRS_HEIGHT : 0) +
    10
  );
}

const LABEL_FONT = "bold 8px monospace";
const TICK_FONT = "8px monospace";
const AXIS_COLOR = "rgba(255, 255, 255, 0.15)";
const GRID_COLOR = "rgba(255, 255, 255, 0.06)";
const PROGRESS_LINE_COLOR = "rgba(255, 255, 255, 0.4)";

/**
 * Precompute per-driver, per-lap telemetry data from replay frames.
 */
function buildLapTelemetryMap(
  replayData: ReplayData,
): Map<string, Map<number, LapTelemetry>> {
  const map = new Map<string, Map<number, LapTelemetry>>();
  const { frames } = replayData;

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    for (const [code, data] of Object.entries(frame.d)) {
      const lap = data[7];
      if (lap <= 0) continue;

      if (!map.has(code)) map.set(code, new Map());
      const driverMap = map.get(code) as Map<number, LapTelemetry>;

      if (!driverMap.has(lap)) {
        driverMap.set(lap, {
          frameIndices: [],
          speeds: [],
          throttles: [],
          brakes: [],
          gears: [],
          drs: [],
        });
      }

      const lapData = driverMap.get(lap) as LapTelemetry;
      lapData.frameIndices.push(i);
      lapData.speeds.push(data[2]);
      // Handle old replay data that doesn't have throttle/brake (9 elements)
      lapData.throttles.push(data.length > 9 ? (data[9] ?? 0) : 0);
      lapData.brakes.push(data.length > 10 ? (data[10] ?? 0) : 0);
      lapData.gears.push(data[3]);
      lapData.drs.push(data[4]);
    }
  }

  return map;
}

interface DrawConfig {
  color: string;
  lapData: LapTelemetry;
  /** -1 means draw full lap (comparison driver not at this lap yet) */
  progressIdx: number;
  opacity: number;
}

function drawTraces(
  ctx: CanvasRenderingContext2D,
  width: number,
  configs: DrawConfig[],
  primaryProgressIdx: number,
  showDelta: boolean,
  showDrs: boolean,
) {
  const chartWidth = width - CHART_PADDING_LEFT - CHART_PADDING_RIGHT;

  // Use max samples across all configs for x-axis normalization
  const maxSamples = Math.max(...configs.map((c) => c.lapData.speeds.length));
  if (maxSamples < 2) return;

  // Global max speed across all configs for consistent Y-axis
  const maxSpeed = Math.max(...configs.flatMap((c) => c.lapData.speeds), 100);
  // Round up to nearest 50
  const speedCeil = Math.ceil(maxSpeed / 50) * 50;

  const speedY0 = CHART_PADDING_TOP;
  const speedH = SPEED_HEIGHT;
  const deltaY0 = speedY0 + speedH + (showDelta ? CHART_GAP : 0);
  const deltaH = showDelta ? DELTA_HEIGHT : 0;
  const tbY0 = deltaY0 + deltaH + CHART_GAP;
  const tbH = THROTTLE_HEIGHT;
  const gearY0 = tbY0 + tbH + CHART_GAP;
  const gearH = GEAR_HEIGHT;
  const drsY0 = gearY0 + gearH + (showDrs ? CHART_GAP : 0);
  const drsH = showDrs ? DRS_HEIGHT : 0;
  const chartBottomY = showDrs ? drsY0 + drsH : gearY0 + gearH;
  const maxGear = 8;

  // --- Y-axis labels and grid ---
  ctx.font = TICK_FONT;
  ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = 1;

  // Speed Y-axis ticks
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let v = 0; v <= speedCeil; v += 100) {
    const y = speedY0 + speedH - (v / speedCeil) * speedH;
    ctx.fillText(`${v}`, CHART_PADDING_LEFT - 6, y);
    if (v > 0 && v < speedCeil) {
      ctx.beginPath();
      ctx.moveTo(CHART_PADDING_LEFT, y);
      ctx.lineTo(width - CHART_PADDING_RIGHT, y);
      ctx.stroke();
    }
  }
  // Speed unit label
  ctx.font = LABEL_FONT;
  ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
  ctx.fillText("km/h", CHART_PADDING_LEFT - 6, speedY0 - 1);

  // Throttle/Brake Y-axis
  ctx.font = TICK_FONT;
  ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
  ctx.fillText("100%", CHART_PADDING_LEFT - 6, tbY0 + 4);
  ctx.fillText("100%", CHART_PADDING_LEFT - 6, tbY0 + tbH - 4);
  // Center divider
  ctx.strokeStyle = AXIS_COLOR;
  ctx.setLineDash([2, 2]);
  ctx.beginPath();
  ctx.moveTo(CHART_PADDING_LEFT, tbY0 + tbH / 2);
  ctx.lineTo(width - CHART_PADDING_RIGHT, tbY0 + tbH / 2);
  ctx.stroke();
  ctx.setLineDash([]);
  // Labels
  ctx.font = LABEL_FONT;
  ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
  ctx.fillText("THR", CHART_PADDING_LEFT - 6, tbY0 + tbH / 4);
  ctx.fillText("BRK", CHART_PADDING_LEFT - 6, tbY0 + (tbH * 3) / 4);

  // Gear Y-axis
  ctx.font = TICK_FONT;
  ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
  for (const g of [2, 4, 6, 8]) {
    const y = gearY0 + gearH - (g / maxGear) * gearH;
    ctx.fillText(`${g}`, CHART_PADDING_LEFT - 6, y);
  }
  ctx.font = LABEL_FONT;
  ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
  ctx.fillText("GEAR", CHART_PADDING_LEFT - 6, gearY0 - 1);

  // DRS label (hidden for 2026+ seasons)
  if (showDrs) {
    ctx.font = LABEL_FONT;
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.textBaseline = "middle";
    ctx.fillText("DRS", CHART_PADDING_LEFT - 6, drsY0 + drsH / 2);
  }

  // --- Draw each driver's traces ---
  for (const cfg of configs) {
    const { lapData, progressIdx, opacity } = cfg;
    const color = cfg.color;
    const totalSamples = lapData.speeds.length;
    if (totalSamples < 2) continue;

    const xScale = chartWidth / (maxSamples - 1);
    // Scale this driver's samples to fit the shared x-axis
    const sampleScale = (maxSamples - 1) / (totalSamples - 1);
    const drawUpTo =
      progressIdx < 0 ? totalSamples : Math.min(progressIdx + 1, totalSamples);

    ctx.globalAlpha = opacity;

    // Speed trace
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < drawUpTo; i++) {
      const x = CHART_PADDING_LEFT + i * sampleScale * xScale;
      const y = speedY0 + speedH - (lapData.speeds[i] / speedCeil) * speedH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Throttle fill
    const tFillColor = hexToRgba(color, 0.15 * opacity);
    ctx.fillStyle = tFillColor;
    ctx.beginPath();
    ctx.moveTo(CHART_PADDING_LEFT, tbY0 + tbH / 2);
    for (let i = 0; i < drawUpTo; i++) {
      const x = CHART_PADDING_LEFT + i * sampleScale * xScale;
      const tVal = lapData.throttles[i] / 100;
      ctx.lineTo(x, tbY0 + tbH / 2 - tVal * (tbH / 2));
    }
    ctx.lineTo(
      CHART_PADDING_LEFT + (drawUpTo - 1) * sampleScale * xScale,
      tbY0 + tbH / 2,
    );
    ctx.closePath();
    ctx.fill();

    // Throttle line
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < drawUpTo; i++) {
      const x = CHART_PADDING_LEFT + i * sampleScale * xScale;
      const tVal = lapData.throttles[i] / 100;
      const y = tbY0 + tbH / 2 - tVal * (tbH / 2);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Brake fill (below center)
    const bFillColor = hexToRgba("#ef4444", 0.2 * opacity);
    ctx.fillStyle = bFillColor;
    ctx.beginPath();
    ctx.moveTo(CHART_PADDING_LEFT, tbY0 + tbH / 2);
    for (let i = 0; i < drawUpTo; i++) {
      const x = CHART_PADDING_LEFT + i * sampleScale * xScale;
      const bVal = lapData.brakes[i];
      ctx.lineTo(x, tbY0 + tbH / 2 + bVal * (tbH / 2));
    }
    ctx.lineTo(
      CHART_PADDING_LEFT + (drawUpTo - 1) * sampleScale * xScale,
      tbY0 + tbH / 2,
    );
    ctx.closePath();
    ctx.fill();

    // Brake line
    ctx.strokeStyle = `rgba(239, 68, 68, ${opacity})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < drawUpTo; i++) {
      const x = CHART_PADDING_LEFT + i * sampleScale * xScale;
      const bVal = lapData.brakes[i];
      const y = tbY0 + tbH / 2 + bVal * (tbH / 2);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Gear stepped line
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < drawUpTo; i++) {
      const x = CHART_PADDING_LEFT + i * sampleScale * xScale;
      const gVal = lapData.gears[i];
      const y = gearY0 + gearH - (gVal / maxGear) * gearH;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        const prevY = gearY0 + gearH - (lapData.gears[i - 1] / maxGear) * gearH;
        ctx.lineTo(x, prevY);
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // DRS blocks (hidden for 2026+ seasons)
    if (showDrs) {
      for (let i = 0; i < drawUpTo; i++) {
        if (lapData.drs[i]) {
          const x = CHART_PADDING_LEFT + i * sampleScale * xScale;
          const blockW = Math.max(sampleScale * xScale, 1);
          ctx.fillStyle = hexToRgba("#22c55e", 0.6 * opacity);
          ctx.fillRect(x, drsY0, blockW, drsH);
        }
      }
    }

    ctx.globalAlpha = 1;
  }

  // --- Speed delta chart (driver 1 - driver 2) ---
  if (showDelta && configs.length >= 2) {
    const primary = configs[0];
    const compare = configs[1];
    const pSamples = primary.lapData.speeds.length;
    const cSamples = compare.lapData.speeds.length;
    const pDrawUpTo =
      primary.progressIdx < 0
        ? pSamples
        : Math.min(primary.progressIdx + 1, pSamples);
    const cDrawUpTo =
      compare.progressIdx < 0
        ? cSamples
        : Math.min(compare.progressIdx + 1, cSamples);
    const drawUpTo = Math.min(pDrawUpTo, cDrawUpTo);

    // Compute max absolute delta for symmetric Y-axis
    let maxAbsDelta = 10;
    for (let i = 0; i < drawUpTo; i++) {
      const pIdx = Math.round((i / Math.max(pSamples - 1, 1)) * (pSamples - 1));
      const cIdx = Math.round((i / Math.max(cSamples - 1, 1)) * (cSamples - 1));
      const delta =
        (primary.lapData.speeds[pIdx] ?? 0) -
        (compare.lapData.speeds[cIdx] ?? 0);
      maxAbsDelta = Math.max(maxAbsDelta, Math.abs(delta));
    }
    const deltaCeil = Math.ceil(maxAbsDelta / 10) * 10;

    // Y-axis labels
    ctx.font = LABEL_FONT;
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText("Δ SPD", CHART_PADDING_LEFT - 6, deltaY0 + deltaH / 2);
    ctx.font = TICK_FONT;
    ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
    ctx.fillText(`+${deltaCeil}`, CHART_PADDING_LEFT - 6, deltaY0 + 4);
    ctx.fillText(`-${deltaCeil}`, CHART_PADDING_LEFT - 6, deltaY0 + deltaH - 2);

    // Zero line
    ctx.strokeStyle = AXIS_COLOR;
    ctx.setLineDash([2, 2]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(CHART_PADDING_LEFT, deltaY0 + deltaH / 2);
    ctx.lineTo(width - CHART_PADDING_RIGHT, deltaY0 + deltaH / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Delta fill and line
    const xScale = chartWidth / (maxSamples - 1);
    ctx.lineWidth = 1;
    for (let i = 0; i < drawUpTo; i++) {
      const pScale = (maxSamples - 1) / Math.max(pSamples - 1, 1);
      const cScale = (maxSamples - 1) / Math.max(cSamples - 1, 1);
      const pIdx = Math.min(
        Math.round(((i * pScale) / (maxSamples - 1)) * (pSamples - 1)),
        pSamples - 1,
      );
      const cIdx = Math.min(
        Math.round(((i * cScale) / (maxSamples - 1)) * (cSamples - 1)),
        cSamples - 1,
      );
      const delta =
        (primary.lapData.speeds[pIdx] ?? 0) -
        (compare.lapData.speeds[cIdx] ?? 0);
      const normDelta = delta / deltaCeil;
      const x = CHART_PADDING_LEFT + i * xScale;

      // Draw bar from center
      const barH = Math.abs(normDelta) * (deltaH / 2);
      const barY =
        delta >= 0 ? deltaY0 + deltaH / 2 - barH : deltaY0 + deltaH / 2;
      ctx.fillStyle =
        delta >= 0 ? "rgba(34, 197, 94, 0.25)" : "rgba(239, 68, 68, 0.25)";
      ctx.fillRect(x, barY, Math.max(xScale, 1), barH);
    }

    // Delta line trace
    ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < drawUpTo; i++) {
      const pIdx = Math.min(
        Math.round((i / Math.max(maxSamples - 1, 1)) * (pSamples - 1)),
        pSamples - 1,
      );
      const cIdx = Math.min(
        Math.round((i / Math.max(maxSamples - 1, 1)) * (cSamples - 1)),
        cSamples - 1,
      );
      const delta =
        (primary.lapData.speeds[pIdx] ?? 0) -
        (compare.lapData.speeds[cIdx] ?? 0);
      const normDelta = delta / deltaCeil;
      const x = CHART_PADDING_LEFT + i * xScale;
      const y = deltaY0 + deltaH / 2 - normDelta * (deltaH / 2);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // --- Progress line (uses primary driver) ---
  const primaryConfig = configs[0];
  if (primaryConfig && primaryProgressIdx > 0) {
    const totalSamples = primaryConfig.lapData.speeds.length;
    const xScale = chartWidth / (maxSamples - 1);
    const sampleScale = (maxSamples - 1) / Math.max(totalSamples - 1, 1);
    const px = CHART_PADDING_LEFT + primaryProgressIdx * sampleScale * xScale;
    ctx.strokeStyle = PROGRESS_LINE_COLOR;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(px, CHART_PADDING_TOP);
    ctx.lineTo(px, chartBottomY);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Bottom axis
  ctx.strokeStyle = AXIS_COLOR;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(CHART_PADDING_LEFT, chartBottomY);
  ctx.lineTo(width - CHART_PADDING_RIGHT, chartBottomY);
  ctx.stroke();
}

function hexToRgba(hex: string, alpha: number): string {
  // Handle named colors or already-rgba
  if (hex.startsWith("rgba") || hex.startsWith("rgb")) return hex;
  const h = hex.replace("#", "");
  const r = Number.parseInt(h.substring(0, 2), 16);
  const g = Number.parseInt(h.substring(2, 4), 16);
  const b = Number.parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface DriverTooltipData {
  speed: number;
  throttle: number;
  brake: number;
  gear: number;
  drs: number;
}

interface TooltipResult {
  snappedX: number;
  pct: number;
  primary: DriverTooltipData;
  compare: DriverTooltipData | null;
  speedDelta: number | null;
}

/** Get tooltip data at a given x position, with optional comparison driver */
function getTooltipData(
  mouseX: number,
  width: number,
  lapData: LapTelemetry,
  compareLapData: LapTelemetry | undefined,
  maxSamples: number,
): TooltipResult | null {
  const chartWidth = width - CHART_PADDING_LEFT - CHART_PADDING_RIGHT;
  const relX = mouseX - CHART_PADDING_LEFT;
  if (relX < 0 || relX > chartWidth) return null;

  const totalSamples = lapData.speeds.length;
  const sampleScale = (maxSamples - 1) / Math.max(totalSamples - 1, 1);
  const xScale = chartWidth / (maxSamples - 1);
  const idx = Math.round(relX / (sampleScale * xScale));
  if (idx < 0 || idx >= totalSamples) return null;

  // Snap X to the actual sample position
  const snappedX = CHART_PADDING_LEFT + idx * sampleScale * xScale;

  const primary: DriverTooltipData = {
    speed: lapData.speeds[idx],
    throttle: lapData.throttles[idx],
    brake: lapData.brakes[idx],
    gear: lapData.gears[idx],
    drs: lapData.drs[idx],
  };

  let compare: DriverTooltipData | null = null;
  let speedDelta: number | null = null;

  if (compareLapData) {
    const cSamples = compareLapData.speeds.length;
    const cIdx = Math.min(
      Math.round((idx / Math.max(totalSamples - 1, 1)) * (cSamples - 1)),
      cSamples - 1,
    );
    compare = {
      speed: compareLapData.speeds[cIdx],
      throttle: compareLapData.throttles[cIdx],
      brake: compareLapData.brakes[cIdx],
      gear: compareLapData.gears[cIdx],
      drs: compareLapData.drs[cIdx],
    };
    speedDelta = primary.speed - compare.speed;
  }

  return {
    snappedX,
    pct: Math.round((idx / (totalSamples - 1)) * 100),
    primary,
    compare,
    speedDelta,
  };
}

export default function TelemetryPanel({
  replayData,
  selectedDriver,
  compareDriver,
  frameIndex,
  hasDrs = true,
  onClearCompare,
}: TelemetryPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  const [collapsed, setCollapsed] = useState(false);
  const [tooltip, setTooltip] = useState<TooltipResult | null>(null);

  // Precompute all lap telemetry data once
  const telemetryMap = useMemo(
    () => buildLapTelemetryMap(replayData),
    [replayData],
  );

  // Get current driver info
  const driverInfo = selectedDriver ? replayData.drivers[selectedDriver] : null;
  const driverColor = driverInfo ? `#${driverInfo.color}` : "#a855f7";

  const compareInfo = compareDriver ? replayData.drivers[compareDriver] : null;
  const compareColor = compareInfo ? `#${compareInfo.color}` : "#60a5fa";

  // Get current lap from frame
  const currentFrame = replayData.frames[frameIndex];
  const driverData = selectedDriver ? currentFrame?.d[selectedDriver] : null;
  const currentLap = driverData ? driverData[7] : 0;

  // Get lap telemetry for selected driver + lap
  const driverLapMap = selectedDriver
    ? telemetryMap.get(selectedDriver)
    : undefined;
  const lapData = driverLapMap?.get(currentLap);

  // Get compare driver's data for the same lap
  const compareLapMap = compareDriver
    ? telemetryMap.get(compareDriver)
    : undefined;
  const compareLapData = compareLapMap?.get(currentLap);

  // Compute progress index within the current lap
  const progressIdx = useMemo(() => {
    if (!lapData) return 0;
    const idx = lapData.frameIndices.findIndex((fi) => fi >= frameIndex);
    if (idx === -1) return lapData.frameIndices.length - 1;
    return idx;
  }, [lapData, frameIndex]);

  // Compute compare driver's progress index for the same lap
  const compareProgressIdx = useMemo(() => {
    if (!compareLapData) return 0;
    const idx = compareLapData.frameIndices.findIndex((fi) => fi >= frameIndex);
    if (idx === -1) return compareLapData.frameIndices.length - 1;
    return idx;
  }, [compareLapData, frameIndex]);

  // Max samples across both drivers for shared X-axis
  const maxSamples = useMemo(() => {
    const s1 = lapData?.speeds.length ?? 0;
    const s2 = compareLapData?.speeds.length ?? 0;
    return Math.max(s1, s2, 2);
  }, [lapData, compareLapData]);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width);
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Draw
  useEffect(() => {
    if (collapsed || !lapData || !selectedDriver) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const hasDelta = !!compareLapData;
    const totalHeight = getTotalHeight(hasDelta, hasDrs);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = totalHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, totalHeight);

    const configs: DrawConfig[] = [
      {
        color: driverColor,
        lapData,
        progressIdx,
        opacity: 1,
      },
    ];

    if (compareLapData) {
      configs.push({
        color: compareColor,
        lapData: compareLapData,
        progressIdx: compareProgressIdx,
        opacity: 0.7,
      });
    }

    drawTraces(ctx, width, configs, progressIdx, hasDelta, hasDrs);
  }, [
    width,
    lapData,
    compareLapData,
    progressIdx,
    compareProgressIdx,
    driverColor,
    compareColor,
    collapsed,
    selectedDriver,
    hasDrs,
  ]);

  // Mouse hover for tooltip
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!lapData) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const data = getTooltipData(
        mouseX,
        width,
        lapData,
        compareLapData,
        maxSamples,
      );
      setTooltip(data);
    },
    [lapData, compareLapData, width, maxSamples],
  );

  const handleMouseLeave = useCallback(() => setTooltip(null), []);

  if (!selectedDriver || !driverInfo) return null;

  return (
    <div className="bg-bg-tertiary border border-border-primary rounded-sm shadow-sm overflow-hidden">
      <div
        role="toolbar"
        onClick={() => setCollapsed((c) => !c)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setCollapsed((c) => !c);
          }
        }}
        className="relative w-full h-10 bg-bg-primary border-b border-border-primary px-4 flex items-center justify-between overflow-hidden cursor-pointer hover:bg-bg-elevated/30 transition-colors"
      >
        <TrianglePattern id="replay-telemetry-triangles" />
        <div className="relative z-10 flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: driverColor }}
          />
          <span className="text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono">
            {selectedDriver}
          </span>
          {compareDriver && compareInfo && (
            <>
              <span className="text-[10px] text-text-muted/50 font-mono">
                vs
              </span>
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: compareColor }}
              />
              <span className="text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono">
                {compareDriver}
              </span>
            </>
          )}
          {currentLap > 0 && (
            <span className="text-[10px] font-mono text-text-muted/60">
              Lap {currentLap}
            </span>
          )}
        </div>
        <div className="relative z-10 flex items-center gap-2">
          {compareDriver && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClearCompare();
              }}
              className="text-[10px] font-mono text-text-muted hover:text-red-400 transition-colors px-1"
            >
              Clear compare
            </button>
          )}
          <span className="text-text-muted text-[10px] font-mono">
            {collapsed ? "+" : "-"}
          </span>
        </div>
      </div>
      {!collapsed && (
        <div ref={containerRef} className="w-full relative">
          {lapData && lapData.speeds.length > 1 ? (
            <>
              <canvas
                ref={canvasRef}
                style={{
                  width: "100%",
                  height: getTotalHeight(!!compareLapData, hasDrs),
                }}
                className="block"
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
              />
              {/* Snap crosshair line */}
              {tooltip && (
                <div
                  className="absolute top-0 pointer-events-none z-10"
                  style={{
                    left: tooltip.snappedX,
                    height: getTotalHeight(!!compareLapData, hasDrs),
                    width: 1,
                    background: "rgba(255, 255, 255, 0.2)",
                  }}
                />
              )}
              {/* Tooltip */}
              {tooltip && (
                <div
                  className="absolute pointer-events-none bg-bg-primary/95 backdrop-blur-sm border border-border-primary rounded-sm px-2.5 py-1.5 text-[10px] font-mono z-20"
                  style={{
                    left: Math.min(
                      tooltip.snappedX + 12,
                      width - (tooltip.compare ? 200 : 130),
                    ),
                    top: 8,
                  }}
                >
                  <div className="text-text-muted mb-1">
                    {tooltip.pct}% through lap
                  </div>
                  {tooltip.compare ? (
                    <div>
                      {/* Header row */}
                      <div className="grid grid-cols-3 gap-x-2 mb-0.5">
                        <span />
                        <span
                          className="font-bold text-center"
                          style={{ color: driverColor }}
                        >
                          {selectedDriver}
                        </span>
                        <span
                          className="font-bold text-center"
                          style={{ color: compareColor }}
                        >
                          {compareDriver}
                        </span>
                      </div>
                      {/* Speed */}
                      <div className="grid grid-cols-3 gap-x-2">
                        <span className="text-text-secondary">Speed</span>
                        <span className="text-text-primary text-center">
                          {Math.round(tooltip.primary.speed)}
                        </span>
                        <span className="text-text-primary text-center">
                          {Math.round(tooltip.compare.speed)}
                        </span>
                      </div>
                      {/* Delta */}
                      {tooltip.speedDelta !== null && (
                        <div className="grid grid-cols-3 gap-x-2">
                          <span className="text-text-secondary">Delta</span>
                          <span
                            className={`col-span-2 text-center font-bold ${tooltip.speedDelta > 0 ? "text-green-400" : tooltip.speedDelta < 0 ? "text-red-400" : "text-text-muted"}`}
                          >
                            {tooltip.speedDelta > 0 ? "+" : ""}
                            {Math.round(tooltip.speedDelta)} km/h
                          </span>
                        </div>
                      )}
                      {/* Throttle */}
                      <div className="grid grid-cols-3 gap-x-2">
                        <span className="text-text-secondary">Throttle</span>
                        <span className="text-text-primary text-center">
                          {Math.round(tooltip.primary.throttle)}%
                        </span>
                        <span className="text-text-primary text-center">
                          {Math.round(tooltip.compare.throttle)}%
                        </span>
                      </div>
                      {/* Brake */}
                      <div className="grid grid-cols-3 gap-x-2">
                        <span className="text-text-secondary">Brake</span>
                        <span
                          className={`text-center ${tooltip.primary.brake ? "text-red-400" : "text-text-muted"}`}
                        >
                          {tooltip.primary.brake ? "ON" : "OFF"}
                        </span>
                        <span
                          className={`text-center ${tooltip.compare.brake ? "text-red-400" : "text-text-muted"}`}
                        >
                          {tooltip.compare.brake ? "ON" : "OFF"}
                        </span>
                      </div>
                      {/* Gear */}
                      <div className="grid grid-cols-3 gap-x-2">
                        <span className="text-text-secondary">Gear</span>
                        <span className="text-text-primary text-center">
                          {tooltip.primary.gear}
                        </span>
                        <span className="text-text-primary text-center">
                          {tooltip.compare.gear}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-x-3 gap-y-0 text-text-secondary">
                      <span>Speed</span>
                      <span className="text-text-primary">
                        {Math.round(tooltip.primary.speed)} km/h
                      </span>
                      <span>Throttle</span>
                      <span className="text-text-primary">
                        {Math.round(tooltip.primary.throttle)}%
                      </span>
                      <span>Brake</span>
                      <span
                        className={
                          tooltip.primary.brake
                            ? "text-red-400"
                            : "text-text-muted"
                        }
                      >
                        {tooltip.primary.brake ? "ON" : "OFF"}
                      </span>
                      <span>Gear</span>
                      <span className="text-text-primary">
                        {tooltip.primary.gear}
                      </span>
                      {hasDrs && (
                        <>
                          <span>DRS</span>
                          <span
                            className={
                              tooltip.primary.drs
                                ? "text-green-400"
                                : "text-text-muted"
                            }
                          >
                            {tooltip.primary.drs ? "OPEN" : "OFF"}
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="h-20 flex items-center justify-center">
              <span className="text-xs text-text-muted font-mono">
                No telemetry for lap {currentLap}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
