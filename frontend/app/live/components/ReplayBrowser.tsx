"use client";

import { useQuery } from "@tanstack/react-query";
import { TrackMapCompact } from "@/components/TrackMapDisplay";
import Skeleton from "@/components/ui/Skeleton";
import TiltCard from "@/components/ui/TiltCard";
import { fetchAvailableReplays } from "@/lib/api";
import type { ReplayListItem } from "@/lib/types";

interface ReplayBrowserProps {
  season: number | null;
  onSelect: (season: number, round: number, eventName: string) => void;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function ReplayBrowser({
  season,
  onSelect,
}: ReplayBrowserProps) {
  const {
    data: replaysData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["availableReplays", season],
    queryFn: () => fetchAvailableReplays(season as number),
    enabled: season !== null,
  });

  if (season === null || isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {["a", "b", "c", "d", "e", "f"].map((key) => (
          <Skeleton key={key} variant="rectangular" height="140px" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-red-400 font-mono text-xs">Failed to load replays.</p>
    );
  }

  if (!replaysData?.replays.length) {
    return (
      <p className="text-text-muted font-mono text-xs tracking-widest uppercase text-center py-16">
        No replays available for {season}.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {replaysData.replays.map((replay) => (
        <ReplayCard
          key={replay.round}
          replay={replay}
          onSelect={() => onSelect(season, replay.round, replay.event_name)}
        />
      ))}
    </div>
  );
}

function ReplayCard({
  replay,
  onSelect,
}: {
  replay: ReplayListItem;
  onSelect: () => void;
}) {
  return (
    <TiltCard>
      <button
        type="button"
        onClick={onSelect}
        className="w-full bg-bg-tertiary border border-border-primary rounded-sm shadow-sm transition-all duration-150 cursor-pointer text-left h-[140px] relative overflow-hidden hover:border-purple-500 hover:shadow-purple"
      >
        <div className="flex items-center gap-4 p-4 h-full">
          {/* Left side: Race info */}
          <div className="flex-1 min-w-0 flex flex-col h-full">
            {/* Round + Race name */}
            <div className="mb-1">
              <span className="text-[10px] text-text-muted tracking-widest uppercase font-mono font-bold">
                RND {String(replay.round).padStart(2, "0")}
              </span>
              <h3 className="font-semibold text-text-primary text-sm truncate">
                {replay.event_name.replace("Grand Prix", "GP")}
              </h3>
            </div>

            {/* Circuit + date */}
            <p className="text-text-muted text-[10px] tracking-wide truncate">
              {replay.circuit_name} &middot;{" "}
              {new Date(replay.date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>

            {/* Divider */}
            <div className="border-b border-border-primary my-2" />

            {/* Stats row */}
            <div className="flex items-center gap-3 mt-auto">
              <div className="flex items-center gap-1.5">
                <svg
                  className="w-3 h-3 text-text-muted"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <title>Laps</title>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                <span className="text-[10px] font-mono text-text-muted tracking-wider">
                  {replay.total_laps} LAPS
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <svg
                  className="w-3 h-3 text-text-muted"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <title>Drivers</title>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <span className="text-[10px] font-mono text-text-muted tracking-wider">
                  {replay.driver_count}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <svg
                  className="w-3 h-3 text-text-muted"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <title>Duration</title>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="text-[10px] font-mono text-text-muted tracking-wider">
                  {formatDuration(replay.total_duration_seconds)}
                </span>
              </div>
            </div>
          </div>

          {/* Right side: Track map */}
          <TrackMapCompact
            circuitId={replay.circuit_id}
            circuitName={replay.circuit_name}
            patternId={`replay-track-dots-${replay.round}`}
          />
        </div>
      </button>
    </TiltCard>
  );
}
