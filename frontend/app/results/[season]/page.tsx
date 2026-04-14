"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import JumpToRace from "@/components/JumpToRace";
import PageHeader from "@/components/PageHeader";
import { GridPattern, TrianglePattern } from "@/components/Patterns";
import PointsByRoundGraph from "@/components/PointsByRoundGraph";
import TeammateHeadToHead from "@/components/TeammateHeadToHead";
import { TrackMapCompact } from "@/components/TrackMapDisplay";
import TiltCard from "@/components/ui/TiltCard";
import {
  apiHeaders,
  apiUrl,
  fetchSeasons,
  isValidHeadshotUrl,
} from "@/lib/api";
import type {
  ConstructorQualifyingStanding,
  ConstructorStanding,
  DriverQualifyingStanding,
  DriverStanding,
  QualifyingStandingsResponse,
  RoundSummary,
  StandingsResponse,
} from "@/lib/types";

type RoundsData = {
  year: number;
  rounds: RoundSummary[];
};

function QualifyingPointsInfo({ formulaBase }: { formulaBase: number }) {
  const maxPoints = formulaBase - 1;
  return (
    <div className="absolute top-3 right-3 z-30 group">
      <button
        type="button"
        aria-label="How qualifying points are calculated"
        className="w-4 h-4 rounded-full border border-border-secondary bg-bg-primary text-text-muted hover:text-purple-300 hover:border-purple-500 flex items-center justify-center text-[9px] font-bold font-mono transition-colors duration-150"
      >
        ?
      </button>
      <div className="hidden group-hover:block group-focus-within:block absolute right-0 top-full mt-2 w-56 bg-bg-primary border border-border-secondary rounded-sm p-3 shadow-lg z-30">
        <p className="text-[10px] text-text-secondary leading-relaxed normal-case tracking-normal font-sans">
          Unofficial <span className="font-mono text-purple-300">Lapwise</span>{" "}
          metric for one-lap pace. Each qualifying awards{" "}
          <span className="font-mono text-purple-300">
            {formulaBase}−position
          </span>{" "}
          points (P1 = {maxPoints}, P{maxPoints} = 1). Scales to grid size so
          every driver scores. Does not affect the championship.
        </p>
      </div>
    </div>
  );
}

type MedalsProps = {
  p1: number;
  p2: number;
  p3: number;
  total: number;
  name: string;
  positionCounts: Record<string, number>;
  mode: "race" | "qualifying";
};

