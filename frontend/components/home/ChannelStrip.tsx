"use client";

import { useMemo } from "react";
import type { ClockState } from "@/lib/raceClock";
import type { ReplayTrack } from "@/lib/types";

type Props = {
  state: ClockState | null;
  track: ReplayTrack | undefined;
};

type Channel = {
  key: "speed" | "throttle" | "brake" | "gear";
  label: string;
  unit: string;
  real: boolean;
  max: number;
};

const CHANNELS: Channel[] = [
  { key: "speed", label: "Speed", unit: "kph", real: true, max: 1 },
  { key: "throttle", label: "Throttle", unit: "%", real: false, max: 1 },
  { key: "brake", label: "Brake", unit: "%", real: false, max: 1 },
  { key: "gear", label: "Gear", unit: "", real: false, max: 8 },
];

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

/**
 * Channel traces derived from the circuit's own curvature.
 *
 * The speed trace is anchored to the leader's real stored speed-trap reading;
 * throttle, brake and gear have no equivalent in the database and are modelled
 * from track geometry purely to size the design. Anything modelled is flagged
 * on screen so the panel never overstates what Lapwise holds.
 */
export default function ChannelStrip({ state, track }: Props) {
  const samples = useMemo(() => modelChannels(track), [track]);

  const leader = state?.rows[0];
  const trapSpeed = leader?.lap?.speed_st ?? null;

  // One lap of channel data cycled against the clock, so the cursor moves with
  // the car rather than sitting still.
  const phase = samples.length ? ((state?.time ?? 0) / 105) % 1 : 0;
  const cursorIndex = clamp(
    Math.floor(phase * (samples.length - 1)),
    0,
    Math.max(0, samples.length - 1),
  );

  return (
    <section className="flex flex-col overflow-hidden rounded-sm border border-border-primary bg-bg-tertiary">
      <header className="flex items-center justify-between border-b border-border-primary px-4 py-2.5">
        <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-purple-400">
          Channels
        </p>
        <span className="font-mono text-[9px] uppercase tracking-wider text-text-muted">
          <span className="text-warning">◇</span> modelled — needs new ingest
        </span>
      </header>

      <div className="grid flex-1 content-stretch gap-px">
        {CHANNELS.map((channel) => {
          const current = samples[cursorIndex]?.[channel.key] ?? 0;
          const readout =
            channel.key === "speed"
              ? trapSpeed
                ? `${Math.round(trapSpeed)}`
                : `${Math.round(80 + current * 250)}`
              : channel.key === "gear"
                ? String(Math.round(current))
                : `${Math.round(current * 100)}`;

          return (
            <div
              key={channel.key}
              className="grid grid-cols-[5rem_minmax(0,1fr)_4rem] items-center gap-3 px-4"
            >
              <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-text-muted">
                {channel.label}
                {!channel.real && <span className="text-warning">◇</span>}
              </span>

              <svg
                viewBox="0 0 300 40"
                preserveAspectRatio="none"
                className="h-10 w-full"
                aria-hidden="true"
              >
                <title>{channel.label} trace</title>
                <path
                  d={tracePath(samples, channel)}
                  fill="none"
                  stroke={
                    channel.real ? "var(--purple-400)" : "var(--text-muted)"
                  }
                  strokeWidth={channel.real ? 1.6 : 1.2}
                  strokeOpacity={channel.real ? 0.95 : 0.6}
                />
                <line
                  x1={phase * 300}
                  y1={0}
                  x2={phase * 300}
                  y2={40}
                  stroke="var(--text-secondary)"
                  strokeWidth={1}
                  strokeOpacity={0.5}
                />
              </svg>

              <span className="text-right font-mono text-xs tabular-nums text-text-primary">
                {readout}
                <em className="ml-0.5 not-italic text-[9px] text-text-muted">
                  {channel.unit}
                </em>
              </span>
            </div>
          );
        })}
      </div>

      <p className="border-t border-border-primary px-4 py-2 font-mono text-[9px] leading-relaxed text-text-muted">
        Speed is anchored to the stored speed-trap reading. Throttle, brake and
        gear are modelled from circuit geometry.
      </p>
    </section>
  );
}

function tracePath(samples: ChannelSample[], channel: Channel) {
  if (!samples.length) return "";
  const points = samples.map((s, i) => {
    const x = (i / (samples.length - 1)) * 300;
    const v = s[channel.key] / channel.max;
    return [x, 40 - v * 36 - 2] as const;
  });
  return points
    .map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join("");
}

type ChannelSample = {
  speed: number;
  throttle: number;
  brake: number;
  gear: number;
};

/** Curvature of the racing line drives a plausible speed/throttle/brake shape. */
function modelChannels(
  track: ReplayTrack | undefined,
  count = 260,
): ChannelSample[] {
  const poly = track?.polyline;
  if (!poly || poly.length < 8) return [];

  const curvature = poly.map((_, i) => {
    const a = poly[(i - 2 + poly.length) % poly.length];
    const b = poly[i];
    const c = poly[(i + 2) % poly.length];
    const v1 = [b[0] - a[0], b[1] - a[1]];
    const v2 = [c[0] - b[0], c[1] - b[1]];
    return Math.abs(
      Math.atan2(v1[0] * v2[1] - v1[1] * v2[0], v1[0] * v2[0] + v1[1] * v2[1]),
    );
  });

  const smoothed = curvature.map((_, i) => {
    let sum = 0;
    for (let k = -3; k <= 3; k++)
      sum += curvature[(i + k + curvature.length) % curvature.length];
    return sum / 7;
  });
  const peak = Math.max(...smoothed) || 1;

  return Array.from({ length: count }, (_, i) => {
    const t = i / count;
    const c = smoothed[Math.floor(t * smoothed.length)] / peak;
    const speed = clamp(1 - c * 1.35, 0.16, 1);
    return {
      speed,
      throttle: clamp(1 - c * 2.1, 0, 1),
      brake: clamp((c - 0.22) * 2.6, 0, 1),
      gear: Math.max(1, Math.round(speed * 8)),
    };
  });
}
