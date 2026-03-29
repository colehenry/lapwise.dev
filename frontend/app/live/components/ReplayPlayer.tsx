"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
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
      <div className="min-h-screen bg-bg-primary p-6">
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
      <div className="min-h-screen bg-bg-primary p-6">
        <div className="max-w-7xl mx-auto">
          <button
            type="button"
            onClick={onBack}
            className="text-text-muted hover:text-text-primary text-sm mb-4"
          >
            &larr; Back to replays
          </button>
          <div className="bg-bg-tertiary border border-border-primary rounded-sm p-8 text-center">
            <p className="text-red-400">
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
  const _fps = replayData.metadata.fps;
  const currentTime = currentFrame?.t ?? 0;
  const totalTime = replayData.metadata.total_duration_seconds;

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Header */}
      <div className="border-b border-border-primary bg-bg-secondary px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onBack}
              className="text-text-muted hover:text-text-primary text-sm transition-colors"
            >
              &larr; Back
            </button>
            <div>
              <h2 className="text-sm font-semibold text-text-primary">
                {eventName}
              </h2>
              <p className="text-xs text-text-muted">
                {season} &middot; Round {round}
              </p>
            </div>
          </div>
          <RaceInfo
            currentLap={currentFrame?.lap ?? 0}
            totalLaps={replayData.metadata.total_laps}
            scState={currentFrame?.sc ?? 0}
            weather={currentWeather}
          />
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Track canvas */}
          <div className="flex-1 min-w-0">
            <div className="bg-bg-tertiary border border-border-primary rounded-sm overflow-hidden">
              <TrackCanvas
                track={replayData.track}
                drivers={replayData.drivers}
                frame={currentFrame}
                selectedDriver={selectedDriver}
                onSelectDriver={setSelectedDriver}
              />
            </div>

            {/* Playback controls */}
            <div className="mt-3">
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
          </div>

          {/* Sidebar */}
          <div className="lg:w-72 space-y-4">
            <Leaderboard
              drivers={replayData.drivers}
              frame={currentFrame}
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
