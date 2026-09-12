"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import DriverHeadshot from "@/components/entities/DriverHeadshot";
import JumpToRace from "@/components/layout/JumpToRace";
import PageHeader from "@/components/layout/PageHeader";
import { usePageSurface } from "@/components/providers/ClutchDockProvider";
import { TrackMapCompact } from "@/components/track/TrackMapDisplay";
import TiltCard from "@/components/ui/TiltCard";
import { useChampionshipDisplay } from "@/hooks/useChampionshipDisplay";
import type { AnalysisPageContext } from "@/lib/ai/analysis-contracts";
import { STANDINGS_SURFACE } from "@/lib/clutch/scripts/standings";
import {
  qualifyingRoundsQuery,
  seasonRoundsQuery,
  seasonsQuery,
  selectUniqueRounds,
} from "@/lib/queries/seasons";
import {
  qualifyingStandingsQuery,
  seasonStandingsQuery,
} from "@/lib/queries/standings";
import SeasonAnalysisPanels from "./SeasonAnalysisPanels";
import SeasonStandingsPanels from "./SeasonStandingsPanels";

export default function SeasonPageClient() {
  const params = useParams();
  const router = useRouter();
  const season = params.season as string;
  // Canonical query keys are numeric so cached standings and rounds are shared
  // with routes that never see the URL string.
  const seasonYear = Number(season);

  const [expandedStandings, setExpandedStandings] = useState<boolean>(false);
  const [sessionType, setSessionType] = useState<"race" | "qualifying">("race");

  // Scroll to top when season changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: We intentionally want to scroll when season changes
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [season]);

  const { data: availableYears = [] } = useQuery(seasonsQuery());

  const { data: standings, isLoading: standingsLoading } = useQuery({
    ...seasonStandingsQuery(seasonYear),
    enabled: Number.isFinite(seasonYear),
  });

  const { data: qualifyingStandings } = useQuery({
    ...qualifyingStandingsQuery(seasonYear),
    enabled: Number.isFinite(seasonYear) && sessionType === "qualifying",
  });

  const { data: rounds, isLoading: roundsLoading } = useQuery(
    seasonRoundsQuery(Number.isFinite(seasonYear) ? seasonYear : null),
  );

  const { data: qualifyingRounds } = useQuery({
    ...qualifyingRoundsQuery(Number.isFinite(seasonYear) ? seasonYear : null),
    enabled: Number.isFinite(seasonYear) && sessionType === "qualifying",
  });

  const isLoading = standingsLoading || roundsLoading;

  const championshipDisplay = useChampionshipDisplay(standings);

  const standingsContext = useMemo(
    () =>
      standings
        ? {
            standings,
            roundsRun: rounds ? selectUniqueRounds(rounds).length : null,
          }
        : null,
    [standings, rounds],
  );
  const clutchPageContext = useMemo<AnalysisPageContext>(
    () => ({ route: `/results/${season}`, season: seasonYear }),
    [season, seasonYear],
  );
  usePageSurface(
    STANDINGS_SURFACE,
    standingsContext,
    `${season} · Standings`,
    clutchPageContext,
  );

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
      .sort((a, b) => (a.position ?? 10_000) - (b.position ?? 10_000));
  };

  const getTeamQualifyingDrivers = (teamName: string) => {
    if (!qualifyingStandings?.drivers) return [];
    return qualifyingStandings.drivers
      .filter((driver) => driver.team_name === teamName)
      .sort((a, b) => a.position - b.position);
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-surface-band p-8">
        <div className="max-w-6xl mx-auto">
          <p className="text-center text-ink-faint font-mono tracking-widest text-xs uppercase">
            Loading results...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-surface-band">
      <PageHeader
        title={season}
        subtitle="Season Results"
        compactMobile
        leftContent={
          <select
            value={season}
            onChange={(e) => handleYearChange(e.target.value)}
            className="h-10 w-24 sm:w-auto bg-surface-page border border-line-soft text-ink-strong font-mono text-xs font-bold px-3 sm:px-4 py-2 rounded-sm focus:outline-none focus:border-accent transition-colors duration-150 cursor-pointer uppercase tracking-widest"
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
                  ? "bg-accent/20 border border-accent text-accent-light"
                  : "border border-transparent text-ink-faint hover:text-ink-base"
              }`}
            >
              Race
            </button>
            <button
              type="button"
              onClick={() => setSessionType("qualifying")}
              className={`px-4 py-2 sm:py-1.5 rounded-sm text-xs font-bold font-mono uppercase tracking-widest transition-colors duration-150 ${
                sessionType === "qualifying"
                  ? "bg-accent/20 border border-accent text-accent-light"
                  : "border border-transparent text-ink-faint hover:text-ink-base"
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
        <SeasonStandingsPanels
          sessionType={sessionType}
          standings={standings}
          qualifyingStandings={qualifyingStandings}
          championshipDisplay={championshipDisplay}
          expandedStandings={expandedStandings}
          setExpandedStandings={setExpandedStandings}
          getTeamDrivers={getTeamDrivers}
          getTeamQualifyingDrivers={getTeamQualifyingDrivers}
        />

        <SeasonAnalysisPanels season={season} sessionType={sessionType} />

        {/* ── Race / Qualifying Results Grid ── */}
        <div>
          <div className="flex items-center mb-3">
            <h2 className="text-[10px] tracking-widest text-ink-faint font-bold uppercase font-mono">
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
                    className={`w-full bg-surface-panel border border-line-soft rounded-sm shadow-sm transition-all duration-150 cursor-pointer text-left min-h-[158px] md:h-[140px] relative overflow-hidden ${
                      isSprint
                        ? "hover:border-danger hover:shadow-red"
                        : "hover:border-accent hover:shadow-purple"
                    }`}
                  >
                    <div className="relative z-10 flex h-full flex-col gap-2 p-3 md:flex-row md:items-center md:gap-4 md:p-4">
                      {/* Race info and podium */}
                      <div className="flex min-w-0 flex-1 flex-col pr-0">
                        {/* Round + Race name */}
                        <div className="mb-1 pr-32 md:pr-0">
                          <span className="text-[10px] text-ink-faint tracking-widest uppercase font-mono font-bold">
                            RND {String(round.round).padStart(2, "0")}
                          </span>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-ink-strong text-sm md:text-sm truncate">
                              {round.event_name.replace("Grand Prix", "GP")}
                              {(round.session_type === "qualifying" ||
                                round.session_type === "sprint_qualifying") &&
                                " Qualifying"}
                            </h3>
                            {(round.session_type === "sprint_race" ||
                              round.session_type === "sprint_qualifying") && (
                              <span className="bg-danger/20 border border-danger text-danger-bright text-[9px] tracking-widest uppercase font-bold font-mono px-2 py-0.5 rounded-sm whitespace-nowrap">
                                Sprint
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Circuit + date */}
                        <p className="text-ink-faint text-[10px] tracking-wide truncate pr-28 md:pr-0">
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
                        <div className="border-b border-line-soft my-2" />

                        {/* Podium row */}
                        <div className="mt-auto grid w-full grid-cols-3 items-end gap-2 md:flex md:items-center md:gap-3">
                          {round.podium.map((driver, idx) => {
                            const medals = ["🥇", "🥈", "🥉"];
                            const labels = ["P1", "P2", "P3"];

                            return (
                              <div
                                key={
                                  driver.driver_slug ??
                                  `${driver.full_name}-${idx}`
                                }
                                className="flex min-w-0 flex-col items-center justify-center gap-1.5 text-center md:flex-row md:gap-1 md:text-left"
                              >
                                <div className="relative flex w-full items-center justify-center md:w-auto md:gap-1">
                                  <div className="absolute right-1/2 mr-7 flex min-w-6 flex-col items-end gap-0.5 md:static md:mr-0 md:min-w-0 md:items-center">
                                    <span className="text-[8px] md:text-[9px] text-ink-faint tracking-widest font-mono leading-none">
                                      {labels[idx]}
                                    </span>
                                    <span className="text-sm md:text-base flex-shrink-0 leading-none">
                                      {medals[idx]}
                                    </span>
                                  </div>

                                  <DriverHeadshot
                                    src={driver.headshot_url}
                                    fullName={driver.full_name}
                                    code={driver.driver_code}
                                  />
                                </div>

                                <div className="flex min-w-0 items-center justify-center">
                                  <div
                                    className="font-bold text-[12px] md:text-xs font-mono truncate"
                                    style={{
                                      color: driver.team_color
                                        ? `#${driver.team_color}`
                                        : "var(--ink-strong)",
                                    }}
                                  >
                                    {driver.driver_code}
                                    {driver.fastest_lap && (
                                      <span
                                        className="text-[10px] text-accent-light ml-0.5"
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
