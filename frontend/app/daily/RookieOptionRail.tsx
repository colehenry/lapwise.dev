"use client";

import DriverHeadshot from "@/components/entities/DriverHeadshot";
import type { GridAttempt } from "@/hooks/useDailyGridProgress";
import { getDriverHeadshotUrl } from "@/lib/entityImageOverrides";
import { formatEvidence } from "@/lib/gridEvidence";
import type { GameDriver } from "@/lib/queries/dailyGrid";

type RookieOptionRailProps = {
  columnLabel?: string;
  error: boolean;
  lastMiss: GridAttempt | null;
  loading: boolean;
  misses: GridAttempt[];
  onSelect: (driver: GameDriver) => void;
  options?: GameDriver[];
  placedDriverSlugs: Set<string>;
  rowLabel?: string;
  submitting: boolean;
};

/** Proof for one header. Rendered only after a guess is committed. */
function ProofLine({ evidence }: { evidence: GridAttempt["rowEvidence"] }) {
  const proof = formatEvidence(evidence);
  if (!proof) return null;
  return (
    <p
      className={`mt-1 text-[11px] leading-snug ${
        evidence?.satisfied ? "text-success" : "text-red-400"
      }`}
    >
      <span aria-hidden="true">{evidence?.satisfied ? "✓" : "✗"}</span> {proof}
    </p>
  );
}

function MissProof({ attempt }: { attempt: GridAttempt }) {
  return (
    <div className="mt-3 rounded-md border border-red-500/40 bg-red-500/5 p-3">
      <p className="text-xs font-bold text-text-primary">
        {attempt.driver.full_name}
      </p>
      <ProofLine evidence={attempt.rowEvidence} />
      <ProofLine evidence={attempt.columnEvidence} />
    </div>
  );
}

export default function RookieOptionRail({
  columnLabel,
  error,
  lastMiss,
  loading,
  misses,
  onSelect,
  options,
  placedDriverSlugs,
  rowLabel,
  submitting,
}: RookieOptionRailProps) {
  const missedSlugs = new Set(misses.map((miss) => miss.driver.driver_slug));

  return (
    <aside
      aria-label="Driver options"
      className="mt-4 w-full rounded-lg border border-border-primary bg-bg-secondary p-3 lg:mt-0 lg:w-64 lg:shrink-0"
    >
      {rowLabel && columnLabel ? (
        <p className="text-xs font-bold text-text-primary">
          {rowLabel} <span className="text-text-muted">•</span> {columnLabel}
        </p>
      ) : (
        <p className="text-xs font-semibold text-text-secondary">
          Pick a square to see its drivers.
        </p>
      )}

      {lastMiss && <MissProof attempt={lastMiss} />}

      {rowLabel && (
        <div className="mt-3 max-h-[26rem] overflow-y-auto lg:max-h-[30rem]">
          {loading && (
            <p className="py-4 text-sm text-text-muted">Loading drivers…</p>
          )}
          {error && (
            <p className="py-4 text-sm text-red-400">
              Driver options are unavailable. Switch off Rookie Mode to search
              instead.
            </p>
          )}
          {options?.map((driver) => {
            const used =
              placedDriverSlugs.has(driver.driver_slug) ||
              missedSlugs.has(driver.driver_slug);
            return (
              <button
                key={driver.driver_slug}
                type="button"
                disabled={used || submitting}
                onClick={() => onSelect(driver)}
                className="flex w-full items-center gap-2 border-b border-border-primary px-1 py-2 text-left transition-colors last:border-b-0 hover:bg-bg-tertiary focus-visible:bg-bg-tertiary focus-visible:outline-none disabled:opacity-40"
              >
                <DriverHeadshot
                  code={driver.driver_code}
                  fullName={driver.full_name}
                  size={32}
                  src={getDriverHeadshotUrl(driver)}
                  focalX={driver.media?.focal_x}
                  focalY={driver.media?.focal_y}
                  className="rounded"
                />
                <span
                  className={`truncate text-xs font-semibold ${
                    used ? "text-text-muted line-through" : "text-text-primary"
                  }`}
                >
                  {driver.full_name}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </aside>
  );
}
