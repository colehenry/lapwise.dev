"use client";

interface PlaybackControlsProps {
  isPlaying: boolean;
  playbackSpeed: number;
  currentFrame: number;
  totalFrames: number;
  currentTime: number;
  totalTime: number;
  onTogglePlay: () => void;
  onSpeedChange: (speed: number) => void;
  onSeek: (frame: number) => void;
  speedOptions: number[];
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0)
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function PlaybackControls({
  isPlaying,
  playbackSpeed,
  currentFrame,
  totalFrames,
  currentTime,
  totalTime,
  onTogglePlay,
  onSpeedChange,
  onSeek,
  speedOptions,
}: PlaybackControlsProps) {
  return (
    <div className="bg-bg-tertiary border border-border-primary rounded-sm p-3 space-y-2">
      {/* Scrub bar */}
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

        {/* Time */}
        <span className="text-xs font-mono text-text-muted w-16 text-right shrink-0">
          {formatTime(currentTime)}
        </span>

        {/* Slider */}
        <input
          type="range"
          min={0}
          max={totalFrames - 1}
          value={currentFrame}
          onChange={(e) => onSeek(Number(e.target.value))}
          className="flex-1 h-1.5 bg-bg-primary rounded-full appearance-none cursor-pointer accent-purple-500
                     [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
                     [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-500
                     [&::-webkit-slider-thumb]:cursor-pointer"
        />

        {/* Total time */}
        <span className="text-xs font-mono text-text-muted w-16 shrink-0">
          {formatTime(totalTime)}
        </span>
      </div>

      {/* Speed + shortcuts */}
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
          Space: play/pause &middot; &larr;&rarr;: skip 10s &middot; +/-: speed
        </div>
      </div>
    </div>
  );
}
