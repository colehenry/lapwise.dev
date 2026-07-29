"use client";

import type { RaceClockController } from "@/hooks/useRaceClock";

type Props = {
  controller: RaceClockController;
  rates: readonly number[];
};

function raceTime(seconds: number) {
  if (!Number.isFinite(seconds)) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds - h * 3600) / 60);
  const s = Math.floor(seconds - h * 3600 - m * 60);
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

/** Sits inside the track card, so playback controls are on the map itself. */
export default function TransportBar({ controller, rates }: Props) {
  const { playing, toggle, seek, duration, state, rate, setRate } = controller;
  const disabled = duration <= 0;

  return (
    <div className="flex flex-col gap-2 rounded-sm border border-border-primary bg-bg-primary/85 p-2 backdrop-blur-md">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggle}
          disabled={disabled}
          aria-label={playing ? "Pause replay" : "Play replay"}
          className="grid h-7 w-7 place-items-center rounded-sm bg-purple-500 text-[10px] text-white transition-colors hover:bg-purple-400 disabled:opacity-40"
        >
          {playing ? "❙❙" : "▶"}
        </button>
        <span className="font-mono text-[10px] tabular-nums text-text-secondary">
          {raceTime(state?.time ?? 0)}
        </span>
      </div>

      <input
        type="range"
        min={0}
        max={Math.max(1, Math.round(duration))}
        step={1}
        value={Math.round(state?.time ?? 0)}
        onChange={(e) => seek(Number(e.target.value))}
        disabled={disabled}
        aria-label="Race time"
        className="h-1 w-32 cursor-pointer appearance-none rounded-full bg-border-secondary accent-purple-500"
      />

      <div className="flex gap-1">
        {rates.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRate(r)}
            aria-pressed={r === rate}
            className={`rounded-sm border px-1.5 py-0.5 font-mono text-[9px] font-bold transition-colors ${
              r === rate
                ? "border-purple-500 bg-purple-500/15 text-purple-300"
                : "border-border-primary text-text-muted hover:text-text-secondary"
            }`}
          >
            {r}×
          </button>
        ))}
      </div>
    </div>
  );
}
