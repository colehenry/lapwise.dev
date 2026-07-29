"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { PLAYBACK_RATES, type RaceClockController } from "@/hooks/useRaceClock";
import { buildTrackPath } from "@/lib/raceClock";
import type { ReplayTrack } from "@/lib/types";
import TransportBar from "./TransportBar";

type Props = {
  track: ReplayTrack | undefined;
  controller: RaceClockController;
  eventName: string;
  circuitName: string;
  round: number;
  /** Lap times carry no images, so headshots are resolved from standings. */
  headshotFor: (code: string, name: string) => string | null;
};

const headshotCache = new Map<string, HTMLImageElement>();

function headshot(url: string | null, onLoad: () => void) {
  if (!url) return null;
  const cached = headshotCache.get(url);
  if (cached) return cached.complete && cached.naturalWidth > 0 ? cached : null;
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.referrerPolicy = "no-referrer";
  img.onload = onLoad;
  img.src = url;
  headshotCache.set(url, img);
  return null;
}

/**
 * The live track. White ribbon on black — a wide casing stroke under a thin
 * bright one, dashed start/finish — and the leader carries their photo around
 * the circuit. The map is fitted to the polyline's own bounding box so the
 * circuit fills the card instead of floating inside a square.
 */
export default function HeroTrack({
  track,
  controller,
  eventName,
  circuitName,
  round,
  headshotFor,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Held in a ref as well as state so deferred repaints — a headshot finishing
  // its load, a resize — draw the current instant rather than a stale one.
  const stateRef = useRef(controller.state);
  const state = controller.state;

  const rotated = useMemo(() => {
    if (!track?.polyline?.length) return null;
    return rotatePolyline(track.polyline, track.rotation_deg ?? 0);
  }, [track]);

  const pointAt = useMemo(
    () => (rotated ? buildTrackPath(rotated.poly) : null),
    [rotated],
  );

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !rotated || !pointAt) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const { poly, bounds } = rotated;
    // Extra top-right padding keeps the ribbon clear of the transport card.
    const padX = w * 0.07;
    const padTop = h * 0.13;
    const padBottom = h * 0.09;
    const availW = w - padX * 2;
    const availH = h - padTop - padBottom;
    const scale = Math.min(availW / bounds.w, availH / bounds.h);
    const ox = padX + (availW - bounds.w * scale) / 2;
    const oy = padTop + (availH - bounds.h * scale) / 2;
    const project = ([x, y]: [number, number]): [number, number] => [
      ox + (x - bounds.x0) * scale,
      oy + (y - bounds.y0) * scale,
    ];

    const trace = () => {
      ctx.beginPath();
      poly.forEach((p, i) => {
        const [x, y] = project(p);
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      });
      ctx.closePath();
    };

    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    trace();
    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.lineWidth = Math.max(9, scale * 4.2);
    ctx.stroke();

    const flag = stateRef.current?.flag;
    trace();
    ctx.strokeStyle = flag
      ? flag.label === "RED"
        ? "rgba(255,96,86,0.95)"
        : "rgba(255,208,64,0.9)"
      : "rgba(255,255,255,0.9)";
    ctx.lineWidth = Math.max(1.4, scale * 0.55);
    ctx.stroke();

    if (poly.length > 1) {
      const [sx, sy] = project(poly[0]);
      const [nx, ny] = project(poly[1]);
      const dx = nx - sx;
      const dy = ny - sy;
      const len = Math.hypot(dx, dy) || 1;
      const half = Math.max(7, scale * 2.4);
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx + (dy / len) * half, sy - (dx / len) * half);
      ctx.lineTo(sx - (dy / len) * half, sy + (dx / len) * half);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const rows = stateRef.current?.rows ?? [];
    for (const row of [...rows].reverse()) {
      if (row.retired || row.position === 1) continue;
      const [x, y] = project(pointAt(row.progress));
      ctx.fillStyle = teamHex(row.car.color);
      ctx.beginPath();
      ctx.arc(x, y, Math.max(2.4, scale * 0.95), 0, Math.PI * 2);
      ctx.fill();
    }

    const leader = rows.find((r) => r.position === 1 && !r.retired);
    if (leader) {
      const [x, y] = project(pointAt(leader.progress));
      const radius = Math.max(15, Math.min(27, scale * 6));
      const url = headshotFor(leader.car.code, leader.car.name);
      const img = headshot(url, draw);

      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = "#0b0c0e";
      ctx.fill();
      if (img) {
        ctx.clip();
        const iw = img.naturalWidth;
        const ih = img.naturalHeight;
        const s = Math.max((radius * 2) / iw, (radius * 2) / ih) * 1.18;
        ctx.drawImage(
          img,
          x - (iw * s) / 2,
          y - (ih * s) / 2 + radius * 0.16,
          iw * s,
          ih * s,
        );
      }
      ctx.restore();

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.strokeStyle = teamHex(leader.car.color);
      ctx.lineWidth = 2.5;
      ctx.stroke();

      if (!img) {
        ctx.font = `700 ${radius * 0.6}px ui-sans-serif, system-ui, sans-serif`;
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(leader.car.code, x, y);
      }
    }
  }, [rotated, pointAt, headshotFor]);

  useEffect(() => {
    stateRef.current = state;
    draw();
  }, [draw, state]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => draw());
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [draw]);

  const second = state?.rows[1];

  return (
    <section className="relative flex flex-col overflow-hidden rounded-sm border border-border-primary bg-[#05060a]">
      <div className="flex items-start justify-between gap-4 p-4 pb-0">
        <div>
          <p className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-widest text-purple-400">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-400 shadow-[0_0_7px_currentColor]" />
            Race
          </p>
          <h2 className="mt-1 text-lg font-bold tracking-tight text-text-primary md:text-xl">
            {eventName}
          </h2>
          <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
            Round {round} · {circuitName}
          </p>
        </div>
      </div>

      {/* Transport lives inside the map, top right, so the controls sit on the
          thing they control rather than in a separate strip. */}
      <div className="absolute right-3 top-3 z-10">
        <TransportBar controller={controller} rates={PLAYBACK_RATES} />
      </div>

      <div className="relative min-h-[16rem] flex-1">
        <canvas
          ref={canvasRef}
          aria-label={`Live track map, ${eventName}`}
          className="absolute inset-0 h-full w-full"
        />
      </div>

      <dl className="grid grid-cols-3 border-t border-border-primary">
        <Stat
          label="Lap"
          value={state ? `${state.lap} / ${state.totalLaps}` : "—"}
        />
        <Stat
          label="Gap P1–P2"
          value={second ? `+${second.gap.toFixed(3)}` : "—"}
          bordered
        />
        <Stat
          label="Track"
          value={state?.flag?.label ?? "GREEN"}
          bordered
          tone={
            state?.flag ? (state.flag.label === "RED" ? "bad" : "warn") : "ok"
          }
        />
      </dl>
    </section>
  );
}

