import { CHART_TYPOGRAPHY } from "@/components/chart-primitives";

export function PointsProgressionTitle({
  season,
  mode,
  isQualifying,
}: {
  season: number | string;
  mode: "drivers" | "constructors";
  isQualifying: boolean;
}) {
  return (
    <h3 className={`${CHART_TYPOGRAPHY.titleClassName} min-w-0`}>
      {season} {mode === "drivers" ? "Drivers'" : "Constructors'"}
      {isQualifying
        ? " Qualifying Positions by Round"
        : " Points Scored by Round"}
    </h3>
  );
}

export function PointsProgressionNote() {
  return (
    <p className="mt-2 text-center text-[10px] leading-relaxed text-text-muted">
      The lines show all on-track race and sprint points. Official final totals
      can differ where historical counting rules or classifications apply.
    </p>
  );
}

export function PointsProgressionAxisLabel({
  isQualifying,
}: {
  isQualifying: boolean;
}) {
  return (
    <div className="flex items-center justify-center w-4 shrink-0">
      <div className="-rotate-90 whitespace-nowrap">
        <span className={CHART_TYPOGRAPHY.axisLabelClassName}>
          {isQualifying ? "Position" : "Points scored"}
        </span>
      </div>
    </div>
  );
}

export function PointsProgressionRoundLabel() {
  return (
    <div className="mt-2 flex flex-row">
      <div className="w-4 shrink-0" />
      <div className="flex-grow text-center">
        <span className={CHART_TYPOGRAPHY.axisLabelClassName}>Round</span>
      </div>
    </div>
  );
}
