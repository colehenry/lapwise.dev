"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { circuitCoord } from "@/lib/circuitCoords";
import type { RoundSummary } from "@/lib/types";

export type GlobeRound = {
  round: number;
  name: string;
  shortName: string;
  date: string;
  circuitName: string | null;
  lat: number;
  lon: number;
  podium: RoundSummary["podium"];
};

type LandData = { outlines: [number, number][][]; dots: [number, number][] };

type Props = {
  rounds: GlobeRound[];
  focusRound: number | null;
  onFocusChange: (round: number) => void;
};

const D2R = Math.PI / 180;
const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

function project(lat: number, lon: number, yaw: number, pitch: number) {
  const p = lat * D2R;
  const l = (lon + yaw) * D2R;
  const y0 = Math.sin(p);
  const z0 = Math.cos(p) * Math.cos(l);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  return {
    x: Math.cos(p) * Math.sin(l),
    y: y0 * cp - z0 * sp,
    z: y0 * sp + z0 * cp,
  };
}

/** Shortest angular path, so spinning to a round never takes the long way. */
function shortestDelta(from: number, to: number) {
  let d = (to - from) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

/**
 * The season as a halftone globe. Only rounds that have actually run are
 * plotted — an unraced round has no result to show, so pinning it would be
 * noise. Selecting a round eases the sphere round to it and zooms in.
 */
export default function SeasonGlobe({
  rounds,
  focusRound,
  onFocusChange,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [land, setLand] = useState<LandData | null>(null);

  const view = useRef({ yaw: -10, pitch: -0.28, zoom: 1 });
  const target = useRef({ yaw: -10, pitch: -0.28, zoom: 1 });
  const screen = useRef<{ round: number; x: number; y: number; z: number }[]>(
    [],
  );
  const drag = useRef<{ active: boolean; x: number; y: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/land-110m.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled) setLand(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Selecting a round retargets the camera; the animation loop eases toward it.
  useEffect(() => {
    const hit = rounds.find((r) => r.round === focusRound);
    if (!hit) return;
    target.current = {
      yaw: -hit.lon,
      pitch: clamp(-hit.lat * D2R, -0.9, 0.9),
      zoom: 1.35,
    };
  }, [focusRound, rounds]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
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

    const { yaw, pitch, zoom } = view.current;
    const cx = w / 2;
    const cy = h / 2;
    const R = Math.min(w, h) * 0.42 * zoom;

    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.018)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.lineWidth = 1;
    ctx.stroke();

    const ring = (
      fn: (t: number) => { lat: number; lon: number },
      steps = 84,
    ) => {
      ctx.beginPath();
      let on = false;
      for (let k = 0; k <= steps; k++) {
        const { lat, lon } = fn(k / steps);
        const p = project(lat, lon, yaw, pitch);
        if (p.z <= 0) {
          on = false;
          continue;
        }
        const x = cx + p.x * R;
        const y = cy - p.y * R;
        if (on) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
        on = true;
      }
      ctx.stroke();
    };

    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    for (const lat of [-60, -30, 0, 30, 60])
      ring((t) => ({ lat, lon: -180 + t * 360 }));
    for (let lon = -180; lon < 180; lon += 30)
      ring((t) => ({ lat: -90 + t * 180, lon }));

    if (land) {
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      const dotR = Math.max(0.7, R * 0.0042);
      for (const [lon, lat] of land.dots) {
        const p = project(lat, lon, yaw, pitch);
        if (p.z <= 0.02) continue;
        ctx.globalAlpha = 0.2 + p.z * 0.5;
        ctx.beginPath();
        ctx.arc(cx + p.x * R, cy - p.y * R, dotR, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      for (const outline of land.outlines) {
        ctx.beginPath();
        let on = false;
        for (const [lon, lat] of outline) {
          const p = project(lat, lon, yaw, pitch);
          if (p.z <= 0) {
            on = false;
            continue;
          }
          const x = cx + p.x * R;
          const y = cy - p.y * R;
          if (on) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
          on = true;
        }
        ctx.stroke();
      }
    }

    // Route between consecutive completed rounds.
    ctx.strokeStyle = "rgba(255,255,255,0.26)";
    ctx.lineWidth = 1.1;
    for (let i = 0; i < rounds.length - 1; i++) {
      const a = rounds[i];
      const b = rounds[i + 1];
      ctx.beginPath();
      let on = false;
      for (let k = 0; k <= 24; k++) {
        const t = k / 24;
        const lat = a.lat + (b.lat - a.lat) * t;
        const lon = a.lon + shortestDelta(a.lon, b.lon) * t;
        const p = project(lat, lon, yaw, pitch);
        if (p.z <= 0) {
          on = false;
          continue;
        }
        const x = cx + p.x * R;
        const y = cy - p.y * R;
        if (on) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
        on = true;
      }
      ctx.stroke();
    }

    screen.current = [];
    for (const round of rounds) {
      const p = project(round.lat, round.lon, yaw, pitch);
      const x = cx + p.x * R;
      const y = cy - p.y * R;
      screen.current.push({ round: round.round, x, y, z: p.z });
      if (p.z <= 0.02) continue;

      const active = round.round === focusRound;
      const winner = round.podium[0];
      const color = winner?.team_color
        ? `#${winner.team_color.replace("#", "")}`
        : "#ffffff";
      const radius = active ? 5 : 2.6;

      if (active) {
        ctx.beginPath();
        ctx.arc(x, y, radius * 3, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      ctx.globalAlpha = 0.45 + p.z * 0.55;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();

      if (active) {
        ctx.globalAlpha = 1;
        ctx.font = "600 12px ui-sans-serif, system-ui, sans-serif";
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        ctx.textBaseline = "middle";
        ctx.fillText(round.shortName.toUpperCase(), x + radius + 8, y);
      }
      ctx.globalAlpha = 1;
    }
  }, [land, rounds, focusRound]);

  // One loop: eases the camera toward its target and repaints.
  useEffect(() => {
    let raf = 0;
    const frame = () => {
      const v = view.current;
      const t = target.current;
      if (!drag.current?.active) {
        v.yaw += shortestDelta(v.yaw, t.yaw) * 0.06;
        v.pitch += (t.pitch - v.pitch) * 0.06;
        v.zoom += (t.zoom - v.zoom) * 0.06;
      }
      draw();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [draw]);

  const pick = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    let best: number | null = null;
    let bestDist = 22;
    for (const s of screen.current) {
      if (s.z <= 0.02) continue;
      const d = Math.hypot(s.x - px, s.y - py);
      if (d < bestDist) {
        bestDist = d;
        best = s.round;
      }
    }
    return best;
  };

  return (
    <canvas
      ref={canvasRef}
      aria-label="Season map"
      className="h-full w-full cursor-grab touch-none active:cursor-grabbing"
      onPointerDown={(e) => {
        const hit = pick(e);
        if (hit !== null) {
          onFocusChange(hit);
          return;
        }
        drag.current = { active: true, x: e.clientX, y: e.clientY };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!drag.current?.active) return;
        view.current.yaw += (e.clientX - drag.current.x) * 0.35;
        view.current.pitch = clamp(
          view.current.pitch + (e.clientY - drag.current.y) * 0.004,
          -1,
          1,
        );
        target.current.yaw = view.current.yaw;
        target.current.pitch = view.current.pitch;
        drag.current = { active: true, x: e.clientX, y: e.clientY };
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
    />
  );
}

/** Builds globe rounds from season results, dropping anything not yet raced. */
export function toGlobeRounds(
  rounds: {
    round: number;
    event_name: string;
    date: string;
    circuit_id: number | null;
    circuit_name: string | null;
    podium: RoundSummary["podium"];
  }[],
): GlobeRound[] {
  const seen = new Set<number>();
  const out: GlobeRound[] = [];
  for (const r of rounds) {
    if (seen.has(r.round)) continue;
    if (!r.podium?.length) continue;
    const coord = circuitCoord(r.circuit_id, r.circuit_name);
    if (!coord) continue;
    seen.add(r.round);
    out.push({
      round: r.round,
      name: r.event_name,
      shortName: r.event_name.replace(" Grand Prix", "").trim(),
      date: r.date,
      circuitName: r.circuit_name,
      lat: coord.lat,
      lon: coord.lon,
      podium: r.podium,
    });
  }
  return out.sort((a, b) => a.round - b.round);
}