function Stat({
  label,
  value,
  bordered,
  tone,
}: {
  label: string;
  value: string;
  bordered?: boolean;
  tone?: "ok" | "warn" | "bad";
}) {
  const toneClass =
    tone === "bad"
      ? "text-red-400"
      : tone === "warn"
        ? "text-warning"
        : tone === "ok"
          ? "text-success"
          : "text-text-primary";
  return (
    <div
      className={`px-4 py-2.5 ${bordered ? "border-l border-border-primary" : ""}`}
    >
      <dt className="font-mono text-[9px] uppercase tracking-widest text-text-muted">
        {label}
      </dt>
      <dd
        className={`font-mono text-sm font-semibold tabular-nums ${toneClass}`}
      >
        {value}
      </dd>
    </div>
  );
}

function teamHex(color: string | null | undefined) {
  return color ? `#${color.replace("#", "")}` : "#8a8a94";
}

/** Rotates the polyline to its broadcast orientation and reports the box to fit. */
function rotatePolyline(polyline: [number, number][], degrees: number) {
  const rad = (degrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const xs = polyline.map((p) => p[0]);
  const ys = polyline.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;

  const poly = polyline.map(([x, y]): [number, number] => {
    const dx = x - cx;
    const dy = y - cy;
    return [dx * cos - dy * sin, dx * sin + dy * cos];
  });

  const rx = poly.map((p) => p[0]);
  const ry = poly.map((p) => p[1]);
  const x0 = Math.min(...rx);
  const y0 = Math.min(...ry);
  return {
    poly,
    bounds: {
      x0,
      y0,
      w: Math.max(...rx) - x0 || 1,
      h: Math.max(...ry) - y0 || 1,
    },
  };
}
