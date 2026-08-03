"use client";

import Image from "next/image";
import Link from "next/link";
import ChampionshipPanelHeader from "@/components/ChampionshipPanelHeader";
import ClassificationBadge from "@/components/ClassificationBadge";
import DriverHeadshot from "@/components/DriverHeadshot";
import {
  MedalsWithBreakdown,
  QualifyingPointsInfo,
} from "@/components/StandingsPointsDisplay";
import { useTheme } from "@/components/ThemeProvider";
import {
  type ChampionshipDisplay,
  displayedPoints,
  displayedPosition,
} from "@/hooks/useChampionshipDisplay";
import { isValidHeadshotUrl } from "@/lib/api";
import { resolveReadableAccentColor } from "@/lib/color-utils";
import { constructorHref, driverHref } from "@/lib/entityLinks";
import type {
  ConstructorQualifyingStanding,
  ConstructorStanding,
  DriverQualifyingStanding,
  DriverStanding,
  QualifyingStandingsResponse,
  StandingsResponse,
} from "@/lib/types";

type SeasonStandingsPanelsProps = {
  sessionType: "race" | "qualifying";
  standings: StandingsResponse | undefined;
  qualifyingStandings: QualifyingStandingsResponse | undefined;
  championshipDisplay: ChampionshipDisplay;
  expandedStandings: boolean;
  setExpandedStandings: (expanded: boolean) => void;
  getTeamDrivers: (teamName: string) => DriverStanding[];
  getTeamQualifyingDrivers: (teamName: string) => DriverQualifyingStanding[];
};