function MedalsWithBreakdown({
  p1,
  p2,
  p3,
  total,
  name,
  positionCounts,
  mode,
}: MedalsProps) {
  // For qualifying, hide medals a driver never earned. For race, always show
  // the 1/2/3 pane when non-zero (race P1-P3 are podium positions).
  const medals = [
    { count: p1, icon: "🥇", label: "P1s" },
    { count: p2, icon: "🥈", label: "P2s" },
    { count: p3, icon: "🥉", label: "P3s" },
  ].filter((m) => m.count > 0);

  const [tooltipPos, setTooltipPos] = useState<{
    top: number;
    right: number;
  } | null>(null);

  const sorted = Object.entries(positionCounts)
    .map(([pos, count]) => ({ pos: Number(pos), count }))
    .filter((e) => e.count > 0)
    .sort((a, b) => a.pos - b.pos);

  const showTooltip = (el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    setTooltipPos({
      top: rect.bottom + 8,
      right: window.innerWidth - rect.right,
    });
  };

  const tooltipLabel =
    mode === "race" ? "race finishes" : "qualifying positions";

  return (
    <div className="flex items-center gap-3">
      {medals.map((m) => (
        <div key={m.label} className="flex flex-col items-center">
          <span className="text-xs" title={m.label}>
            {m.icon}
          </span>
          <span className="text-xs font-bold text-text-primary">{m.count}</span>
        </div>
      ))}
      <div className="relative">
        <button
          type="button"
          aria-label={`${name} ${tooltipLabel} breakdown`}
          onMouseEnter={(e) => showTooltip(e.currentTarget)}
          onMouseLeave={() => setTooltipPos(null)}
          onFocus={(e) => showTooltip(e.currentTarget)}
          onBlur={() => setTooltipPos(null)}
          className="flex items-baseline gap-1 cursor-help"
        >
          <span className="text-[9px] text-text-muted tracking-widest font-mono">
            PTS
          </span>
          <span className="text-lg font-bold text-text-primary font-mono">
            {total}
          </span>
        </button>
        {tooltipPos && (
          <div
            className="fixed w-36 bg-bg-primary border border-border-secondary rounded-sm p-2 shadow-lg z-50 pointer-events-none"
            style={{ top: tooltipPos.top, right: tooltipPos.right }}
          >
            <p className="text-[10px] font-bold text-text-primary mb-1.5 truncate">
              {name}
            </p>
            {sorted.length === 0 ? (
              <p className="text-[10px] text-text-muted">No results</p>
            ) : (
              <div className="flex flex-col gap-0.5">
                {sorted.map(({ pos, count }) => {
                  const medal =
                    pos === 1 ? "🥇" : pos === 2 ? "🥈" : pos === 3 ? "🥉" : "";
                  return (
                    <div
                      key={pos}
                      className="flex items-center justify-between text-[10px] text-text-secondary font-mono"
                    >
                      <span className="flex items-center gap-1">
                        {medal && <span>{medal}</span>}
                        <span>P{pos}</span>
                      </span>
                      <span className="text-text-primary font-bold">
                        {count}x
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
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
    useQuery<StandingsResponse>({
      queryKey: ["standings", season],
      queryFn: () =>
        fetch(apiUrl(`/api/results/${season}/standings`), {
          headers: apiHeaders(),
        }).then((r) => {
          if (!r.ok) throw new Error(`API error: ${r.status}`);
          return r.json();
        }),
      enabled: !!season,
    });

  const { data: qualifyingStandings } = useQuery<QualifyingStandingsResponse>({
    queryKey: ["qualifying-standings", season],
    queryFn: () =>
      fetch(apiUrl(`/api/results/${season}/qualifying-standings`), {
        headers: apiHeaders(),
      }).then((r) => {
        if (!r.ok) throw new Error(`API error: ${r.status}`);
        return r.json();
      }),
    enabled: !!season && sessionType === "qualifying",
  });

  const { data: rounds, isLoading: roundsLoading } = useQuery<RoundsData>({
    queryKey: ["rounds", season],
    queryFn: () =>
      fetch(apiUrl(`/api/results/${season}`), {
        headers: apiHeaders(),
      }).then((r) => {
        if (!r.ok) throw new Error(`API error: ${r.status}`);
        return r.json();
      }),
    enabled: !!season,
  });

  const { data: qualifyingRounds } = useQuery<RoundsData>({
    queryKey: ["qualifying", season],
    queryFn: () =>
      fetch(apiUrl(`/api/results/${season}/qualifying`), {
        headers: apiHeaders(),
      }).then((r) => {
        if (!r.ok) throw new Error(`API error: ${r.status}`);
        return r.json();
      }),
    enabled: !!season,
  });

  const isLoading = standingsLoading || roundsLoading;

  const handleYearChange = (newYear: string) => {
    router.push(`/results/${newYear}`);
  };

  const handleRoundClick = (round: number, roundSessionType: string) => {
    const modeParam = sessionType === "qualifying" ? "?tab=qualifying" : "";
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

  const getTeamQualifyingDrivers = (teamName: string) => {
    if (!qualifyingStandings?.drivers) return [];
    return qualifyingStandings.drivers
      .filter((driver) => driver.team_name === teamName)
      .sort((a, b) => a.position - b.position);
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-bg-secondary p-8">
        <div className="max-w-6xl mx-auto">
          <p className="text-center text-text-muted font-mono tracking-widest text-xs uppercase">
            Loading results...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-bg-secondary">
      <PageHeader
        title={season}
        subtitle="Season Results"
        compactMobile
        leftContent={
          <select
            value={season}
            onChange={(e) => handleYearChange(e.target.value)}
            className="h-10 w-24 sm:w-auto bg-bg-primary border border-border-primary text-text-primary font-mono text-xs font-bold px-3 sm:px-4 py-2 rounded-sm focus:outline-none focus:border-purple-500 transition-colors duration-150 cursor-pointer uppercase tracking-widest"
          >
            {availableYears.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        }
      >
        <div className="flex min-w-0 w-full items-center gap-2 sm:w-auto sm:gap-4">
          <div className="grid min-w-0 flex-1 grid-cols-2 gap-1 sm:flex sm:items-center">
            <button
              type="button"
              onClick={() => setSessionType("race")}
              className={`px-4 py-2 sm:py-1.5 rounded-sm text-xs font-bold font-mono uppercase tracking-widest transition-colors duration-150 ${
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
              className={`px-4 py-2 sm:py-1.5 rounded-sm text-xs font-bold font-mono uppercase tracking-widest transition-colors duration-150 ${
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
            label="Jump"
          />
        </div>
      </PageHeader>

      <div className="max-w-6xl mx-auto p-3 md:p-6">
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
              {/* Header band with Pattern A */}
              <div className="relative h-10 bg-bg-primary border-b border-border-primary px-4 flex items-center gap-2 overflow-hidden">
                <GridPattern id="driver-grid" />
                <span className="relative z-10 text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono text-nowrap">
                  {sessionType === "race"
                    ? "Driver Championship"
                    : "Best Qualifiers (Driver)"}
                </span>
              </div>
              <div
                className="overflow-y-auto"
                style={{
                  maxHeight: expandedStandings ? "660px" : "330px",
                  minHeight: expandedStandings ? "660px" : "330px",
                }}
              >
                {(sessionType === "race"
                  ? standings?.drivers
                  : qualifyingStandings?.drivers
                )?.map((driver, idx) => (
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
                        href={`/drivers/${driver.driver_slug || driver.driver_code}`}
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
                        <Link
                          href={`/constructors/${driver.team_name.replace(/\s+/g, "-")}`}
                          className="hover:text-purple-300 transition-colors duration-150"
                        >
                          {driver.team_name}
                        </Link>
                      </div>
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
                        total={(driver as DriverStanding).total_points}
                        name={driver.full_name}
                        positionCounts={
                          (driver as DriverStanding).position_counts
                        }
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Constructor Standings */}
            <div className="relative bg-bg-tertiary border border-border-primary rounded-sm shadow-sm flex flex-col">
              {sessionType === "qualifying" && (
                <QualifyingPointsInfo
                  formulaBase={qualifyingStandings?.formula_base ?? 21}
                />
              )}
              {/* Header band with Pattern A */}
              <div className="relative h-10 bg-bg-primary border-b border-border-primary px-4 flex items-center gap-2 overflow-hidden">
                <GridPattern id="constructor-grid" />
                <span className="relative z-10 text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono text-nowrap">
                  {sessionType === "race"
                    ? "Constructor Championship"
                    : "Best Qualifiers (Constructor)"}
                </span>
              </div>
              <div
                className="overflow-y-auto"
                style={{
                  maxHeight: expandedStandings ? "660px" : "330px",
                  minHeight: expandedStandings ? "660px" : "330px",
                }}
              >
                {(sessionType === "race"
                  ? standings?.constructors
                  : qualifyingStandings?.constructors
                )?.map((team, idx) => (
                  <div
                    key={`${team.team_name}-${idx}`}
                    className="py-2 px-4 border-b border-border-primary last:border-0 min-h-[60px]"
                  >
                    <div className="flex items-center gap-2">
                      {/* Position */}
                      <div className="text-lg font-bold text-text-muted w-8 font-mono">
                        {team.position}
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
                            color: team.team_color
                              ? `#${team.team_color}`
                              : "#fff",
                          }}
                        >
                          <Link
                            href={`/constructors/${team.team_name.replace(/\s+/g, "-")}`}
                            className="hover:text-purple-300 transition-colors duration-150"
                          >
                            {team.team_name}
                          </Link>
                        </div>
                        <div className="text-xs text-text-muted">
                          {(sessionType === "race"
                            ? getTeamDrivers(team.team_name)
                            : getTeamQualifyingDrivers(team.team_name)
                          ).map((driver, driverIdx, arr) => (
                            <span key={driver.driver_code}>
                              <Link
                                href={`/drivers/${driver.driver_slug || driver.driver_code}`}
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
                          total={(team as ConstructorStanding).total_points}
                          name={team.team_name}
                          positionCounts={
                            (team as ConstructorStanding).position_counts
                          }
                        />
                      )}
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

        {/* ── Championship Battle Graph ── */}
        <div className="mb-6 bg-bg-tertiary border border-border-primary rounded-sm shadow-sm">
          <div className="relative h-10 bg-bg-primary border-b border-border-primary px-4 flex items-center overflow-hidden">
            <TrianglePattern id="points-triangles" />
            <span className="relative z-10 text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono">
              Championship Battle
            </span>
          </div>
          <div className="p-4">
            <PointsByRoundGraph season={season} pointsType={sessionType} />
          </div>
        </div>

        {/* ── Teammate H2H ── */}
        <div className="mb-6 bg-bg-tertiary border border-border-primary rounded-sm shadow-sm overflow-hidden">
          <div className="relative h-10 bg-bg-primary border-b border-border-primary px-4 flex items-center overflow-hidden">
            <TrianglePattern id="teammate-h2h-triangles" />
            <span className="relative z-10 text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono">
              Teammate Head-to-Head
            </span>
          </div>
          <div className="p-4">
            <TeammateHeadToHead season={season} mode={sessionType} />
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
                <TiltCard key={`${round.round}-${round.session_type}`}>
                  <button
                    type="button"
                    onClick={() =>
                      handleRoundClick(round.round, round.session_type)
                    }
                    className={`w-full bg-bg-tertiary border border-border-primary rounded-sm shadow-sm transition-all duration-150 cursor-pointer text-left min-h-[156px] md:h-[140px] relative overflow-hidden ${
                      isSprint
                        ? "hover:border-red-500 hover:shadow-red"
                        : "hover:border-purple-500 hover:shadow-purple"
                    }`}
                  >
                    <div className="flex h-full flex-col gap-2 p-3 md:flex-row md:items-center md:gap-4 md:p-4">
                      {/* Left side: Race info and podium */}
                      <div className="relative z-10 flex-1 min-w-0 flex flex-col pr-28 md:pr-0">
                        {/* Round + Race name */}
                        <div className="mb-1">
                          <span className="text-[10px] text-text-muted tracking-widest uppercase font-mono font-bold">
                            RND {String(round.round).padStart(2, "0")}
                          </span>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-text-primary text-sm md:text-sm truncate">
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
                        <div className="border-b border-border-primary my-1.5 md:my-2" />

                        {/* Podium row */}
                        <div className="grid grid-cols-3 gap-1.5 md:flex md:items-center md:gap-3 md:mt-auto">
                          {round.podium.map((driver, idx) => {
                            const medals = ["🥇", "🥈", "🥉"];
                            const labels = ["P1", "P2", "P3"];

                            return (
                              <div
                                key={driver.driver_code}
                                className="flex min-w-0 items-center gap-1 rounded-sm bg-bg-primary/50 px-1.5 py-1 md:bg-transparent md:p-0"
                              >
                                <div className="flex flex-col items-center">
                                  <span className="text-[8px] md:text-[9px] text-text-muted tracking-widest font-mono leading-none">
                                    {labels[idx]}
                                  </span>
                                  <span className="text-sm md:text-lg flex-shrink-0 leading-none">
                                    {medals[idx]}
                                  </span>
                                </div>

                                {isValidHeadshotUrl(driver.headshot_url) && (
                                  <Image
                                    src={driver.headshot_url}
                                    alt={driver.full_name}
                                    width={26}
                                    height={26}
                                    className="rounded-sm object-cover border border-border-secondary flex-shrink-0 md:w-8 md:h-8"
                                  />
                                )}

                                <div className="flex items-center">
                                  <div
                                    className="font-bold text-[11px] md:text-xs font-mono truncate"
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

                      {/* Right side: Track map */}
                      <TrackMapCompact
                        circuitId={round.circuit_id}
                        circuitName={round.circuit_name}
                        patternId={`track-dots-${round.round}-${round.session_type}`}
                      />
                    </div>
                  </button>
                </TiltCard>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}
