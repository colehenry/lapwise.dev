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

/* ── SVG Pattern Components ── */

function GridPattern({ id = "grid-pattern" }: { id?: string }) {
  return (
    <svg
      className="absolute inset-0 w-full h-full text-purple-500 opacity-10 pointer-events-none"
      aria-hidden="true"
    >
      <title>Grid pattern</title>
      <defs>
        <pattern id={id} width="10" height="10" patternUnits="userSpaceOnUse">
          <path
            d="M 10 0 L 0 0 0 10"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.4"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

function ConcentricPattern({ id = "concentric-pattern" }: { id?: string }) {
  return (
    <svg
      className="absolute inset-0 w-full h-full text-purple-500 opacity-10 pointer-events-none"
      viewBox="0 0 180 100"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <title>Concentric circles pattern</title>
      <defs>
        <pattern id={id} width="180" height="100" patternUnits="userSpaceOnUse">
          <circle
            cx="90"
            cy="50"
            r="15"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.4"
          />
          <circle
            cx="90"
            cy="50"
            r="30"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.4"
          />
          <circle
            cx="90"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.4"
          />
          <line
            x1="0"
            y1="50"
            x2="180"
            y2="50"
            stroke="currentColor"
            strokeWidth="0.3"
          />
          <line
            x1="90"
            y1="0"
            x2="90"
            y2="100"
            stroke="currentColor"
            strokeWidth="0.3"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

function TrianglePattern({ id = "triangle-pattern" }: { id?: string }) {
  return (
    <svg
      className="absolute inset-0 w-full h-full text-purple-500 opacity-8 pointer-events-none"
      aria-hidden="true"
    >
      <title>Triangle pattern</title>
      <defs>
        <pattern
          id={id}
          width="20"
          height="17.32"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M0 17.32 L10 0 L20 17.32 Z M10 17.32 L20 0 L30 17.32 Z M-10 17.32 L0 0 L10 17.32 Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.4"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

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
          <p className="text-center text-text-muted font-mono tracking-widest text-xs uppercase">
            Loading results...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-bg-secondary">
      {/* ── Sticky Header ── */}
      <div className="sticky top-0 z-40 bg-bg-secondary border-b border-border-primary h-16 flex items-center px-6">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Season Selector — terminal input style */}
            <select
              value={season}
              onChange={(e) => handleYearChange(e.target.value)}
              className="bg-bg-primary border border-border-primary text-text-primary font-mono text-xl font-bold px-3 py-1.5 rounded-sm focus:outline-none focus:border-purple-500 transition-colors duration-150 cursor-pointer"
            >
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
            <span className="text-text-muted text-[10px] tracking-widest uppercase font-bold hidden sm:inline">
              Season Results
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Session Type Toggle */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setSessionType("race")}
                className={`px-4 py-1.5 rounded-sm text-xs font-bold font-mono uppercase tracking-widest transition-colors duration-150 ${
                  sessionType === "race"
                    ? "bg-purple-500/20 border border-purple-500 text-purple-300"
                    : "border border-transparent text-text-muted hover:text-text-secondary"
                }`}
              >
                Race
              </button>
              <button
                type="button"
                onClick={() => setSessionType("qualifying")}
                className={`px-4 py-1.5 rounded-sm text-xs font-bold font-mono uppercase tracking-widest transition-colors duration-150 ${
                  sessionType === "qualifying"
                    ? "bg-purple-500/20 border border-purple-500 text-purple-300"
                    : "border border-transparent text-text-muted hover:text-text-secondary"
                }`}
              >
                Qualifying
              </button>
            </div>

            <JumpToRace
              currentSeason={season}
              availableSeasons={availableYears}
            />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {/* ── Championship Standings ── */}
        <div className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Driver Standings */}
            <div className="bg-bg-tertiary border border-border-primary rounded-sm shadow-sm flex flex-col">
              {/* Header band with Pattern A */}
              <div className="relative h-10 bg-bg-primary border-b border-border-primary px-4 flex items-center overflow-hidden">
                <GridPattern id="driver-grid" />
                <span className="relative z-10 text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono">
                  Driver Championship
                </span>
              </div>
              <div
                className="overflow-y-auto"
                style={{
                  maxHeight: expandedStandings ? "660px" : "330px",
                  minHeight: expandedStandings ? "660px" : "330px",
                }}
              >
                {standings?.drivers.map((driver, idx) => (
                  <div
                    key={`${driver.driver_code}-${driver.team_name}-${idx}`}
                    className="flex items-center gap-2 py-2 px-4 border-b border-border-primary last:border-0 min-h-[60px]"
                  >
                    {/* Position */}
                    <div className="text-lg font-bold text-text-muted w-8 font-mono">
                      {driver.position}
                    </div>

                    {/* Driver Photo */}
                    {isValidHeadshotUrl(driver.headshot_url) && (
                      <Image
                        src={driver.headshot_url}
                        alt={driver.full_name}
                        width={40}
                        height={40}
                        className="rounded-sm object-cover border border-border-secondary"
                      />
                    )}

                    {/* Driver Info */}
                    <div className="flex-1 flex flex-col justify-center">
                      <Link
                        href={`/drivers/${driver.driver_code}`}
                        className="font-semibold text-text-primary text-sm hover:text-purple-300 transition-colors duration-150"
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
                    <div className="flex items-baseline gap-1">
                      <span className="text-[9px] text-text-muted tracking-widest font-mono">
                        PTS
                      </span>
                      <span className="text-lg font-bold text-text-primary font-mono">
                        {driver.total_points}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Constructor Standings */}
            <div className="bg-bg-tertiary border border-border-primary rounded-sm shadow-sm flex flex-col">
              {/* Header band with Pattern A */}
              <div className="relative h-10 bg-bg-primary border-b border-border-primary px-4 flex items-center overflow-hidden">
                <GridPattern id="constructor-grid" />
                <span className="relative z-10 text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono">
                  Constructor Championship
                </span>
              </div>
              <div
                className="overflow-y-auto"
                style={{
                  maxHeight: expandedStandings ? "660px" : "330px",
                  minHeight: expandedStandings ? "660px" : "330px",
                }}
              >
                {standings?.constructors.map((team, idx) => (
                  <div
                    key={`${team.team_name}-${idx}`}
                    className="py-2 px-4 border-b border-border-primary last:border-0 min-h-[60px]"
                  >
                    <div className="flex items-center gap-2">
                      {/* Position */}
                      <div className="text-lg font-bold text-text-muted w-8 font-mono">
                        {team.position}
                      </div>

                      {/* Team Info */}
                      <div className="flex-1 flex flex-col justify-center">
                        <div
                          className="font-semibold text-sm"
                          style={{
                            color: team.team_color
                              ? `#${team.team_color}`
                              : "#fff",
                          }}
                        >
                          {team.team_name}
                        </div>
                        <div className="text-xs text-text-muted">
                          {getTeamDrivers(team.team_name).map(
                            (driver, driverIdx) => (
                              <span key={driver.driver_code}>
                                <Link
                                  href={`/drivers/${driver.driver_code}`}
                                  className="hover:text-purple-300 transition-colors duration-150"
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
                      <div className="flex items-baseline gap-1">
                        <span className="text-[9px] text-text-muted tracking-widest font-mono">
                          PTS
                        </span>
                        <span className="text-lg font-bold text-text-primary font-mono">
                          {team.total_points}
                        </span>
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

        {/* ── Points Progression Graph ── */}
        <div className="mb-6 bg-bg-tertiary border border-border-primary rounded-sm shadow-sm">
          <div className="relative h-10 bg-bg-primary border-b border-border-primary px-4 flex items-center overflow-hidden">
            <TrianglePattern id="points-triangles" />
            <span className="relative z-10 text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono">
              Points Progression
            </span>
          </div>
          <div className="p-4">
            <PointsByRoundGraph season={season} />
          </div>
        </div>

        {/* ── Race / Qualifying Results Grid ── */}
        <div>
          <div className="flex items-center mb-3">
            <h2 className="text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono">
              {sessionType === "race" ? "Race Results" : "Qualifying Results"}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {displayRounds?.rounds.map((round) => {
              const isSprint =
                round.session_type === "sprint_race" ||
                round.session_type === "sprint_qualifying";

              return (
                <button
                  type="button"
                  key={`${round.round}-${round.session_type}`}
                  onClick={() =>
                    handleRoundClick(round.round, round.session_type)
                  }
                  className={`bg-bg-tertiary border border-border-primary rounded-sm shadow-sm transition-all duration-150 cursor-pointer text-left h-[140px] relative overflow-hidden ${
                    isSprint
                      ? "hover:border-red-500 hover:shadow-red"
                      : "hover:border-purple-500 hover:shadow-purple"
                  }`}
                >
                  <div className="flex items-center gap-4 p-4 h-full">
                    {/* Left side: Race info and podium */}
                    <div className="flex-1 min-w-0 flex flex-col h-full">
                      {/* Round + Race name */}
                      <div className="mb-1">
                        <span className="text-[10px] text-text-muted tracking-widest uppercase font-mono font-bold">
                          RND {String(round.round).padStart(2, "0")}
                        </span>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-text-primary text-sm truncate">
                            {round.event_name.replace("Grand Prix", "GP")}
                            {(round.session_type === "qualifying" ||
                              round.session_type === "sprint_qualifying") &&
                              " Qualifying"}
                          </h3>
                          {(round.session_type === "sprint_race" ||
                            round.session_type === "sprint_qualifying") && (
                            <span className="bg-red-500/20 border border-red-500 text-red-400 text-[9px] tracking-widest uppercase font-bold font-mono px-2 py-0.5 rounded-sm whitespace-nowrap">
                              Sprint
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Circuit + date */}
                      <p className="text-text-muted text-[10px] tracking-wide truncate">
                        {round.circuit_name} •{" "}
                        {round.track_length_km
                          ? `${round.track_length_km.toFixed(3)} km • `
                          : ""}
                        {new Date(round.date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>

                      {/* Divider */}
                      <div className="border-b border-border-primary my-2" />

                      {/* Podium row */}
                      <div className="flex items-center gap-3 mt-auto">
                        {round.podium.map((driver, idx) => {
                          const medals = ["🥇", "🥈", "🥉"];
                          const labels = ["P1", "P2", "P3"];

                          return (
                            <div
                              key={driver.driver_code}
                              className="flex items-center gap-0.5"
                            >
                              <div className="flex flex-col items-center">
                                <span className="text-[9px] text-text-muted tracking-widest font-mono">
                                  {labels[idx]}
                                </span>
                                <span className="text-lg flex-shrink-0">
                                  {medals[idx]}
                                </span>
                              </div>

                              {isValidHeadshotUrl(driver.headshot_url) && (
                                <Image
                                  src={driver.headshot_url}
                                  alt={driver.full_name}
                                  width={32}
                                  height={32}
                                  className="rounded-sm object-cover border border-border-secondary flex-shrink-0"
                                />
                              )}

                              <div className="flex items-center">
                                <div
                                  className="font-bold text-xs font-mono truncate"
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

                    {/* Right side: Track map with concentric pattern */}
                    <div
                      className="flex-shrink-0 bg-bg-primary border border-border-secondary rounded-sm w-44 h-24 relative flex items-center justify-center overflow-hidden"
                      style={{
                        boxShadow: "inset 0 0 20px rgba(160, 32, 240, 0.1)",
                      }}
                    >
                      <ConcentricPattern
                        id={`track-${round.round}-${round.session_type}`}
                      />
                      <Image
                        src={`/track-maps/${round.circuit_id}.png`}
                        alt={`${round.circuit_name} track map`}
                        width={160}
                        height={88}
                        className="object-contain w-full h-full relative z-10 opacity-80 mix-blend-lighten"
                      />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}
