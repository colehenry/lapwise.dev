import { CHART_TYPOGRAPHY } from "@/components/chart-primitives";

export interface SeasonEntry {
  year: number | string;
  team_name?: string;
  team_color?: string;
  championship_position?: number;
  total_points: number;
  championship_points?: number | null;
  points_scored?: number;
  classification_status?: string;
  scoring_explanation?: string | null;
  race_count?: number;
  points_per_race?: number;
  prevPosition?: number;
  prevPoints?: number;
  prevPointsPerRace?: number;
}

export default function EntityHistorySeasonTooltip({
  data,
  showTeam,
}: {
  data: SeasonEntry;
  showTeam: boolean;
}) {
  const positionChange =
    data.prevPosition !== undefined && data.championship_position
      ? data.prevPosition - data.championship_position
      : null;
  const pointsChange =
    data.prevPoints !== undefined ? data.total_points - data.prevPoints : null;
  const rateChange =
    data.points_per_race !== undefined && data.prevPointsPerRace !== undefined
      ? data.points_per_race - data.prevPointsPerRace
      : null;

  const changeColor = (value: number) =>
    value > 0 ? "text-green-400" : value < 0 ? "text-red-400" : "text-blue-400";

  return (
    <div className="bg-bg-tertiary border border-border-primary rounded-sm p-3 shadow-xl">
      <p className={`${CHART_TYPOGRAPHY.tooltipTitleClassName} mb-2`}>
        {data.year}
      </p>
      <div className="space-y-1">
        {showTeam && (
          <p className={`${CHART_TYPOGRAPHY.tooltipValueClassName} text-sm`}>
            Team: {data.team_name}
          </p>
        )}
        <p className={`${CHART_TYPOGRAPHY.tooltipValueClassName} text-sm`}>
          Position:{" "}
          {data.championship_position
            ? `P${data.championship_position}`
            : "N/A"}
          {positionChange !== null && (
            <span
              className={`ml-2 font-semibold ${changeColor(positionChange)}`}
            >
              {positionChange > 0
                ? `+${positionChange}`
                : positionChange || "—"}
            </span>
          )}
        </p>
        <p className={`${CHART_TYPOGRAPHY.tooltipValueClassName} text-sm`}>
          Championship points: {Math.round(data.total_points)}
          {pointsChange !== null && (
            <span className={`ml-2 font-semibold ${changeColor(pointsChange)}`}>
              {pointsChange > 0
                ? `+${Math.round(pointsChange)}`
                : Math.round(pointsChange) || "—"}
            </span>
          )}
        </p>
        {data.points_scored !== undefined &&
          data.points_scored !== data.championship_points && (
            <p className={`${CHART_TYPOGRAPHY.tooltipValueClassName} text-sm`}>
              Scored on track: {Math.round(data.points_scored)}
            </p>
          )}
        {data.classification_status &&
          !["classified", "provisional"].includes(
            data.classification_status,
          ) && (
            <p className={`${CHART_TYPOGRAPHY.tooltipValueClassName} text-sm`}>
              Status: {data.classification_status.replace("_", " ")}
            </p>
          )}
        {data.points_per_race !== undefined && (
          <p className={`${CHART_TYPOGRAPHY.tooltipValueClassName} text-sm`}>
            Points/Race: {data.points_per_race.toFixed(2)}
            {rateChange !== null && (
              <span className={`ml-2 font-semibold ${changeColor(rateChange)}`}>
                {rateChange > 0
                  ? `+${rateChange.toFixed(2)}`
                  : rateChange.toFixed(2)}
              </span>
            )}
          </p>
        )}
        {data.race_count !== undefined && (
          <p className={`${CHART_TYPOGRAPHY.tooltipValueClassName} text-sm`}>
            Starts: {data.race_count}
          </p>
        )}
        {data.scoring_explanation && (
          <p className="mt-2 max-w-64 text-[10px] leading-relaxed text-text-muted">
            {data.scoring_explanation}
          </p>
        )}
      </div>
    </div>
  );
}
