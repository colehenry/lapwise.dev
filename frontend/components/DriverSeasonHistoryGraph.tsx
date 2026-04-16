"use client";

import { CHART_TYPOGRAPHY } from "@/components/chart-primitives";
import EntityHistoryGraph, {
  type EntityHistoryConfig,
} from "@/components/EntityHistoryGraph";

interface DriverSeasonHistoryGraphProps {
  driverCode: string;
}

export default function DriverSeasonHistoryGraph({
  driverCode,
}: DriverSeasonHistoryGraphProps) {
  const config: EntityHistoryConfig = {
    entityType: "driver",
    entityId: driverCode,
    apiBasePath: "/api/drivers",
    queryKeyPrefix: "driver",
    positionLabel: "Finishing Position",
    positionDomainMax: 20,
    racePositionKey: "position",
    racePointsKey: "points",
    showTeamInSeasonTooltip: true,
    defaultDataMode: "points_per_race",
    showPointsPerRaceToggle: true,
    renderRaceTooltip: (data) => (
      <>
        <p className={`${CHART_TYPOGRAPHY.tooltipTitleClassName} mb-2`}>
          {data.race_name || "Race"}
        </p>
        <div className="space-y-1">
          <p className={`${CHART_TYPOGRAPHY.tooltipValueClassName} text-sm`}>
            Season: {data.year || "N/A"} R{data.round || "?"}
          </p>
          <p className={`${CHART_TYPOGRAPHY.tooltipValueClassName} text-sm`}>
            Team: {data.team_name || "Unknown"}
          </p>
          <p className={`${CHART_TYPOGRAPHY.tooltipValueClassName} text-sm`}>
            Position:{" "}
            {data.position ? `P${data.position}` : data.status || "N/A"}
          </p>
          <p className={`${CHART_TYPOGRAPHY.tooltipValueClassName} text-sm`}>
            Points:{" "}
            {data.points !== null && data.points !== undefined
              ? data.points
              : data.position && data.position <= 10
                ? "(missing data)"
                : "0"}
          </p>
        </div>
      </>
    ),
  };

  return <EntityHistoryGraph config={config} />;
}
