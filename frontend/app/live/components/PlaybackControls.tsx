"use client";

import { useState } from "react";

interface LapBoundary {
  lap: number;
  frameIndex: number;
}

interface TimelineEvent {
  frameIndex: number;
  type: "sc" | "vsc" | "red_flag" | "weather" | "drs";
  label: string;
}

interface PlaybackControlsProps {
  isPlaying: boolean;
  playbackSpeed: number;
  currentFrame: number;
  totalFrames: number;
  currentLap: number;
  totalLaps: number;
  onTogglePlay: () => void;
  onSpeedChange: (speed: number) => void;
  onSeek: (frame: number) => void;
  speedOptions: number[];
  lapBoundaries: LapBoundary[];
  timelineEvents: TimelineEvent[];
}

const EVENT_COLORS: Record<string, string> = {
  sc: "#f59e0b", // yellow
  vsc: "#eab308", // amber
  red_flag: "#ef4444", // red
  weather: "#06b6d4", // cyan
  drs: "#22c55e", // green
};

export default function PlaybackControls({
  isPlaying,
  playbackSpeed,
  currentFrame,
  totalFrames,
  currentLap,
  totalLaps,
  onTogglePlay,
  onSpeedChange,
  onSeek,
  speedOptions,
  lapBoundaries,
  timelineEvents,
}: PlaybackControlsProps) {
  // Find frame index for jumping to a specific lap
  const seekToLap = (lap: number) => {
    const boundary = lapBoundaries.find((b) => b.lap === lap);
    if (boundary) onSeek(boundary.frameIndex);
  };

  const [hoveredEvent, setHoveredEvent] = useState<number | null>(null);

  const progressPct =
    totalFrames > 1 ? (currentFrame / (totalFrames - 1)) * 100 : 0;

  return (
    <div className="bg-bg-tertiary border border-border-primary rounded-sm p-3 shadow-sm space-y-2">
      {/* Timeline with event markers */}
      <div className="flex items-center gap-3">
        {/* Play/Pause */}
        <button
          type="button"
          onClick={onTogglePlay}
          className="w-8 h-8 flex items-center justify-center rounded-sm bg-purple-500 hover:bg-purple-400 text-white transition-colors shrink-0"
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <title>Pause</title>
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <title>Play</title>
              <path d="M8 5.14v14.72a1 1 0 0 0 1.5.86l11-7.36a1 1 0 0 0 0-1.72l-11-7.36A1 1 0 0 0 8 5.14z" />
            </svg>
          )}
        </button>

        {/* Lap indicator */}
        <span className="text-xs font-mono text-text-primary w-20 text-center shrink-0 font-bold">
          Lap {currentLap}/{totalLaps}
        </span>

        {/* Custom timeline */}
        <div className="flex-1 relative h-6 group">
          {/* Track bar background */}
          <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-1.5 bg-bg-primary rounded-full" />

          {/* Progress fill */}
          <div
            className="absolute top-1/2 -translate-y-1/2 left-0 h-1.5 bg-purple-500/60 rounded-full"
            style={{ width: `${progressPct}%` }}
          />

          {/* Lap boundary ticks */}
          {lapBoundaries.map((b) => {
            const pct = (b.frameIndex / Math.max(totalFrames - 1, 1)) * 100;
            return (
              <button
                key={b.lap}
                type="button"
                className="absolute top-1/2 -translate-y-1/2 w-px h-3 bg-text-muted/30 hover:bg-text-muted/60 cursor-pointer"
                style={{ left: `${pct}%` }}
                onClick={() => seekToLap(b.lap)}
                title={`Lap ${b.lap}`}
              >
                <span className="sr-only">Lap {b.lap}</span>
              </button>
            );
          })}

          {/* Event callout markers */}
          {timelineEvents.map((ev, i) => {
            const pct = (ev.frameIndex / Math.max(totalFrames - 1, 1)) * 100;
            const color = EVENT_COLORS[ev.type] ?? "#999";
            const isHovered = hoveredEvent === i;
            return (
              <button
                key={`${ev.type}-${i}`}
                type="button"
                className="absolute top-0 -translate-x-1/2 cursor-pointer z-30"
                style={{ left: `${pct}%` }}
                onClick={() => onSeek(ev.frameIndex)}
                onMouseEnter={() => setHoveredEvent(i)}
                onMouseLeave={() => setHoveredEvent(null)}
              >
                <div
                  className={`rounded-full transition-transform ${isHovered ? "w-2 h-2 scale-125" : "w-1.5 h-1.5"}`}
                  style={{ backgroundColor: color }}
                />
                {isHovered && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-bg-elevated border border-border-primary rounded-sm shadow-lg whitespace-nowrap pointer-events-none">
                    <span className="text-[10px] font-mono text-text-primary">
                      {ev.label}
                    </span>
                  </div>
                )}
              </button>
            );
          })}

          {/* Playhead */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 bg-purple-500 rounded-full shadow-sm border border-purple-300/50 pointer-events-none z-10"
            style={{ left: `${progressPct}%` }}
          />

          {/* Invisible range input for scrubbing */}
          <input
            type="range"
            min={0}
            max={totalFrames - 1}
            value={currentFrame}
            onChange={(e) => onSeek(Number(e.target.value))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
          />
        </div>

        {/* Lap jump buttons */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => {
              const prevLap = lapBoundaries.findLast((b) => b.lap < currentLap);
              if (prevLap) onSeek(prevLap.frameIndex);
            }}
            className="w-6 h-6 flex items-center justify-center rounded-sm bg-bg-primary border border-border-primary text-text-muted hover:text-text-primary text-[10px] font-mono transition-colors"
            title="Previous lap"
          >
            &larr;
          </button>
          <button
            type="button"
            onClick={() => {
              const nextLap = lapBoundaries.find((b) => b.lap > currentLap);
              if (nextLap) onSeek(nextLap.frameIndex);
            }}
            className="w-6 h-6 flex items-center justify-center rounded-sm bg-bg-primary border border-border-primary text-text-muted hover:text-text-primary text-[10px] font-mono transition-colors"
            title="Next lap"
          >
            &rarr;
          </button>
        </div>
      </div>

      {/* Speed controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span className="text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono mr-1">
            Speed
          </span>
          {speedOptions.map((speed) => (
            <button
              key={speed}
              type="button"
              onClick={() => onSpeedChange(speed)}
              className={`px-2 py-0.5 rounded-sm text-[10px] font-mono transition-colors ${
                playbackSpeed === speed
                  ? "bg-purple-500 text-white"
                  : "bg-bg-primary text-text-muted hover:text-text-primary border border-border-primary"
              }`}
            >
              {speed}x
            </button>
          ))}
        </div>

        <div className="text-[10px] text-text-muted font-mono hidden md:block">
          Space: play &middot; &larr;&rarr;: skip lap &middot; +/-: speed
        </div>
      </div>
    </div>
  );
}
