"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import JumpToRace from "@/components/JumpToRace";
import LapTimeByLapGraph from "@/components/LapTimeByLapGraph";
import LapTimeDistributionChart from "@/components/LapTimeDistributionChart";
import { TrianglePattern } from "@/components/Patterns";
import QualifyingSectorComparison from "@/components/QualifyingSectorComparison";
import SessionDetail from "@/components/SessionDetail";
import type { SessionSummary } from "@/components/SessionSummaryCard";
import SessionSummaryCard from "@/components/SessionSummaryCard";
import SpeedTrapChart from "@/components/SpeedTrapChart";
import TyreDegradationChart from "@/components/TyreDegradationChart";
import WeatherChart from "@/components/WeatherChart";
import { apiHeaders, apiUrl, fetchSeasons } from "@/lib/api";
import type { SessionResultsResponse } from "@/lib/types";

type TabType =
  | "race"
  | "qualifying"
  | "sprint"
  | "sprint-qualifying"
  | "practice"
  | "strategy"
  | "analysis";

const TAB_LABELS: Record<TabType, string> = {
  race: "Race",
  qualifying: "Qualifying",
  sprint: "Sprint",
  "sprint-qualifying": "Sprint Quali",
  practice: "Practice",
  strategy: "Strategy",
  analysis: "Analysis",
};

async function fetchSession(
  season: string,
  round: string,
  suffix?: string,
): Promise<SessionResultsResponse | null> {
  const path = suffix
    ? `/api/results/${season}/${round}/${suffix}`
    : `/api/results/${season}/${round}`;
  const res = await fetch(apiUrl(path), {
    cache: "no-store",
    headers: apiHeaders(),
  });
  if (!res.ok) return null;
  return res.json();
}

