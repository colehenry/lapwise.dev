"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TrianglePattern } from "@/components/Patterns";
import Skeleton from "@/components/ui/Skeleton";
import { fetchReplayData } from "@/lib/api";
import type { BattleEvent, ReplayData, ReplayWeather } from "@/lib/types";
import BattleFeed from "./BattleFeed";
import Leaderboard from "./Leaderboard";
import { PlaybackHeader, PlaybackTimeline } from "./PlaybackControls";
import RaceInfo from "./RaceInfo";
import TelemetryPanel from "./TelemetryPanel";
import TrackCanvas, {
  DriverTooltip,
  type TrackTooltipData,
} from "./TrackCanvas";

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
  const [compareDriver, setCompareDriver] = useState<string | null>(null);
  const [feedCollapsed, setFeedCollapsed] = useState(false);
  const [showCorners, setShowCorners] = useState(true);
  const [trackTooltip, setTrackTooltip] = useState<TrackTooltipData | null>(
    null,
  );
  const trackCardRef = useRef<HTMLDivElement>(null);

  // Current weather (tracked as weather only appears on change frames)
  const currentWeatherRef = useRef<ReplayWeather | null>(null);
  const [currentWeather, setCurrentWeather] = useState<ReplayWeather | null>(
    null,
  );

  // Flash highlight for drivers referenced in battle events
  const [highlightedDriver, setHighlightedDriver] = useState<string | null>(
    null,
  );
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleBattleEvent = useCallback((event: BattleEvent) => {
    if (event.driver) {
      setHighlightedDriver(event.driver);
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = setTimeout(() => {
        setHighlightedDriver(null);
      }, 3000);
    }
  }, []);

  // Animation refs
  const animFrameRef = useRef<number>(0);
  const lastTimestampRef = useRef<number>(0);
  const fractionalFrameRef = useRef<number>(0);
  const frameIndexRef = useRef<number>(0);
  const playbackSpeedRef = useRef<number>(playbackSpeed);

  // Keep refs in sync with state
  useEffect(() => {
    frameIndexRef.current = frameIndex;
  }, [frameIndex]);
  useEffect(() => {
    playbackSpeedRef.current = playbackSpeed;
  }, [playbackSpeed]);

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

  // Animation loop — reads from refs to avoid recreating on every frame
  const animate = useCallback((timestamp: number) => {
    const data = dataRef.current;
    if (!data) return;

    if (lastTimestampRef.current === 0) {
      lastTimestampRef.current = timestamp;
      animFrameRef.current = requestAnimationFrame(animate);
      return;
    }

    const elapsed = timestamp - lastTimestampRef.current;
    lastTimestampRef.current = timestamp;

    // Advance fractional frame index
    const frameDuration = 1000 / data.metadata.fps;
    fractionalFrameRef.current +=
      playbackSpeedRef.current * (elapsed / frameDuration);

    const newIndex = Math.floor(fractionalFrameRef.current);

    if (newIndex >= data.metadata.total_frames) {
      // Reached end
      setIsPlaying(false);
      setFrameIndex(data.metadata.total_frames - 1);
      fractionalFrameRef.current = data.metadata.total_frames - 1;
      return;
    }

    if (newIndex !== frameIndexRef.current) {
      // Update weather if the new frame has it
      const frame = data.frames[newIndex];
      if (frame?.w) {
        currentWeatherRef.current = frame.w;
        setCurrentWeather(frame.w);
      }
      setFrameIndex(newIndex);
    }

    animFrameRef.current = requestAnimationFrame(animate);
  }, []);

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

  // Derived state (must be above early returns for hooks rules)
  const currentFrame = replayData?.frames[frameIndex];
  const totalFrames = replayData?.metadata.total_frames ?? 0;
  const currentTime = currentFrame?.t ?? 0;

  // Precompute lap boundaries (frame index where each lap starts)
  const lapBoundaries = useMemo(() => {
    if (!replayData) return [];
    const boundaries: { lap: number; frameIndex: number }[] = [];
    let lastLap = -1;
    for (let i = 0; i < replayData.frames.length; i++) {
      const lap = replayData.frames[i].lap;
      if (lap > lastLap) {
        boundaries.push({ lap, frameIndex: i });
        lastLap = lap;
      }
    }
    return boundaries;
  }, [replayData]);

  // Precompute event markers on timeline (SC, flags, weather)
  const timelineEvents = useMemo(() => {
    if (!replayData) return [];
    const events: {
      frameIndex: number;
      type: "sc" | "vsc" | "red_flag" | "weather" | "drs";
      label: string;
    }[] = [];
    // SC/VSC/Red flag from frames
    let lastSc = 0;
    for (let i = 0; i < replayData.frames.length; i++) {
      const sc = replayData.frames[i].sc;
      if (sc !== lastSc) {
        if (sc === 1) events.push({ frameIndex: i, type: "sc", label: "SC" });
        else if (sc === 2)
          events.push({ frameIndex: i, type: "vsc", label: "VSC" });
        else if (sc === 3)
          events.push({ frameIndex: i, type: "red_flag", label: "RED" });
        lastSc = sc;
      }
      // Weather changes
      if (replayData.frames[i].w?.rainfall) {
        const prev = i > 0 ? replayData.frames[i - 1].w : null;
        if (!prev?.rainfall) {
          events.push({ frameIndex: i, type: "weather", label: "RAIN" });
        }
      }
    }
    return events;
  }, [replayData]);

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
        case "ArrowRight": {
          e.preventDefault();
          // Skip to next lap
          const nextLap = lapBoundaries.find((b) => b.frameIndex > frameIndex);
          if (nextLap) handleSeek(nextLap.frameIndex);
          else handleSeek(data.metadata.total_frames - 1);
          break;
        }
        case "ArrowLeft": {
          e.preventDefault();
          // Skip to previous lap
          const prevLap = lapBoundaries.findLast(
            (b) => b.frameIndex < frameIndex - 10,
          );
          if (prevLap) handleSeek(prevLap.frameIndex);
          else handleSeek(0);
          break;
        }
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
  }, [frameIndex, playbackSpeed, handleSeek, lapBoundaries]);

  // DRS was removed from F1 starting in the 2026 season
  const hasDrs = season < 2026;

  // Derive DRS enabled state from race control messages
  const raceControl = replayData?.race_control;
  const drsEnabled = useMemo(() => {
    if (!hasDrs) return false;
    if (!raceControl?.length) return false;
    let enabled = false;
    for (const msg of raceControl) {
      if (msg.t > currentTime) break;
      if (msg.category === "Drs" || msg.message.toUpperCase().includes("DRS")) {
        const upper = msg.message.toUpperCase();
        if (upper.includes("ENABLED") || upper.includes("DETECTION")) {
          enabled = true;
        } else if (upper.includes("DISABLED")) {
          enabled = false;
        }
      }
    }
    return enabled;
  }, [raceControl, currentTime, hasDrs]);

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
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 space-y-3">
        {/* Top row: Track + Feed | Leaderboard — shared fixed height */}
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Track card with race feed */}
          <div
            className="flex-1 min-w-0 lg:h-[462px] relative"
            ref={trackCardRef}
          >
            <div className="bg-bg-tertiary border border-border-primary rounded-sm shadow-sm overflow-hidden h-full flex flex-col">
              {/* Playback header */}
              <div className="relative h-10 bg-bg-primary border-b border-border-primary px-3 flex items-center overflow-hidden shrink-0">
                <TrianglePattern id="replay-track-triangles" />
                <div className="relative z-10 w-full">
                  <PlaybackHeader
                    isPlaying={isPlaying}
                    playbackSpeed={playbackSpeed}
                    currentLap={currentFrame?.lap ?? 0}
                    totalLaps={replayData.metadata.total_laps}
                    onTogglePlay={handleTogglePlay}
                    onSpeedChange={setPlaybackSpeed}
                    onSeek={handleSeek}
                    speedOptions={SPEED_OPTIONS}
                    lapBoundaries={lapBoundaries}
                    showCorners={showCorners}
                    hasCorners={(replayData.track.corners?.length ?? 0) > 0}
                    onToggleCorners={() => setShowCorners((s) => !s)}
                  />
                </div>
              </div>
              <div className="flex flex-1 min-h-0">
                {/* Track canvas */}
                <div className="flex-1 min-w-0 h-full">
                  <TrackCanvas
                    track={replayData.track}
                    drivers={replayData.drivers}
                    frame={currentFrame}
                    selectedDriver={selectedDriver}
                    highlightedDriver={highlightedDriver}
                    scState={currentFrame?.sc ?? 0}
                    drsEnabled={drsEnabled}
                    hasDrs={hasDrs}
                    showCorners={showCorners}
                    onSelectDriver={setSelectedDriver}
                    onTooltipChange={setTrackTooltip}
                  />
                </div>
                {/* Race feed panel — collapsible */}
                {!feedCollapsed && (
                  <div className="w-52 lg:w-60 border-l border-border-primary flex flex-col shrink-0 h-full">
                    <div className="px-3 py-2 border-b border-border-primary flex items-center justify-between shrink-0">
                      <h3 className="text-[10px] font-mono tracking-widest text-text-muted uppercase font-bold">
                        Race Feed
                      </h3>
                      <button
                        type="button"
                        onClick={() => setFeedCollapsed(true)}
                        className="text-[10px] font-mono text-text-muted hover:text-text-primary transition-colors"
                        title="Collapse feed"
                      >
                        ▸
                      </button>
                    </div>
                    <div className="overflow-y-auto flex-1 min-h-0">
                      <BattleFeed
                        replayData={replayData}
                        currentTime={currentTime}
                        currentLap={currentFrame?.lap ?? 0}
                        hasDrs={hasDrs}
                        onSelectDriver={setSelectedDriver}
                        onBattleEvent={handleBattleEvent}
                      />
                    </div>
                  </div>
                )}
                {/* Collapsed feed toggle */}
                {feedCollapsed && (
                  <div className="border-l border-border-primary flex flex-col items-center shrink-0">
                    <button
                      type="button"
                      onClick={() => setFeedCollapsed(false)}
                      className="px-1.5 py-2 text-[10px] font-mono text-text-muted hover:text-text-primary transition-colors"
                      title="Show feed"
                    >
                      ◂
                    </button>
                  </div>
                )}
              </div>
              {/* Timeline bar at bottom of track card */}
              <PlaybackTimeline
                currentFrame={frameIndex}
                totalFrames={totalFrames}
                currentLap={currentFrame?.lap ?? 0}
                onSeek={handleSeek}
                lapBoundaries={lapBoundaries}
                timelineEvents={timelineEvents}
              />
            </div>
            {/* Driver tooltip — rendered outside card overflow to avoid clipping */}
            {trackTooltip && (
              <DriverTooltip
                x={trackTooltip.screenX}
                y={trackTooltip.screenY + 40}
                code={trackTooltip.code}
                driver={trackTooltip.driver}
                data={trackTooltip.data}
                containerWidth={trackCardRef.current?.offsetWidth ?? 800}
                hasDrs={hasDrs}
              />
            )}
          </div>

          {/* Sidebar — leaderboard: same fixed height as track card */}
          <div className="lg:w-72 shrink-0 flex flex-col lg:h-[462px]">
            <Leaderboard
              drivers={replayData.drivers}
              frame={currentFrame}
              allFrames={replayData.frames}
              frameIndex={frameIndex}
              track={replayData.track}
              metadata={replayData.metadata}
              selectedDriver={selectedDriver}
              compareDriver={compareDriver}
              onSelectDriver={(code) => {
                if (code === selectedDriver) {
                  setSelectedDriver(null);
                  setCompareDriver(null);
                } else if (code === compareDriver) {
                  setCompareDriver(null);
                } else if (selectedDriver && code) {
                  setCompareDriver(code);
                } else {
                  setSelectedDriver(code);
                  setCompareDriver(null);
                }
              }}
            />
          </div>
        </div>

        {/* Full-width telemetry panel */}
        {selectedDriver && (
          <TelemetryPanel
            replayData={replayData}
            selectedDriver={selectedDriver}
            compareDriver={compareDriver}
            frameIndex={frameIndex}
            hasDrs={hasDrs}
            onClearCompare={() => setCompareDriver(null)}
          />
        )}
      </div>
    </div>
  );
}
