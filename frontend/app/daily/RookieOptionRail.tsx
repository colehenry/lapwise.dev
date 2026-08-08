"use client";

import DriverHeadshot from "@/components/entities/DriverHeadshot";
import type { GridAttempt } from "@/hooks/useDailyGridProgress";
import { getDriverHeadshotUrl } from "@/lib/entityImageOverrides";
import { formatEvidence } from "@/lib/gridEvidence";
import type { GameDriver } from "@/lib/queries/dailyGrid";

type RookieOptionRailProps = {
  columnLabel: string;
  error: boolean;
  lastMiss: GridAttempt | null;
  loading: boolean;
  misses: GridAttempt[];
  onSelect: (driver: GameDriver) => void;
  options?: GameDriver[];
  placedDriverSlugs: Set<string>;
  rowLabel: string;
  submitting: boolean;
};

/** One header's verdict: what was asked, and what the driver actually did. */
function ProofRow({
  evidence,
  label,
}: {
  evidence: GridAttempt["rowEvidence"];
  label: string;
}) {
  const proof = formatEvidence(evidence);
  if (!proof) return null;
  const satisfied = evidence?.satisfied ?? false;

  return (
    <div className="mt-2 first:mt-0">
      <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-text-muted">
        {label}
      </p>
      <p
        className={`text-[11px] leading-snug ${
          satisfied ? "text-text-secondary" : "text-red-400"
        }`}
      >
        {proof}
      </p>
    </div>
  );
}

function MissProof({
  attempt,
  columnLabel,
  rowLabel,
}: {
  attempt: GridAttempt;
  columnLabel: string;
  rowLabel: string;
}) {
  return (
    <div className="border-l-2 border-border-secondary pl-2.5">
      <p className="text-xs font-semibold text-text-primary">
        {attempt.driver.full_name}
      </p>
      <div className="mt-1.5">
        <ProofRow evidence={attempt.rowEvidence} label={rowLabel} />
        <ProofRow evidence={attempt.columnEvidence} label={columnLabel} />
      </div>
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
      // Absolutely placed beside the grid from xl up, so opening it never
      // shifts the board off centre. Height tracks the grid rather than the
      // contents, so the panel does not resize as squares are answered.
      className="relative mt-3 min-h-[22rem] w-full rounded-sm border border-border-primary bg-bg-secondary xl:absolute xl:left-full xl:top-0 xl:ml-3 xl:mt-0 xl:h-full xl:min-h-0 xl:w-72"
    >
      <div className="absolute inset-0 flex flex-col overflow-hidden p-3">
        <header className="shrink-0 border-b border-border-primary pb-2">
          <p className="text-[10px] font-bold uppercase leading-snug tracking-[0.08em] text-text-primary">
            {rowLabel} <span className="text-text-muted">·</span> {columnLabel}
          </p>
        </header>

        {lastMiss && (
          <div className="shrink-0 py-2.5">
            <MissProof
              attempt={lastMiss}
              rowLabel={rowLabel}
              columnLabel={columnLabel}
            />
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto pt-2.5">
          {loading && (
            <p className="text-xs text-text-muted">Loading drivers…</p>
          )}
          {error && (
            <p className="text-xs text-red-400">
              Driver options are unavailable. Switch to Standard to search
              instead.
            </p>
          )}
          <div className="grid grid-cols-3 gap-1.5">
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
                  className="group flex flex-col items-center gap-1 rounded-sm border border-border-primary bg-bg-primary p-1 transition-colors hover:border-text-muted hover:bg-bg-tertiary focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-400 disabled:pointer-events-none disabled:opacity-35"
                >
                  <DriverHeadshot
                    responsive
                    code={driver.driver_code}
                    fullName={driver.full_name}
                    src={getDriverHeadshotUrl(driver)}
                    focalX={driver.media?.focal_x}
                    focalY={driver.media?.focal_y}
                    className="aspect-square w-[84%] rounded-sm"
                  />
                  <span
                    className={`line-clamp-2 text-center text-[9px] font-semibold leading-tight ${
                      used
                        ? "text-text-muted line-through"
                        : "text-text-secondary group-hover:text-text-primary"
                    }`}
                  >
                    {driver.full_name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
}