export default function RoundContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const season = params.season as string;
  const round = params.round as string;
  const seasonNum = Number.parseInt(season, 10);
  const roundNum = Number.parseInt(round, 10);

  // Parse initial tab from URL
  const urlTab = searchParams.get("tab") as TabType | null;
  const [activeTab, setActiveTab] = useState<TabType>(urlTab || "race");

  // Scroll to top on page load
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Sync tab from URL changes (back/forward nav)
  useEffect(() => {
    if (urlTab) {
      setActiveTab(urlTab);
    }
  }, [urlTab]);

  const enabled = !!season && !!round;

  const { data: raceData, isLoading: raceLoading } = useQuery({
    queryKey: ["round-race", season, round],
    queryFn: () => fetchSession(season, round),
    enabled,
  });

  const { data: qualifyingData } = useQuery({
    queryKey: ["round-qualifying", season, round],
    queryFn: () => fetchSession(season, round, "qualifying"),
    enabled,
  });

  const { data: sprintData } = useQuery({
    queryKey: ["round-sprint", season, round],
    queryFn: () => fetchSession(season, round, "sprint"),
    enabled,
  });

  const { data: sprintQualData } = useQuery({
    queryKey: ["round-sprint-qualifying", season, round],
    queryFn: () => fetchSession(season, round, "sprint-qualifying"),
    enabled,
  });

  const { data: fp1Data } = useQuery({
    queryKey: ["round-fp1", season, round],
    queryFn: () => fetchSession(season, round, "practice/1"),
    enabled,
  });

  const { data: fp2Data } = useQuery({
    queryKey: ["round-fp2", season, round],
    queryFn: () => fetchSession(season, round, "practice/2"),
    enabled,
  });

  const { data: fp3Data } = useQuery({
    queryKey: ["round-fp3", season, round],
    queryFn: () => fetchSession(season, round, "practice/3"),
    enabled,
  });

  const { data: summariesData } = useQuery<{
    summaries: SessionSummary[];
  } | null>({
    queryKey: ["round-summaries", season, round],
    queryFn: async () => {
      const res = await fetch(
        apiUrl(`/api/results/${season}/${round}/summaries`),
        { cache: "no-store", headers: apiHeaders() },
      );
      if (!res.ok) return null;
      return res.json();
    },
    enabled,
  });

  const { data: availableYears = [] } = useQuery<number[]>({
    queryKey: ["seasons"],
    queryFn: fetchSeasons,
    staleTime: 1000 * 60 * 60,
  });

  const loading = raceLoading;
  const hasSprint = !!sprintData;
  const hasPractice = !!fp1Data || !!fp2Data || !!fp3Data;

  // Practice sub-tab: default to latest available (FP3 > FP2 > FP1)
  const [practiceSub, setPracticeSub] = useState<1 | 2 | 3>(
    fp3Data ? 3 : fp2Data ? 2 : 1,
  );

  // Update practice sub default when data loads
  useEffect(() => {
    if (fp3Data) setPracticeSub(3);
    else if (fp2Data) setPracticeSub(2);
    else if (fp1Data) setPracticeSub(1);
  }, [fp1Data, fp2Data, fp3Data]);

  // Update URL when tab changes
  const switchTab = (tab: TabType) => {
    setActiveTab(tab);
    const url =
      tab === "race"
        ? `/results/${season}/${round}`
        : `/results/${season}/${round}?tab=${tab}`;
    router.replace(url, { scroll: false });
  };

  // Available tabs (conditional on data)
  const availableTabs: TabType[] = ["race", "qualifying"];
  if (hasSprint) {
    availableTabs.push("sprint");
    if (sprintQualData) availableTabs.push("sprint-qualifying");
  }
  if (hasPractice) availableTabs.push("practice");
  availableTabs.push("strategy", "analysis");

  if (loading) {
    return (
      <main className="min-h-screen bg-bg-secondary p-8">
        <div className="max-w-6xl mx-auto">
          <p className="text-center text-text-muted font-mono tracking-widest text-xs uppercase">
            Loading race weekend...
          </p>
        </div>
      </main>
    );
  }

  if (!raceData) {
    return (
      <main className="min-h-screen bg-bg-secondary p-8">
        <div className="max-w-6xl mx-auto">
          <p className="text-center text-red-400 font-mono tracking-widest text-xs uppercase">
            Failed to load race details.
          </p>
        </div>
      </main>
    );
  }

  // Determine which data to pass to SessionDetail based on active tab
  const getSessionDetailData = (): SessionResultsResponse | null => {
    switch (activeTab) {
      case "qualifying":
        return qualifyingData ?? null;
      case "sprint":
        return sprintData ?? null;
      case "sprint-qualifying":
        return sprintQualData ?? null;
      case "practice":
        if (practiceSub === 1) return fp1Data ?? null;
        if (practiceSub === 2) return fp2Data ?? null;
        return fp3Data ?? null;
      default:
        return raceData ?? null;
    }
  };

  const getQualifyingDataForTab = (): SessionResultsResponse | null => {
    if (activeTab === "sprint") return sprintQualData ?? null;
    return qualifyingData ?? null;
  };

  // Check if the active tab is a results tab (shows SessionDetail)
  const isResultsTab = [
    "race",
    "qualifying",
    "sprint",
    "sprint-qualifying",
    "practice",
  ].includes(activeTab);
  const isSprint = activeTab === "sprint" || activeTab === "sprint-qualifying";
  const sessionTypeForDetail =
    activeTab === "qualifying" || activeTab === "sprint-qualifying"
      ? "qualifying"
      : "race";

  // Find summary for the active tab
  const getActiveSummary = (): SessionSummary | undefined => {
    if (!summariesData?.summaries) return undefined;
    const tabToSessionType: Record<string, string> = {
      race: "race",
      qualifying: "qualifying",
      sprint: "sprint_race",
      "sprint-qualifying": "sprint_qualifying",
      practice: `fp${practiceSub}`,
    };
    const sessionType = tabToSessionType[activeTab];
    if (!sessionType) return undefined;
    return summariesData.summaries.find((s) => s.session_type === sessionType);
  };
  const activeSummary = getActiveSummary();

  return (
    <main className="min-h-screen bg-bg-secondary">
      {/* Sticky Header with Tabs */}
      <div className="sticky top-0 z-40">
        <div className="px-4">
          <div className="mx-auto w-full max-w-full md:max-w-[calc(72rem+40px)]">
            <div className="bg-bg-secondary/95 backdrop-blur-xl border-x border-b border-border-primary rounded-b-3xl rounded-t-none shadow-[0_10px_36px_rgba(0,0,0,0.35)]">
              <div className="h-16 px-6 flex items-center justify-between border-b border-border-primary/60">
                <div className="flex-1 flex items-center">
                  <button
                    type="button"
                    onClick={() => router.push(`/results/${season}`)}
                    className="bg-bg-primary border border-border-primary text-text-primary font-mono text-xs font-bold px-4 py-2 rounded-sm hover:border-purple-500 hover:text-purple-300 transition-colors duration-150 cursor-pointer flex items-center gap-2"
                  >
                    <span>←</span>
                    <span className="hidden sm:inline">BACK TO {season}</span>
                  </button>
                </div>

                <div className="flex flex-col items-center">
                  <span className="text-text-primary font-mono text-sm font-bold leading-none">
                    ROUND {String(raceData.session.round).padStart(2, "0")}
                  </span>
                  <span className="text-text-muted text-[10px] tracking-widest uppercase font-bold hidden sm:inline">
                    {raceData.session.event_name.replace("Grand Prix", "GP")}
                  </span>
                </div>

                <div className="flex-1 flex justify-end">
                  <JumpToRace
                    currentSeason={season}
                    availableSeasons={availableYears}
                    label="Jump to Different Wknd"
                    excludeRound={roundNum}
                  />
                </div>
              </div>

              {/* Tab Bar */}
              <div className="px-4">
                <div className="flex items-center justify-center gap-1 overflow-x-auto pb-2">
                  {availableTabs.map((tab) => {
                    const isActive = activeTab === tab;
                    const isDisabled =
                      (tab === "qualifying" && !qualifyingData) ||
                      (tab === "sprint" && !sprintData) ||
                      (tab === "sprint-qualifying" && !sprintQualData) ||
                      (tab === "practice" && !hasPractice);

                    return (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => !isDisabled && switchTab(tab)}
                        disabled={isDisabled}
                        className={`px-4 py-2.5 text-xs font-bold font-mono uppercase tracking-widest transition-colors duration-150 border-b-2 whitespace-nowrap ${
                          isActive
                            ? "border-purple-500 text-purple-300"
                            : isDisabled
                              ? "border-transparent text-text-muted/40 cursor-not-allowed"
                              : "border-transparent text-text-muted hover:text-text-secondary hover:border-border-primary"
                        }`}
                      >
                        {TAB_LABELS[tab]}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-6xl mx-auto">
        {/* Race / Qualifying / Sprint tabs — show SessionDetail */}
        {isResultsTab && (
          <>
            {/* AI Summary Card */}
            {activeSummary && (
              <div className="px-6 pt-6">
                <SessionSummaryCard summary={activeSummary} />
              </div>
            )}
            {/* Practice sub-toggle (FP1/FP2/FP3) */}
            {activeTab === "practice" && (
              <div className="px-6 pt-6 flex justify-center">
                <div className="inline-flex bg-bg-primary border border-border-primary rounded-sm overflow-hidden">
                  {([1, 2, 3] as const).map((num) => {
                    const hasData =
                      num === 1 ? !!fp1Data : num === 2 ? !!fp2Data : !!fp3Data;
                    const isActive = practiceSub === num;
                    return (
                      <button
                        key={num}
                        type="button"
                        onClick={() => hasData && setPracticeSub(num)}
                        disabled={!hasData}
                        className={`px-5 py-2 text-xs font-bold font-mono uppercase tracking-widest transition-colors duration-150 ${
                          isActive
                            ? "bg-purple-500/20 text-purple-300 border-b-2 border-purple-500"
                            : !hasData
                              ? "text-text-muted/30 cursor-not-allowed"
                              : "text-text-muted hover:text-text-secondary hover:bg-bg-secondary"
                        }`}
                      >
                        FP{num}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <SessionDetail
              data={getSessionDetailData()}
              qualifyingData={
                activeTab === "practice" ? null : getQualifyingDataForTab()
              }
              season={season}
              isSprint={isSprint}
              sessionType={
                activeTab === "practice" ? "practice" : sessionTypeForDetail
              }
              onSessionTypeChange={undefined}
              onBack={() => router.push(`/results/${season}`)}
              hideHeader={true}
            />
            {(activeTab === "qualifying" ||
              activeTab === "sprint-qualifying") && (
              <div className="p-6">
                <div className="bg-bg-tertiary border border-border-primary rounded-sm shadow-sm overflow-hidden">
                  <div className="relative h-10 bg-bg-primary border-b border-border-primary px-4 flex items-center overflow-hidden">
                    <TrianglePattern id="qualifying-tab-sector-triangles" />
                    <span className="relative z-10 text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono">
                      Sector Comparison
                    </span>
                  </div>
                  <div className="p-6">
                    <QualifyingSectorComparison
                      season={seasonNum}
                      round={roundNum}
                    />
                  </div>
                </div>
              </div>
            )}
            {activeTab === "race" && (
              <div className="p-6">
                <div className="bg-bg-tertiary border border-border-primary rounded-sm shadow-sm overflow-hidden">
                  <div className="relative h-10 bg-bg-primary border-b border-border-primary px-4 flex items-center overflow-hidden">
                    <TrianglePattern id="lap-dist-triangles" />
                    <span className="relative z-10 text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono">
                      Lap Time Distribution
                    </span>
                  </div>
                  <div className="p-6">
                    <LapTimeDistributionChart
                      season={seasonNum}
                      round={roundNum}
                    />
                  </div>
                </div>
              </div>
            )}
            {activeTab === "practice" && (
              <div className="p-6">
                <div className="bg-bg-tertiary border border-border-primary rounded-sm shadow-sm overflow-hidden">
                  <div className="relative h-10 bg-bg-primary border-b border-border-primary px-4 flex items-center overflow-hidden">
                    <TrianglePattern id="practice-lap-triangles" />
                    <span className="relative z-10 text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono">
                      FP{practiceSub} Lap Analysis
                    </span>
                  </div>
                  <div className="p-6">
                    <LapTimeByLapGraph
                      season={seasonNum}
                      round={roundNum}
                      practiceSession={practiceSub}
                    />
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Strategy Tab */}
        {activeTab === "strategy" && (
          <div className="p-6 space-y-6">
            {/* Tyre Degradation */}
            <div className="bg-bg-tertiary border border-border-primary rounded-sm shadow-sm overflow-hidden">
              <div className="relative h-10 bg-bg-primary border-b border-border-primary px-4 flex items-center overflow-hidden">
                <TrianglePattern id="tyre-deg-triangles" />
                <span className="relative z-10 text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono">
                  Tyre Degradation
                </span>
              </div>
              <div className="p-6">
                <TyreDegradationChart season={seasonNum} round={roundNum} />
              </div>
            </div>
          </div>
        )}

        {/* Analysis Tab */}
        {activeTab === "analysis" && (
          <div className="p-6 space-y-6">
            {/* Position Battle */}
            <div className="bg-bg-tertiary border border-border-primary rounded-sm shadow-sm overflow-hidden">
              <div className="relative h-10 bg-bg-primary border-b border-border-primary px-4 flex items-center overflow-hidden">
                <TrianglePattern id="analysis-lap-triangles" />
                <span className="relative z-10 text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono">
                  Lap Analysis
                </span>
              </div>
              <div className="p-6">
                <LapTimeByLapGraph season={seasonNum} round={roundNum} />
              </div>
            </div>

            {/* Qualifying Sector Comparison */}
            <div className="bg-bg-tertiary border border-border-primary rounded-sm shadow-sm overflow-hidden">
              <div className="relative h-10 bg-bg-primary border-b border-border-primary px-4 flex items-center overflow-hidden">
                <TrianglePattern id="qualifying-sector-triangles" />
                <span className="relative z-10 text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono">
                  Qualifying Sectors
                </span>
              </div>
              <div className="p-6">
                <QualifyingSectorComparison
                  season={seasonNum}
                  round={roundNum}
                />
              </div>
            </div>

            {/* Speed Traps */}
            <div className="bg-bg-tertiary border border-border-primary rounded-sm shadow-sm overflow-hidden">
              <div className="relative h-10 bg-bg-primary border-b border-border-primary px-4 flex items-center overflow-hidden">
                <TrianglePattern id="speed-trap-triangles" />
                <span className="relative z-10 text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono">
                  Speed Traps
                </span>
              </div>
              <div className="p-6">
                <SpeedTrapChart season={seasonNum} round={roundNum} />
              </div>
            </div>

            {/* Weather */}
            <div className="bg-bg-tertiary border border-border-primary rounded-sm shadow-sm overflow-hidden">
              <div className="relative h-10 bg-bg-primary border-b border-border-primary px-4 flex items-center overflow-hidden">
                <TrianglePattern id="weather-triangles" />
                <span className="relative z-10 text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono">
                  Weather Conditions
                </span>
              </div>
              <div className="p-6">
                <WeatherChart season={seasonNum} round={roundNum} />
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
