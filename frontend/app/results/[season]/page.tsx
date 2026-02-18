"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import JumpToRace from "@/components/JumpToRace";
import PointsByRoundGraph from "@/components/PointsByRoundGraph";
import {
  apiHeaders,
  apiUrl,
  fetchSeasons,
  isValidHeadshotUrl,
} from "@/lib/api";
import type { DriverStanding, RoundSummary } from "@/lib/types";

type StandingsData = {
  year: number;
  drivers: DriverStanding[];
  constructors: {
    position: number;
    team_name: string;
    team_color: string | null;
    total_points: number;
  }[];
};

type RoundsData = {
  year: number;
  rounds: RoundSummary[];
};

export default function ResultsPage() {
  const params = useParams();
  const router = useRouter();
  const season = params.season as string;

  const [expandedStandings, setExpandedStandings] = useState<boolean>(false);
  const [sessionType, setSessionType] = useState<"race" | "qualifying">("race");

  // Scroll to top when season changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: We intentionally want to scroll when season changes
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [season]);

  const { data: availableYears = [] } = useQuery<number[]>({
    queryKey: ["seasons"],
    queryFn: fetchSeasons,
    staleTime: 1000 * 60 * 60,
  });

  const { data: standings, isLoading: standingsLoading } =
    useQuery<StandingsData>({
      queryKey: ["standings", season],
      queryFn: () =>
        fetch(apiUrl(`/api/results/${season}/standings`), {
          headers: apiHeaders(),
        }).then((r) => r.json()),
      enabled: !!season,
    });

  const { data: rounds, isLoading: roundsLoading } = useQuery<RoundsData>({
    queryKey: ["rounds", season],
    queryFn: () =>
      fetch(apiUrl(`/api/results/${season}`), {
        headers: apiHeaders(),
      }).then((r) => r.json()),
    enabled: !!season,
  });

  const { data: qualifyingRounds } = useQuery<RoundsData>({
    queryKey: ["qualifying", season],
    queryFn: () =>
      fetch(apiUrl(`/api/results/${season}/qualifying`), {
        headers: apiHeaders(),
      }).then((r) => r.json()),
    enabled: !!season,
  });

  const isLoading = standingsLoading || roundsLoading;

  const handleYearChange = (newYear: string) => {
    router.push(`/results/${newYear}`);
  };

  const handleRoundClick = (round: number, roundSessionType: string) => {
    const modeParam = sessionType === "qualifying" ? "?mode=qualifying" : "";
    if (
      roundSessionType === "sprint_race" ||
      roundSessionType === "sprint_qualifying"
    ) {
      router.push(`/results/${season}/${round}/sprint${modeParam}`);
    } else {
      router.push(`/results/${season}/${round}${modeParam}`);
    }
  };

  const displayRounds =
    sessionType === "qualifying" ? qualifyingRounds : rounds;

  const getTeamDrivers = (teamName: string) => {
    if (!standings?.drivers) return [];
    return standings.drivers
      .filter((driver) => driver.team_name === teamName)
      .sort((a, b) => a.position - b.position);
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-bg-secondary p-8">
        <div className="max-w-7xl mx-auto">
          <p className="text-center text-gray-400">Loading results...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-bg-secondary p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header with year selector and title */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Year Dropdown */}
            <select
              value={season}
              onChange={(e) => handleYearChange(e.target.value)}
              className="px-3 py-1.5 border border-border-primary rounded bg-bg-tertiary text-2xl text-white font-bold focus:outline-none focus:border-purple-500 hover:border-purple-500/50 transition-all cursor-pointer"
            >
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>

            {/* Title */}
            <h1 className="text-2xl font-bold text-white">Season Results</h1>
          </div>

          {/* Jump to Race Button */}
          <JumpToRace
            currentSeason={season}
            availableSeasons={availableYears}
          />
        </div>
        {/* Final Standings Section */}
        <div className="mb-6">
          {/* Driver and Constructor Standings Side by Side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Driver Standings */}
            <div className="bg-bg-tertiary rounded-lg border border-border-primary shadow-lg p-4 flex flex-col">
              <h3 className="text-lg font-bold text-white mb-3">
                Driver's Championship
              </h3>
              <div
                className="space-y-2 overflow-y-auto"
                style={{
                  maxHeight: expandedStandings ? "660px" : "330px",
                  minHeight: expandedStandings ? "660px" : "330px",
                }}
              >
                {standings?.drivers.map((driver, idx) => (
                  <div
                    key={`${driver.driver_code}-${driver.team_name}-${idx}`}
                    className="flex items-center gap-2 py-2 border-b border-border-primary last:border-0 min-h-[60px]"
                  >
                    {/* Position */}
                    <div className="text-xl font-bold text-gray-500 w-6">
                      {driver.position}
                    </div>

                    {/* Driver Photo */}
                    {isValidHeadshotUrl(driver.headshot_url) && (
                      <Image
                        src={driver.headshot_url}
                        alt={driver.full_name}
                        width={40}
                        height={40}
                        className="rounded-full object-cover border border-gray-700"
                      />
                    )}

                    {/* Driver Info */}
                    <div className="flex-1 flex flex-col justify-center">
                      <Link
                        href={`/drivers/${driver.driver_code}`}
                        className="font-semibold text-white text-sm hover:text-red-500 transition-colors"
                      >
                        {driver.full_name}
                      </Link>
                      <div
                        className="text-xs font-medium"
                        style={{
                          color: driver.team_color
                            ? `#${driver.team_color}`
                            : "#999",
                        }}
                      >
                        {driver.team_name}
                      </div>
                    </div>

                    {/* Points */}
                    <div className="text-lg font-bold text-white">
                      {driver.total_points}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Constructor Standings */}
            <div className="bg-bg-tertiary rounded-lg border border-border-primary shadow-lg p-4 flex flex-col">
              <h3 className="text-lg font-bold text-white mb-3">
                Constructor's Championship
              </h3>
              <div
                className="space-y-2 overflow-y-auto"
                style={{
                  maxHeight: expandedStandings ? "660px" : "330px",
                  minHeight: expandedStandings ? "660px" : "330px",
                }}
              >
                {standings?.constructors.map((team, idx) => (
                  <div
                    key={`${team.team_name}-${idx}`}
                    className="py-2 border-b border-border-primary last:border-0 min-h-[60px]"
                  >
                    <div className="flex items-center gap-2">
                      {/* Position */}
                      <div className="text-xl font-bold text-gray-500 w-6">
                        {team.position}
                      </div>

                      {/* Team Info */}
                      <div className="flex-1 flex flex-col justify-center">
                        <div
                          className="font-bold text-sm"
                          style={{
                            color: team.team_color
                              ? `#${team.team_color}`
                              : "#fff",
                          }}
                        >
                          {team.team_name}
                        </div>
                        {/* Team Drivers */}
                        <div className="text-xs text-gray-400">
                          {getTeamDrivers(team.team_name).map(
                            (driver, driverIdx) => (
                              <span key={driver.driver_code}>
                                <Link
                                  href={`/drivers/${driver.driver_code}`}
                                  className="hover:text-white transition-colors"
                                >
                                  {driver.full_name}
                                </Link>{" "}
                                ({driver.total_points})
                                {driverIdx <
                                  getTeamDrivers(team.team_name).length - 1 &&
                                  ", "}
                              </span>
                            ),
                          )}
                        </div>
                      </div>

                      {/* Points */}
                      <div className="text-lg font-bold text-white">
                        {team.total_points}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Expand/Collapse Button */}
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={() => setExpandedStandings(!expandedStandings)}
              className="w-48 px-4 py-2 bg-bg-tertiary border-2 border-border-primary rounded-lg text-white text-sm font-semibold hover:border-purple-500 transition-all flex items-center justify-center gap-2"
            >
              {expandedStandings ? (
                <>
                  <span>Collapse</span>
                  <svg
                    className="w-4 h-4"
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
                    className="w-4 h-4"
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

        {/* Points Progression Graph */}
        <div className="mb-6">
          <PointsByRoundGraph season={season} />
        </div>

        {/* Races/Qualifying Section */}
        <div>
          {/* Header with toggle */}
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-bold text-white">
              {sessionType === "race" ? "Race Results" : "Qualifying Results"}
            </h2>
            {/* Race/Qualifying Toggle */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider ml-1">
                Session Type
              </span>
              <div className="flex items-center gap-2 bg-bg-tertiary rounded-lg p-1 border border-border-primary">
                <button
                  type="button"
                  onClick={() => setSessionType("race")}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    sessionType === "race"
                      ? "bg-purple-500 text-white"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  Race
                </button>
                <button
                  type="button"
                  onClick={() => setSessionType("qualifying")}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    sessionType === "qualifying"
                      ? "bg-purple-500 text-white"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  Qualifying
                </button>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {displayRounds?.rounds.map((round) => (
              <button
                type="button"
                key={`${round.round}-${round.session_type}`}
                onClick={() =>
                  handleRoundClick(round.round, round.session_type)
                }
                className="bg-bg-tertiary border border-border-primary rounded-lg shadow-lg p-4 hover:border-purple-500 transition-all cursor-pointer text-left h-[140px]"
              >
                <div className="flex items-center gap-4">
                  {/* Left side: Race info and podium */}
                  <div className="flex-1 min-w-0">
                    {/* Race/Qualifying Header - Horizontal */}
                    <div className="mb-3 pb-2 border-b border-border-primary">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-lg font-bold text-white truncate">
                          <span className="text-gray-400 font-normal">
                            Round {round.round}
                          </span>{" "}
                          • {round.event_name.replace("Grand Prix", "GP")}
                          {(round.session_type === "qualifying" ||
                            round.session_type === "sprint_qualifying") &&
                            " Qualifying"}
                        </h3>
                        {round.session_type === "sprint_race" && (
                          <span className="bg-purple-500 text-white px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap">
                            SPRINT
                          </span>
                        )}
                        {round.session_type === "sprint_qualifying" && (
                          <span className="bg-purple-500 text-white px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap">
                            SPRINT
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 truncate">
                        {round.circuit_name} •{" "}
                        {round.track_length_km
                          ? `${round.track_length_km.toFixed(3)} km • `
                          : ""}
                        {new Date(round.date).toLocaleDateString("en-US", {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    </div>

                    {/* Podium - Horizontal Layout with minimal spacing */}
                    <div className="flex items-center gap-3">
                      {round.podium.map((driver, idx) => {
                        const medals = ["🥇", "🥈", "🥉"];

                        return (
                          <div
                            key={driver.driver_code}
                            className="flex items-center gap-0.5"
                          >
                            {/* Medal */}
                            <span className="text-lg flex-shrink-0">
                              {medals[idx]}
                            </span>

                            {/* Driver Photo */}
                            {isValidHeadshotUrl(driver.headshot_url) && (
                              <Image
                                src={driver.headshot_url}
                                alt={driver.full_name}
                                width={40}
                                height={40}
                                className="rounded-full object-cover border border-gray-700 flex-shrink-0"
                              />
                            )}

                            {/* Driver Name - Team colored, centered vertically */}
                            <div className="flex items-center">
                              <div
                                className="font-bold text-sm truncate"
                                style={{
                                  color: driver.team_color
                                    ? `#${driver.team_color}`
                                    : "#fff",
                                }}
                              >
                                {driver.driver_code}
                                {driver.fastest_lap && (
                                  <span
                                    className="text-[10px] text-purple-300 ml-0.5"
                                    title="Fastest Lap"
                                  >
                                    ⚡
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Right side: Track map - centered vertically with consistent height */}
                  <div className="flex-shrink-0 flex items-center justify-center w-45 h-25">
                    <Image
                      src={`/track-maps/${round.circuit_id}.png`}
                      alt={`${round.circuit_name} track map`}
                      width={180}
                      height={100}
                      className="object-contain w-full h-full"
                    />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
