"use client";

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
    renderRaceTooltip: (data) => (
      <>
        <p className="font-bold text-white mb-2">{data.race_name || "Race"}</p>
        <div className="space-y-1">
          <p className="text-sm text-text-secondary">
            <span className="font-semibold">Season:</span> {data.year || "N/A"}{" "}
            R{data.round || "?"}
          </p>
          <p className="text-sm text-text-secondary">
            <span className="font-semibold">Best Position:</span>{" "}
            {data.best_position ? `P${data.best_position}` : "N/A"}
          </p>
          <p className="text-sm text-text-secondary">
            <span className="font-semibold">Total Points:</span>{" "}
            {data.total_points?.toFixed(1) || "0"}
          </p>
          {data.driver_1_name && (
            <p className="text-sm text-text-secondary">
              <span className="font-semibold">{data.driver_1_name}:</span>{" "}
              {data.driver_1_position ? `P${data.driver_1_position}` : "DNF"}
            </p>
          )}
          {data.driver_2_name && (
            <p className="text-sm text-text-secondary">
              <span className="font-semibold">{data.driver_2_name}:</span>{" "}
              {data.driver_2_position ? `P${data.driver_2_position}` : "DNF"}
            </p>
          )}
        </div>
      </>
    ),
  };

  return <EntityHistoryGraph config={config} />;
}
