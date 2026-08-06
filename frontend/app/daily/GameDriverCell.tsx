import Link from "next/link";
import DriverHeadshot from "@/components/entities/DriverHeadshot";
import DriverSilhouette from "@/components/entities/DriverSilhouette";
import { getDriverHeadshotUrl } from "@/lib/entityImageOverrides";
import type { GameDriver } from "@/lib/queries/dailyGrid";

type GameDriverCellProps = {
  columnLabel: string;
  disabled: boolean;
  driver?: GameDriver;
  finished: boolean;
  misses: GameDriver[];
  onAnimationEnd: () => void;
  onSelect: () => void;
  rowLabel: string;
  shaking: boolean;
};

export default function GameDriverCell({
  columnLabel,
  disabled,
  driver,
  finished,
  misses,
  onAnimationEnd,
  onSelect,
  rowLabel,
  shaking,
}: GameDriverCellProps) {
  const label = driver
    ? `${driver.full_name} matches ${rowLabel} and ${columnLabel}`
    : `Choose a driver for ${rowLabel} and ${columnLabel}`;

  return (
    <div
      className={`group relative aspect-square min-h-0 ${
        shaking ? "game-cell-shake z-20" : ""
      }`}
      onAnimationEnd={onAnimationEnd}
    >
      <div
        className={`game-card-perspective h-full w-full ${
          driver ? "game-card-solved" : ""
        }`}
      >
        <div className="game-card-inner">
          <div className="game-card-face flex items-center justify-center border border-dashed border-border-secondary bg-bg-primary/60 transition-colors group-hover:border-text-muted group-hover:bg-bg-tertiary">
            <DriverSilhouette className="w-[46%] max-w-16 transition-colors group-hover:text-text-secondary/55" />
          </div>
          <div className="game-card-face game-card-back flex flex-col items-center justify-center border border-success/50 bg-success/10 p-1.5 sm:p-2">
            {driver && (
              <>
                <DriverHeadshot
                  responsive
                  code={driver.driver_code}
                  fullName={driver.full_name}
                  src={getDriverHeadshotUrl(driver)}
                  focalX={driver.media?.focal_x}
                  focalY={driver.media?.focal_y}
                  className="aspect-square w-[68%] rounded-md"
                />
                <span className="mt-1.5 line-clamp-2 text-center text-[9px] font-semibold leading-tight text-text-primary sm:text-xs">
                  {driver.full_name}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {!driver && (!finished || misses.length > 0) && (
        <button
          type="button"
          aria-label={label}
          disabled={disabled}
          onClick={onSelect}
          className="absolute inset-0 z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-purple-400 disabled:cursor-default"
        />
      )}

      {driver && finished && (
        <Link
          href={`/drivers/${driver.driver_slug}`}
          aria-label={`View ${driver.full_name}'s profile`}
          className="absolute inset-0 z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-purple-400"
        />
      )}

      {!driver && !finished && (
        <>
          {misses.length > 0 && (
            <span className="pointer-events-none absolute right-1.5 top-1.5 z-10 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[8px] font-bold text-text-primary">
              {misses.length}
            </span>
          )}
          <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-max max-w-48 -translate-x-1/2 translate-y-1 rounded-md border border-border-primary bg-bg-elevated px-3 py-2 opacity-0 shadow-xl transition-all group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
            <p className="text-[10px] font-semibold text-text-primary">
              {rowLabel} <span className="text-text-muted">•</span>{" "}
              {columnLabel}
            </p>
            {misses
              .slice()
              .reverse()
              .map((miss) => (
                <p
                  key={`${miss.driver_slug}-${misses.indexOf(miss)}`}
                  className="text-[10px] text-text-secondary"
                >
                  Not {miss.full_name}
                </p>
              ))}
            {misses.length === 0 && !finished && (
              <p className="mt-1 text-[10px] text-text-muted">
                Click to search
              </p>
            )}
          </div>
        </>
      )}
      {driver && !finished && <span className="sr-only">{label}</span>}
    </div>
  );
}
