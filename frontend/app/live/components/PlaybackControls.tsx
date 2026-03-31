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

interface PlaybackHeaderProps {
  isPlaying: boolean;
  playbackSpeed: number;
  currentLap: number;
  totalLaps: number;
  onTogglePlay: () => void;
  onSpeedChange: (speed: number) => void;
  onSeek: (frame: number) => void;
  speedOptions: number[];
  lapBoundaries: LapBoundary[];
  showCorners: boolean;
  hasCorners: boolean;
  onToggleCorners: () => void;
}

interface PlaybackTimelineProps {
  currentFrame: number;
  totalFrames: number;
  currentLap: number;
  onSeek: (frame: number) => void;
  lapBoundaries: LapBoundary[];
  timelineEvents: TimelineEvent[];
}

const EVENT_COLORS: Record<string, string> = {
  sc: "#f59e0b",
  vsc: "#eab308",
  red_flag: "#ef4444",
  weather: "#06b6d4",
  drs: "#22c55e",
};

/** Compact controls for the track card header bar */
export function PlaybackHeader({
  isPlaying,
  playbackSpeed,
  currentLap,
  totalLaps,
  onTogglePlay,
  onSpeedChange,
  onSeek,
  speedOptions,
  lapBoundaries,
  showCorners,
  hasCorners,
  onToggleCorners,
}: PlaybackHeaderProps) {
  return (
    <div className="flex items-center gap-2 w-full">
      {/* Play/Pause */}
      <button
        type="button"
        onClick={onTogglePlay}
        className="w-6 h-6 flex items-center justify-center rounded-sm bg-purple-500 hover:bg-purple-400 text-white transition-colors shrink-0"
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? (
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
            <title>Pause</title>
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
            <title>Play</title>
            <path d="M8 5.14v14.72a1 1 0 0 0 1.5.86l11-7.36a1 1 0 0 0 0-1.72l-11-7.36A1 1 0 0 0 8 5.14z" />
          </svg>
        )}
      </button>

      {/* Lap indicator + nav */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => {
            const prevLap = lapBoundaries.findLast((b) => b.lap < currentLap);
            if (prevLap) onSeek(prevLap.frameIndex);
          }}
          className="w-5 h-5 flex items-center justify-center rounded-sm bg-bg-primary border border-border-primary text-text-muted hover:text-text-primary text-[9px] font-mono transition-colors"
          title="Previous lap"
        >
          &larr;
        </button>
        <span className="text-[10px] font-mono text-text-primary font-bold tabular-nums w-16 text-center">
          Lap {currentLap}/{totalLaps}
        </span>
        <button
          type="button"
          onClick={() => {
            const nextLap = lapBoundaries.find((b) => b.lap > currentLap);
            if (nextLap) onSeek(nextLap.frameIndex);
          }}
          className="w-5 h-5 flex items-center justify-center rounded-sm bg-bg-primary border border-border-primary text-text-muted hover:text-text-primary text-[9px] font-mono transition-colors"
          title="Next lap"
        >
          &rarr;
        </button>
      </div>

      {/* Divider */}
      <div className="w-px h-4 bg-border-primary shrink-0" />

      {/* Speed pills */}
      <div className="flex items-center gap-0.5 shrink-0">
        {speedOptions.map((speed) => (
          <button
            key={speed}
            type="button"
            onClick={() => onSpeedChange(speed)}
            className={`px-1.5 py-0.5 rounded-sm text-[9px] font-mono transition-colors ${
              playbackSpeed === speed
                ? "bg-purple-500 text-white"
                : "bg-bg-primary text-text-muted hover:text-text-primary border border-border-primary"
            }`}
          >
            {speed}x
          </button>
        ))}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Corners toggle */}
      {hasCorners && (
        <button
          type="button"
          onClick={onToggleCorners}
          className={`px-2 py-0.5 rounded-sm text-[9px] font-mono transition-colors shrink-0 ${
            showCorners
              ? "bg-purple-500/20 text-purple-300 border border-purple-500/40"
              : "bg-bg-primary/60 text-text-muted border border-border-primary/40"
          }`}
        >
          Corners
        </button>
      )}
    </div>
  );
}

