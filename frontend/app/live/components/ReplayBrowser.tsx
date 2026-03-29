"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import { useState } from "react";
import Card from "@/components/ui/Card";
import Skeleton from "@/components/ui/Skeleton";
import { fetchAvailableReplays, fetchReplaySeasons } from "@/lib/api";
import type { ReplayListItem } from "@/lib/types";

interface ReplayBrowserProps {
  onSelect: (season: number, round: number, eventName: string) => void;
}

const _COMPOUND_LABELS: Record<number, string> = {
  0: "SOFT",
  1: "MEDIUM",
  2: "HARD",
  3: "INTER",
  4: "WET",
};

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function _formatSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

export default function ReplayBrowser({ onSelect }: ReplayBrowserProps) {
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);

  const {
    data: seasons,
    isLoading: seasonsLoading,
    error: seasonsError,
  } = useQuery({
    queryKey: ["replaySeasons"],
    queryFn: fetchReplaySeasons,
  });

  // Auto-select latest season when data loads
  const activeSeason = selectedSeason ?? seasons?.[0] ?? null;

  const {
    data: replaysData,
    isLoading: replaysLoading,
    error: replaysError,
  } = useQuery({
    queryKey: ["availableReplays", activeSeason],
    queryFn: () => fetchAvailableReplays(activeSeason as number),
    enabled: activeSeason !== null,
  });

  if (seasonsLoading) {
    return (
      <div className="space-y-4">
        <Skeleton variant="text" width="200px" height="32px" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {["a", "b", "c", "d", "e", "f"].map((key) => (
            <Skeleton key={key} variant="rectangular" height="180px" />
          ))}
        </div>
      </div>
    );
  }

  if (seasonsError || !seasons?.length) {
    return (
      <div className="text-center py-16">
        <p className="text-text-muted text-lg">
          No replay data available yet. Replay data is generated from FastF1
          telemetry for 2018+ seasons.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Season selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono">
          Season
        </span>
        <div className="flex items-center gap-1 flex-wrap">
          {seasons.map((season) => (
            <button
              key={season}
              type="button"
              onClick={() => setSelectedSeason(season)}
              className={`px-3 py-1 rounded-sm text-xs font-mono tracking-wider transition-colors ${
                activeSeason === season
                  ? "bg-purple-500 text-white"
                  : "bg-bg-primary text-text-muted hover:text-text-primary hover:bg-bg-elevated border border-border-primary"
              }`}
            >
              {season}
            </button>
          ))}
        </div>
      </div>

      {/* Race grid */}
      {replaysLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {["g", "h", "i", "j", "k", "l"].map((key) => (
            <Skeleton key={key} variant="rectangular" height="180px" />
          ))}
        </div>
      ) : replaysError ? (
        <p className="text-red-400 text-sm">Failed to load replays.</p>
      ) : !replaysData?.replays.length ? (
        <p className="text-text-muted">
          No replays available for {activeSeason}.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {replaysData.replays.map((replay) => (
            <ReplayCard
              key={replay.round}
              replay={replay}
              onSelect={() =>
                onSelect(
                  activeSeason as number,
                  replay.round,
                  replay.event_name,
                )
              }
            />
          ))}
        </div>
      )}
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
    <Card variant="interactive" padding="none" onClick={onSelect}>
      <div className="p-4 space-y-3">
        {/* Track thumbnail */}
        <div className="relative w-full h-20 bg-bg-primary rounded-sm overflow-hidden flex items-center justify-center">
          <Image
            src={`/track-maps/${replay.circuit_id}.png`}
            alt={replay.circuit_name}
            width={160}
            height={80}
            className="object-contain opacity-40"
          />
          <div className="absolute top-2 left-2 bg-bg-primary/80 backdrop-blur-sm px-2 py-0.5 rounded-sm">
            <span className="text-[10px] font-mono text-text-muted uppercase tracking-wider">
              R{replay.round}
            </span>
          </div>
        </div>

        {/* Race info */}
        <div>
          <h3 className="text-sm font-semibold text-text-primary truncate">
            {replay.event_name}
          </h3>
          <p className="text-xs text-text-muted mt-0.5">
            {replay.circuit_name} &middot; {replay.date}
          </p>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 text-[10px] font-mono text-text-muted uppercase tracking-wider">
          <span>{replay.total_laps} laps</span>
          <span>{replay.driver_count} drivers</span>
          <span>{formatDuration(replay.total_duration_seconds)}</span>
        </div>
      </div>
    </Card>
  );
}