/** Driver and constructor championship tables for the selected mode. */
export default function SeasonStandingsPanels({
  sessionType,
  standings,
  qualifyingStandings,
  championshipDisplay,
  expandedStandings,
  setExpandedStandings,
  getTeamDrivers,
  getTeamQualifyingDrivers,
}: SeasonStandingsPanelsProps) {
  const { theme } = useTheme();

  return (
    <>
      {/* ── Championship Standings ── */}
      <div className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Driver Standings */}
          <div className="relative bg-bg-tertiary border border-border-primary rounded-sm shadow-sm flex flex-col">
            {sessionType === "qualifying" && (
              <QualifyingPointsInfo
                formulaBase={qualifyingStandings?.formula_base ?? 21}
              />
            )}
            <ChampionshipPanelHeader
              patternId="driver-grid"
              raceTitle="Driver Championship"
              qualifyingTitle="Best Qualifiers (Driver)"
              sessionType={sessionType}
              scoring={standings?.driver_scoring}
              mode={championshipDisplay.drivers.mode}
              onModeChange={championshipDisplay.drivers.setMode}
            />
            <div
              className="overflow-y-auto"
              style={{
                maxHeight: expandedStandings ? "660px" : "330px",
                minHeight: expandedStandings ? "660px" : "330px",
              }}
            >
              {(sessionType === "race"
                ? championshipDisplay.drivers.rows
                : qualifyingStandings?.drivers
              )?.map(
                (
                  driver: DriverStanding | DriverQualifyingStanding,
                  idx: number,
                ) => (
                  <div
                    key={`${driver.driver_code}-${driver.team_name}-${idx}`}
                    className="flex items-center gap-2 py-2 px-4 border-b border-border-primary last:border-0 min-h-[60px]"
                  >
                    {/* Position */}
                    <div className="text-lg font-bold text-text-muted w-8 font-mono">
                      {sessionType === "race"
                        ? displayedPosition(
                            driver as DriverStanding,
                            idx,
                            championshipDisplay.drivers.mode,
                          )
                        : driver.position}
                    </div>

                    {/* Driver Photo */}
                    <DriverHeadshot
                      src={driver.headshot_url}
                      fullName={driver.full_name}
                      code={driver.driver_code}
                    />

                    {/* Driver Info */}
                    <div className="flex-1 flex flex-col justify-center">
                      <Link
                        href={driverHref(driver) ?? "/drivers"}
                        className="font-semibold text-text-primary text-sm hover:text-purple-300 transition-colors duration-150"
                      >
                        {driver.full_name}
                      </Link>
                      <div
                        className="text-xs font-medium"
                        style={{
                          color: driver.team_color
                            ? `#${driver.team_color}`
                            : "var(--delta-neutral)",
                        }}
                      >
                        <Link
                          href={
                            constructorHref(driver.team_name) ?? "/constructors"
                          }
                          className="hover:text-purple-300 transition-colors duration-150"
                        >
                          {driver.team_name}
                        </Link>
                      </div>
                      {sessionType === "race" && (
                        <ClassificationBadge
                          status={
                            (driver as DriverStanding).classification_status
                          }
                        />
                      )}
                    </div>

                    {/* Results / Points */}
                    {sessionType === "qualifying" ? (
                      <MedalsWithBreakdown
                        mode="qualifying"
                        p1={(driver as DriverQualifyingStanding).poles}
                        p2={(driver as DriverQualifyingStanding).p2s}
                        p3={(driver as DriverQualifyingStanding).p3s}
                        total={
                          (driver as DriverQualifyingStanding)
                            .total_qualifying_points
                        }
                        name={driver.full_name}
                        positionCounts={
                          (driver as DriverQualifyingStanding).position_counts
                        }
                      />
                    ) : (
                      <MedalsWithBreakdown
                        mode="race"
                        p1={(driver as DriverStanding).wins}
                        p2={(driver as DriverStanding).p2s}
                        p3={(driver as DriverStanding).p3s}
                        total={displayedPoints(
                          driver as DriverStanding,
                          championshipDisplay.drivers.mode,
                        )}
                        name={driver.full_name}
                        positionCounts={
                          (driver as DriverStanding).position_counts
                        }
                      />
                    )}
                  </div>
                ),
              )}
            </div>
          </div>

          {/* Constructor Standings */}
          <div className="relative bg-bg-tertiary border border-border-primary rounded-sm shadow-sm flex flex-col">
            {sessionType === "qualifying" && (
              <QualifyingPointsInfo
                formulaBase={qualifyingStandings?.formula_base ?? 21}
              />
            )}
            <ChampionshipPanelHeader
              patternId="constructor-grid"
              raceTitle="Constructor Championship"
              qualifyingTitle="Best Qualifiers (Constructor)"
              sessionType={sessionType}
              scoring={standings?.constructor_scoring}
              mode={championshipDisplay.constructors.mode}
              onModeChange={championshipDisplay.constructors.setMode}
            />
            <div
              className="overflow-y-auto"
              style={{
                maxHeight: expandedStandings ? "660px" : "330px",
                minHeight: expandedStandings ? "660px" : "330px",
              }}
            >
              {(sessionType === "race"
                ? championshipDisplay.constructors.rows
                : qualifyingStandings?.constructors
              )?.map(
                (
                  team: ConstructorStanding | ConstructorQualifyingStanding,
                  idx: number,
                ) => (
                  <div
                    key={`${team.team_name}-${idx}`}
                    className="py-2 px-4 border-b border-border-primary last:border-0 min-h-[60px]"
                  >
                    <div className="flex items-center gap-2">
                      {/* Position */}
                      <div className="text-lg font-bold text-text-muted w-8 font-mono">
                        {sessionType === "race"
                          ? displayedPosition(
                              team as ConstructorStanding,
                              idx,
                              championshipDisplay.constructors.mode,
                            )
                          : team.position}
                      </div>

                      {/* Team Logo */}
                      {isValidHeadshotUrl(team.logo_url) && (
                        <div className="w-10 h-10 rounded-sm overflow-hidden border border-border-secondary bg-bg-secondary">
                          <Image
                            src={team.logo_url}
                            alt={team.team_name}
                            width={40}
                            height={40}
                            className="w-full h-full object-contain p-1"
                            style={
                              theme === "light" &&
                              !team.team_name.toLowerCase().includes("ferrari")
                                ? { filter: "invert(1)" }
                                : undefined
                            }
                            unoptimized={team.logo_url.includes(
                              "wikimedia.org",
                            )}
                          />
                        </div>
                      )}

                      {/* Team Info */}
                      <div className="flex-1 flex flex-col justify-center">
                        <div
                          className="font-semibold text-sm"
                          style={{
                            color:
                              resolveReadableAccentColor(
                                team.team_color,
                                theme,
                                "var(--text-primary)",
                              ) ?? "var(--text-primary)",
                          }}
                        >
                          <Link
                            href={constructorHref(team) ?? "/constructors"}
                            className="hover:text-purple-300 transition-colors duration-150"
                          >
                            {team.team_name}
                          </Link>
                        </div>
                        {sessionType === "race" && (
                          <ClassificationBadge
                            status={
                              (team as ConstructorStanding)
                                .classification_status
                            }
                          />
                        )}
                        <div className="text-xs text-text-muted">
                          {(sessionType === "race"
                            ? getTeamDrivers(team.team_name)
                            : getTeamQualifyingDrivers(team.team_name)
                          ).map((driver, driverIdx, arr) => (
                            <span
                              key={
                                driver.driver_slug ??
                                `${driver.full_name}-${driver.team_name}`
                              }
                            >
                              <Link
                                href={driverHref(driver) ?? "/drivers"}
                                className="hover:text-purple-300 transition-colors duration-150"
                              >
                                {driver.full_name}
                              </Link>{" "}
                              (
                              {sessionType === "race"
                                ? (driver as DriverStanding).total_points
                                : (driver as DriverQualifyingStanding).poles}
                              ){driverIdx < arr.length - 1 && ", "}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Results / Points */}
                      {sessionType === "qualifying" ? (
                        <MedalsWithBreakdown
                          mode="qualifying"
                          p1={(team as ConstructorQualifyingStanding).poles}
                          p2={(team as ConstructorQualifyingStanding).p2s}
                          p3={(team as ConstructorQualifyingStanding).p3s}
                          total={
                            (team as ConstructorQualifyingStanding)
                              .total_qualifying_points
                          }
                          name={team.team_name}
                          positionCounts={
                            (team as ConstructorQualifyingStanding)
                              .position_counts
                          }
                        />
                      ) : (
                        <MedalsWithBreakdown
                          mode="race"
                          p1={(team as ConstructorStanding).wins}
                          p2={(team as ConstructorStanding).p2s}
                          p3={(team as ConstructorStanding).p3s}
                          total={displayedPoints(
                            team as ConstructorStanding,
                            championshipDisplay.constructors.mode,
                          )}
                          name={team.team_name}
                          positionCounts={
                            (team as ConstructorStanding).position_counts
                          }
                        />
                      )}
                    </div>
                  </div>
                ),
              )}
            </div>
          </div>
        </div>

        {/* Expand/Collapse Button */}
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => setExpandedStandings(!expandedStandings)}
            className="border border-border-secondary rounded-sm text-text-secondary hover:border-purple-500 hover:text-purple-300 font-mono text-xs uppercase tracking-widest px-6 py-2 transition-colors duration-150 flex items-center gap-2"
          >
            {expandedStandings ? (
              <>
                <span>Collapse</span>
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <title>Collapse icon</title>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 15l7-7 7 7"
                  />
                </svg>
              </>
            ) : (
              <>
                <span>Expand</span>
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <title>Expand icon</title>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