/** Thin timeline bar for the bottom of the track card */
export function PlaybackTimeline({
  currentFrame,
  totalFrames,
  currentLap,
  onSeek,
  lapBoundaries,
  timelineEvents,
}: PlaybackTimelineProps) {
  const seekToLap = (lap: number) => {
    const boundary = lapBoundaries.find((b) => b.lap === lap);
    if (boundary) onSeek(boundary.frameIndex);
  };

  const [hoveredEvent, setHoveredEvent] = useState<number | null>(null);

  const progressPct =
    totalFrames > 1 ? (currentFrame / (totalFrames - 1)) * 100 : 0;

  return (
    <div className="relative h-[30px] shrink-0 border-t border-border-primary bg-bg-primary/40">
      {/* Inner container — all elements positioned relative to this */}
      <div className="absolute top-0 bottom-0 left-3 right-3">
        {/* Track bar background */}
        <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-px bg-text-muted/20" />

        {/* Progress fill */}
        <div
          className="absolute top-1/2 -translate-y-1/2 left-0 h-px bg-text-muted/40"
          style={{ width: `${progressPct}%` }}
        />
        {/* Lap boundary ticks */}
        {lapBoundaries.map((b) => {
          const pct = (b.frameIndex / Math.max(totalFrames - 1, 1)) * 100;
          return (
            <button
              key={b.lap}
              type="button"
              className="absolute top-1/2 -translate-y-1/2 w-px h-2.5 bg-text-muted/30 hover:bg-text-muted/60 cursor-pointer"
              style={{ left: `${pct}%` }}
              onClick={() => seekToLap(b.lap)}
              title={`Lap ${b.lap}`}
            >
              <span className="sr-only">Lap {b.lap}</span>
            </button>
          );
        })}

        {/* Event markers — short colored ticks from top */}
        {timelineEvents.map((ev, i) => {
          const pct = (ev.frameIndex / Math.max(totalFrames - 1, 1)) * 100;
          const color = EVENT_COLORS[ev.type] ?? "#999";
          const isHovered = hoveredEvent === i;
          return (
            <button
              key={`${ev.type}-${i}`}
              type="button"
              className="absolute top-0 -translate-x-1/2 cursor-pointer z-30 w-4 flex justify-center"
              style={{ left: `${pct}%`, height: "40%" }}
              onClick={() => onSeek(ev.frameIndex)}
              onMouseEnter={() => setHoveredEvent(i)}
              onMouseLeave={() => setHoveredEvent(null)}
            >
              <div
                className={`h-full rounded-b-full transition-all ${isHovered ? "opacity-90 w-[3px]" : "opacity-50 w-[2px]"}`}
                style={{ backgroundColor: color }}
              />
              {isHovered && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-bg-elevated border border-border-primary rounded-sm shadow-lg whitespace-nowrap pointer-events-none">
                  <span className="text-[10px] font-mono text-text-primary">
                    {ev.label}
                  </span>
                </div>
              )}
            </button>
          );
        })}

        {/* Playhead — line with top indicator */}
        <div
          className="absolute top-0 bottom-0 -translate-x-1/2 pointer-events-none z-10 flex flex-col items-center"
          style={{ left: `${progressPct}%` }}
        >
          {/* Triangle indicator */}
          <div
            className="w-0 h-0 shrink-0"
            style={{
              borderLeft: "4px solid transparent",
              borderRight: "4px solid transparent",
              borderTop: "5px solid rgba(255,255,255,0.8)",
            }}
          />
          {/* Vertical line */}
          <div className="w-px flex-1 bg-text-primary/50" />
        </div>

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
    </div>
  );
}

/** @deprecated Use PlaybackHeader + PlaybackTimeline instead */
export default function PlaybackControls() {
  return null;
}
