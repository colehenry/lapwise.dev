"use client";

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
    renderRaceTooltip: (data) => (
      <>
        <p className="font-bold text-white mb-2">{data.race_name || "Race"}</p>
        <div className="space-y-1">
          <p className="text-sm text-text-secondary">
            <span className="font-semibold">Season:</span> {data.year || "N/A"}{" "}
            R{data.round || "?"}
          </p>
          <p className="text-sm text-text-secondary">
            <span className="font-semibold">Team:</span>{" "}
            {data.team_name || "Unknown"}
          </p>
          <p className="text-sm text-text-secondary">
            <span className="font-semibold">Position:</span>{" "}
            {data.position ? `P${data.position}` : data.status || "N/A"}
          </p>
          <p className="text-sm text-text-secondary">
            <span className="font-semibold">Points:</span>{" "}
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
