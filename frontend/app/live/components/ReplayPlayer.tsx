"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { TrianglePattern } from "@/components/Patterns";
import Skeleton from "@/components/ui/Skeleton";
import { fetchReplayData } from "@/lib/api";
import type { ReplayData, ReplayWeather } from "@/lib/types";
import Leaderboard from "./Leaderboard";
import PlaybackControls from "./PlaybackControls";
import RaceControlFeed from "./RaceControlFeed";
import RaceInfo from "./RaceInfo";
import TrackCanvas from "./TrackCanvas";

interface ReplayPlayerProps {
  season: number;
  round: number;
  eventName: string;
  onBack: () => void;
}

const SPEED_OPTIONS = [0.5, 1, 2, 4, 8, 16];

export default function ReplayPlayer({
  season,
  round,
  eventName,
  onBack,
}: ReplayPlayerProps) {
  const {
    data: replayData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["replayData", season, round],
    queryFn: () => fetchReplayData(season, round),
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 30 * 60 * 1000,
  });

  // Store decoded data in ref to avoid re-render overhead
  const dataRef = useRef<ReplayData | null>(null);

  // Playback state
  const [frameIndex, setFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);

  // Current weather (tracked as weather only appears on change frames)
  const currentWeatherRef = useRef<ReplayWeather | null>(null);
  const [currentWeather, setCurrentWeather] = useState<ReplayWeather | null>(
    null,
  );

  // Animation refs
  const animFrameRef = useRef<number>(0);
  const lastTimestampRef = useRef<number>(0);
  const fractionalFrameRef = useRef<number>(0);

  // Update ref when data loads
  useEffect(() => {
    if (replayData) {
      dataRef.current = replayData;
      // Set initial weather from first frame that has it
      for (const frame of replayData.frames) {
        if (frame.w) {
          currentWeatherRef.current = frame.w;
          setCurrentWeather(frame.w);
          break;
        }
      }
    }
  }, [replayData]);

  // Animation loop
  const animate = useCallback(
    (timestamp: number) => {
      const data = dataRef.current;
      if (!data || !isPlaying) return;

      if (lastTimestampRef.current === 0) {
        lastTimestampRef.current = timestamp;
        animFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      const elapsed = timestamp - lastTimestampRef.current;
      lastTimestampRef.current = timestamp;

      // Advance fractional frame index
      const frameDuration = 1000 / data.metadata.fps;
      fractionalFrameRef.current += playbackSpeed * (elapsed / frameDuration);

      const newIndex = Math.floor(fractionalFrameRef.current);

      if (newIndex >= data.metadata.total_frames) {
        // Reached end
        setIsPlaying(false);
        setFrameIndex(data.metadata.total_frames - 1);
        fractionalFrameRef.current = data.metadata.total_frames - 1;
        return;
      }

      if (newIndex !== frameIndex) {
        // Update weather if the new frame has it
        const frame = data.frames[newIndex];
        if (frame?.w) {
          currentWeatherRef.current = frame.w;
          setCurrentWeather(frame.w);
        }
        setFrameIndex(newIndex);
      }

      animFrameRef.current = requestAnimationFrame(animate);
    },
    [isPlaying, playbackSpeed, frameIndex],
  );

  useEffect(() => {
    if (isPlaying) {
      lastTimestampRef.current = 0;
      animFrameRef.current = requestAnimationFrame(animate);
    }
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isPlaying, animate]);

  const handleSeek = useCallback((newIndex: number) => {
    fractionalFrameRef.current = newIndex;
    setFrameIndex(newIndex);
    // Scan backwards for most recent weather
    const data = dataRef.current;
    if (data) {
      for (let i = newIndex; i >= 0; i--) {
        const w = data.frames[i]?.w;
        if (w) {
          currentWeatherRef.current = w;
          setCurrentWeather(w);
          break;
        }
      }
    }
  }, []);

  const handleTogglePlay = useCallback(() => {
    setIsPlaying((p) => !p);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      const data = dataRef.current;
      if (!data) return;

      switch (e.code) {
        case "Space":
          e.preventDefault();
          setIsPlaying((p) => !p);
          break;
        case "ArrowRight":
          e.preventDefault();
          handleSeek(
            Math.min(
              frameIndex + data.metadata.fps * 10,
              data.metadata.total_frames - 1,
            ),
          );
          break;
        case "ArrowLeft":
          e.preventDefault();
          handleSeek(Math.max(frameIndex - data.metadata.fps * 10, 0));
          break;
        case "Equal":
        case "NumpadAdd": {
          const idx = SPEED_OPTIONS.indexOf(playbackSpeed);
          if (idx < SPEED_OPTIONS.length - 1) {
            setPlaybackSpeed(SPEED_OPTIONS[idx + 1]);
          }
          break;
        }
        case "Minus":
        case "NumpadSubtract": {
          const idx = SPEED_OPTIONS.indexOf(playbackSpeed);
          if (idx > 0) {
            setPlaybackSpeed(SPEED_OPTIONS[idx - 1]);
          }
          break;
        }
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [frameIndex, playbackSpeed, handleSeek]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg-secondary p-6">
        <div className="max-w-7xl mx-auto space-y-4">
          <Skeleton variant="text" width="300px" height="32px" />
          <Skeleton variant="rectangular" height="500px" />
          <Skeleton variant="rectangular" height="60px" />
        </div>
      </div>
    );
  }

  if (error || !replayData) {
    return (
      <div className="min-h-screen bg-bg-secondary p-6">
        <div className="max-w-7xl mx-auto">
          <button
            type="button"
            onClick={onBack}
            className="bg-bg-primary border border-border-primary text-text-primary font-mono text-xs font-bold px-4 py-2 rounded-sm hover:border-purple-500 hover:text-purple-300 transition-colors duration-150 cursor-pointer flex items-center gap-2 mb-4"
          >
            <span>&larr;</span>
            <span>Back to replays</span>
          </button>
          <div className="bg-bg-tertiary border border-border-primary rounded-sm p-8 text-center">
            <p className="text-red-400 font-mono text-sm">
              Failed to load replay data. This race may not have telemetry
              available.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const currentFrame = replayData.frames[frameIndex];
  const totalFrames = replayData.metadata.total_frames;
  const currentTime = currentFrame?.t ?? 0;
  const totalTime = replayData.metadata.total_duration_seconds;

  return (
    <div className="min-h-screen bg-bg-secondary">
      {/* Sticky Header - matches race weekend hub style */}
      <div className="sticky top-0 z-40">
        <div className="px-4">
          <div className="mx-auto w-full max-w-full md:max-w-[calc(72rem+40px)]">
            <div className="bg-bg-secondary/95 backdrop-blur-xl border-x border-b border-border-primary rounded-b-3xl rounded-t-none shadow-[0_10px_36px_rgba(0,0,0,0.35)]">
              <div className="h-14 px-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={onBack}
                    className="bg-bg-primary border border-border-primary text-text-primary font-mono text-xs font-bold px-4 py-2 rounded-sm hover:border-purple-500 hover:text-purple-300 transition-colors duration-150 cursor-pointer flex items-center gap-2"
                  >
                    <span>&larr;</span>
                    <span className="hidden sm:inline">BACK</span>
                  </button>
                </div>

                <div className="flex flex-col items-center">
                  <span className="text-text-primary font-mono text-sm font-bold leading-none">
                    {eventName}
                  </span>
                  <span className="text-text-muted text-[10px] tracking-widest uppercase font-bold">
                    {season} &middot; Round {String(round).padStart(2, "0")}
                  </span>
                </div>

                <RaceInfo
                  currentLap={currentFrame?.lap ?? 0}
                  totalLaps={replayData.metadata.total_laps}
                  scState={currentFrame?.sc ?? 0}
                  weather={currentWeather}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Track canvas */}
          <div className="flex-1 min-w-0 space-y-3">
            <div className="bg-bg-tertiary border border-border-primary rounded-sm shadow-sm overflow-hidden">
              <div className="relative h-10 bg-bg-primary border-b border-border-primary px-4 flex items-center overflow-hidden">
                <TrianglePattern id="replay-track-triangles" />
                <span className="relative z-10 text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono">
                  Track Map
                </span>
              </div>
              <TrackCanvas
                track={replayData.track}
                drivers={replayData.drivers}
                frame={currentFrame}
                selectedDriver={selectedDriver}
                onSelectDriver={setSelectedDriver}
              />
            </div>

            {/* Playback controls */}
            <PlaybackControls
              isPlaying={isPlaying}
              playbackSpeed={playbackSpeed}
              currentFrame={frameIndex}
              totalFrames={totalFrames}
              currentTime={currentTime}
              totalTime={totalTime}
              onTogglePlay={handleTogglePlay}
              onSpeedChange={setPlaybackSpeed}
              onSeek={handleSeek}
              speedOptions={SPEED_OPTIONS}
            />
          </div>

          {/* Sidebar */}
          <div className="lg:w-72 space-y-4">
            <Leaderboard
              drivers={replayData.drivers}
              frame={currentFrame}
              track={replayData.track}
              selectedDriver={selectedDriver}
              onSelectDriver={setSelectedDriver}
            />
            <RaceControlFeed
              messages={replayData.race_control}
              currentTime={currentTime}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
