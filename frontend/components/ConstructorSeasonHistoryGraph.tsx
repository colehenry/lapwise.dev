"use client";

import { CHART_TYPOGRAPHY } from "@/components/chart-primitives";
import EntityHistoryGraph, {
  type EntityHistoryConfig,
} from "@/components/EntityHistoryGraph";

interface ConstructorSeasonHistoryGraphProps {
  teamName: string;
}

export default function ConstructorSeasonHistoryGraph({
  teamName,
}: ConstructorSeasonHistoryGraphProps) {
  const config: EntityHistoryConfig = {
    entityType: "constructor",
    entityId: teamName,
    apiBasePath: "/api/constructors",
    queryKeyPrefix: "constructor",
    positionLabel: "Championship Position",
    positionDomainMax: 10,
    racePositionKey: "best_position",
    racePointsKey: "total_points",
    showTeamInSeasonTooltip: false,
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
            Best Position:{" "}
            {data.best_position ? `P${data.best_position}` : "N/A"}
          </p>
          <p className={`${CHART_TYPOGRAPHY.tooltipValueClassName} text-sm`}>
            Total Points: {data.total_points?.toFixed(1) || "0"}
          </p>
          {data.driver_1_name && (
            <p className={`${CHART_TYPOGRAPHY.tooltipValueClassName} text-sm`}>
              {data.driver_1_name}:{" "}
              {data.driver_1_position ? `P${data.driver_1_position}` : "DNF"}
            </p>
          )}
          {data.driver_2_name && (
            <p className={`${CHART_TYPOGRAPHY.tooltipValueClassName} text-sm`}>
              {data.driver_2_name}:{" "}
              {data.driver_2_position ? `P${data.driver_2_position}` : "DNF"}
            </p>
          )}
        </div>
      </>
    ),
  };

  return <EntityHistoryGraph config={config} />;
}
