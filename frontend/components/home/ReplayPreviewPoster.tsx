"use client";

import Link from "next/link";
import TrackMapImage from "@/components/track/TrackMapImage";

type ReplayPreviewPosterProps = {
  season: number | null;
  round: number | null;
  eventName: string | null;
  circuitId: number | null;
  circuitName: string | null;
  totalLaps: number | null;
  driverCount: number | null;
  isLoading: boolean;
  error: boolean;
  onLoadPreview: () => void;
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-text-muted">
        {label}
      </span>
      <span className="font-mono text-xs font-bold tabular-nums text-text-primary">
        {value}
      </span>
    </div>
  );
}

/**
 * Static stand-in for the replay player. Renders a bundled track map and the
 * session summary so home never downloads replay frames without user intent.
 */
export default function ReplayPreviewPoster({
  season,
  round,
  eventName,
  circuitId,
  circuitName,
  totalLaps,
  driverCount,
  isLoading,
  error,
  onLoadPreview,
}: ReplayPreviewPosterProps) {
  const replayHref =
    season !== null && round !== null
      ? `/replay?season=${season}&round=${round}`
      : "/replay";

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <div className="relative flex-1 min-w-0 overflow-hidden rounded-xl border border-white/[0.06] bg-black">
        <div
          className="relative flex items-center justify-center"
          style={{ height: 380 }}
        >
          <TrackMapImage
            circuitId={circuitId}
            circuitName={circuitName ?? "Track"}
            width={520}
            height={320}
            className="max-h-[320px] w-auto object-contain opacity-70"
            fallbackClassName="h-full w-full"
            unoptimized
          />
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 bg-gradient-to-t from-black/80 to-transparent p-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-text-primary">
                {eventName ?? "Latest race"}
              </p>
              <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted">
                {circuitName ?? "Replay available"}
              </p>
            </div>
            <button
              type="button"
              onClick={onLoadPreview}
              disabled={isLoading || season === null || round === null}
              className="shrink-0 rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-purple-300 transition-colors hover:border-purple-500/60 hover:bg-purple-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? "Loading…" : "Load preview"}
            </button>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 flex-col justify-between gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 lg:w-48">
        <div className="flex flex-col gap-3">
          <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-text-muted">
            Session
          </p>
          <Stat label="Season" value={season === null ? "—" : String(season)} />
          <Stat label="Laps" value={totalLaps ? String(totalLaps) : "—"} />
          <Stat
            label="Drivers"
            value={driverCount ? String(driverCount) : "—"}
          />
        </div>
        {error ? (
          <p className="text-[10px] text-text-muted">
            Preview unavailable. Open the full replay instead.
          </p>
        ) : (
          <p className="text-[10px] leading-relaxed text-text-muted">
            The animated preview downloads the full session, so it waits for
            you.
          </p>
        )}
        <Link
          href={replayHref}
          className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-center font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted transition-colors hover:border-purple-500/30 hover:text-purple-300"
        >
          Open replay
        </Link>
      </div>
    </div>
  );
}
