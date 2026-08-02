"use client";

import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import JumpToRace from "@/components/JumpToRace";
import { TrianglePattern } from "@/components/Patterns";
import SessionDetail from "@/components/SessionDetail";
import type { SessionSummary } from "@/components/SessionSummaryCard";
import { apiHeaders, apiUrl, fetchSeasons } from "@/lib/api";
import { DATA_FROM } from "@/lib/data-coverage";
import type { SessionResultsResponse } from "@/lib/types";

const ChartLoading = () => (
  <div className="h-64 animate-pulse rounded-sm bg-bg-elevated" />
);

const CrossSessionComparison = dynamic(
  () => import("@/components/CrossSessionComparison"),
  { loading: ChartLoading, ssr: false },
);
const FastestLapTimeline = dynamic(
  () => import("@/components/FastestLapTimeline"),
  { loading: ChartLoading, ssr: false },
);
const LapTimeDistributionChart = dynamic(
  () => import("@/components/LapTimeDistributionChart"),
  { loading: ChartLoading, ssr: false },
);
const LongRunPaceChart = dynamic(
  () => import("@/components/LongRunPaceChart"),
  {
    loading: ChartLoading,
    ssr: false,
  },
);
const PitStopDeltaChart = dynamic(
  () => import("@/components/PitStopDeltaChart"),
  { loading: ChartLoading, ssr: false },
);
const PracticeSectorHeatmap = dynamic(
  () => import("@/components/PracticeSectorHeatmap"),
  { loading: ChartLoading, ssr: false },
);
const QualifyingProgressionChart = dynamic(
  () => import("@/components/QualifyingProgressionChart"),
  { loading: ChartLoading, ssr: false },
);
const QualifyingSectorComparison = dynamic(
  () => import("@/components/QualifyingSectorComparison"),
  { loading: ChartLoading, ssr: false },
);
const QualifyingSectorHeatmap = dynamic(
  () => import("@/components/QualifyingSectorHeatmap"),
  { loading: ChartLoading, ssr: false },
);
const RaceTrackEvolutionChart = dynamic(
  () => import("@/components/RaceTrackEvolutionChart"),
  { loading: ChartLoading, ssr: false },
);
const TrackEvolutionChart = dynamic(
  () => import("@/components/TrackEvolutionChart"),
  { loading: ChartLoading, ssr: false },
);
const TyreDegradationChart = dynamic(
  () => import("@/components/TyreDegradationChart"),
  { loading: ChartLoading, ssr: false },
);
const TyreProgrammeChart = dynamic(
  () => import("@/components/TyreProgrammeChart"),
  { loading: ChartLoading, ssr: false },
);

type TabType =
  | "race"
  | "qualifying"
  | "sprint"
  | "sprint-qualifying"
  | "practice";

const TAB_LABELS: Record<TabType, string> = {
  race: "Race",
  qualifying: "Qualifying",
  sprint: "Sprint",
  "sprint-qualifying": "Sprint Quali",
  practice: "Practice",
};

const VALID_TABS = new Set<TabType>([
  "race",
  "qualifying",
  "sprint",
  "sprint-qualifying",
  "practice",
]);

function parseTab(tab: string | null): TabType {
  return tab && VALID_TABS.has(tab as TabType) ? (tab as TabType) : "race";
}

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

/**
 * A titled chart panel. Renders nothing when the season predates the data the
 * chart needs, so eras without that data show no empty placeholder.
 */
function ChartPanel({
  title,
  patternId,
  availableFrom,
  season,
  children,
}: {
  title: React.ReactNode;
  patternId: string;
  availableFrom: number;
  season: number;
  children: React.ReactNode;
}) {
  if (season < availableFrom) return null;

  return (
    <div className="bg-bg-tertiary border border-border-primary rounded-sm shadow-sm overflow-hidden">
      <div className="relative h-10 bg-bg-primary border-b border-border-primary px-4 flex items-center overflow-hidden">
        <TrianglePattern id={patternId} />
        <span className="relative z-10 text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono">
          {title}
        </span>
      </div>
      <div className="p-3 md:p-6">{children}</div>
    </div>
  );
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
  const rawUrlTab = searchParams.get("tab");
  const urlTab = parseTab(rawUrlTab);
  const [activeTab, setActiveTab] = useState<TabType>(urlTab);

  // Scroll to top on page load
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Sync tab from URL changes (back/forward nav)
  useEffect(() => {
    setActiveTab(urlTab);
  }, [urlTab]);

  // Collapse legacy/deleted tab URLs like ?tab=strategy back to the race tab.
  useEffect(() => {
    if (rawUrlTab && !VALID_TABS.has(rawUrlTab as TabType)) {
      router.replace(`/results/${season}/${round}`, { scroll: false });
    }
  }, [rawUrlTab, router, season, round]);

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
  const isActiveTabAvailable = availableTabs.includes(activeTab);

  useEffect(() => {
    if (!loading && !isActiveTabAvailable) {
      setActiveTab("race");
      router.replace(`/results/${season}/${round}`, { scroll: false });
    }
  }, [isActiveTabAvailable, loading, router, season, round]);

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
        <div className="px-2 md:px-4">
          <div className="mx-auto w-full max-w-full md:max-w-[calc(72rem+40px)]">
            <div className="bg-bg-secondary/95 backdrop-blur-xl border-x border-b border-border-primary rounded-b-lg md:rounded-b-3xl rounded-t-none shadow-[0_10px_36px_rgba(0,0,0,0.35)]">
              <div className="min-h-14 px-3 py-2 md:h-16 md:px-6 md:py-0 grid grid-cols-[44px_minmax(0,1fr)_112px] items-center gap-2 md:flex md:items-center md:justify-between border-b border-border-primary/60">
                <div className="md:flex-1 flex items-center">
                  <button
                    type="button"
                    onClick={() => router.push(`/results/${season}`)}
                    className="h-10 w-11 md:w-auto bg-bg-primary border border-border-primary text-text-primary font-mono text-xs font-bold px-0 md:px-4 py-2 rounded-sm hover:border-purple-500 hover:text-purple-300 transition-colors duration-150 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span>←</span>
                    <span className="hidden sm:inline">BACK TO {season}</span>
                  </button>
                </div>

                <div className="min-w-0 flex flex-col items-center text-center">
                  <span className="text-text-primary font-mono text-sm font-bold leading-none truncate w-full">
                    ROUND {String(raceData.session.round).padStart(2, "0")}
                  </span>
                  <span className="text-text-muted text-[10px] tracking-widest uppercase font-bold truncate w-full">
                    {raceData.session.event_name.replace("Grand Prix", "GP")}
                  </span>
                </div>

                <div className="min-w-0 md:flex-1 flex justify-end">
                  <JumpToRace
                    currentSeason={season}
                    availableSeasons={availableYears}
                    label="Jump"
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
              summary={activeSummary}
            />
            {(activeTab === "qualifying" ||
              activeTab === "sprint-qualifying") && (
              <div className="p-3 md:p-6 space-y-4 md:space-y-6">
                {/* Q1/Q2/Q3 Progression */}
                <div className="bg-bg-tertiary border border-border-primary rounded-sm shadow-sm overflow-hidden">
                  <div className="relative h-10 bg-bg-primary border-b border-border-primary px-4 flex items-center overflow-hidden">
                    <TrianglePattern id="quali-prog-triangles" />
                    <span className="relative z-10 text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono">
                      Q1 → Q2 → Q3 Progression
                    </span>
                  </div>
                  <div className="p-3 md:p-6">
                    <QualifyingProgressionChart
                      qualifyingData={getSessionDetailData()}
                    />
                  </div>
                </div>

                <ChartPanel
                  title="Sector Comparison"
                  patternId="qualifying-tab-sector-triangles"
                  availableFrom={DATA_FROM.telemetry}
                  season={seasonNum}
                >
                  <QualifyingSectorComparison
                    season={seasonNum}
                    round={roundNum}
                  />
                </ChartPanel>

                <ChartPanel
                  title="Sector Heatmap — All Drivers"
                  patternId="quali-heat-triangles"
                  availableFrom={DATA_FROM.telemetry}
                  season={seasonNum}
                >
                  <QualifyingSectorHeatmap
                    season={seasonNum}
                    round={roundNum}
                  />
                </ChartPanel>
              </div>
            )}
            {activeTab === "race" && (
              <div className="p-3 md:p-6 space-y-4 md:space-y-6">
                <ChartPanel
                  title="Lap Time Distribution"
                  patternId="lap-dist-triangles"
                  availableFrom={DATA_FROM.laps}
                  season={seasonNum}
                >
                  <LapTimeDistributionChart
                    season={seasonNum}
                    round={roundNum}
                  />
                </ChartPanel>

                <ChartPanel
                  title="Fastest Lap Timeline"
                  patternId="fastest-lap-triangles"
                  availableFrom={DATA_FROM.laps}
                  season={seasonNum}
                >
                  <FastestLapTimeline season={seasonNum} round={roundNum} />
                </ChartPanel>

                <ChartPanel
                  title="Pit Stop Duration"
                  patternId="pit-stop-triangles"
                  availableFrom={DATA_FROM.pitStops}
                  season={seasonNum}
                >
                  <PitStopDeltaChart season={seasonNum} round={roundNum} />
                </ChartPanel>

                <ChartPanel
                  title="Race Pace Evolution"
                  patternId="race-track-evo-triangles"
                  availableFrom={DATA_FROM.telemetry}
                  season={seasonNum}
                >
                  <RaceTrackEvolutionChart
                    season={seasonNum}
                    round={roundNum}
                  />
                </ChartPanel>

                <ChartPanel
                  title="Tyre Degradation"
                  patternId="tyre-deg-triangles"
                  availableFrom={DATA_FROM.telemetry}
                  season={seasonNum}
                >
                  <TyreDegradationChart season={seasonNum} round={roundNum} />
                </ChartPanel>
              </div>
            )}
            {activeTab === "practice" && (
              <div className="p-3 md:p-6 space-y-4 md:space-y-6">
                <ChartPanel
                  title={`FP${practiceSub} Long Run Pace`}
                  patternId="long-run-triangles"
                  availableFrom={DATA_FROM.telemetry}
                  season={seasonNum}
                >
                  <LongRunPaceChart
                    season={seasonNum}
                    round={roundNum}
                    practiceSession={practiceSub}
                  />
                </ChartPanel>

                <ChartPanel
                  title={`FP${practiceSub} Track Evolution`}
                  patternId="track-evo-triangles"
                  availableFrom={DATA_FROM.telemetry}
                  season={seasonNum}
                >
                  <TrackEvolutionChart
                    season={seasonNum}
                    round={roundNum}
                    practiceSession={practiceSub}
                  />
                </ChartPanel>

                <ChartPanel
                  title={`FP${practiceSub} Sector Analysis`}
                  patternId="sector-heat-triangles"
                  availableFrom={DATA_FROM.telemetry}
                  season={seasonNum}
                >
                  <PracticeSectorHeatmap
                    season={seasonNum}
                    round={roundNum}
                    practiceSession={practiceSub}
                  />
                </ChartPanel>

                <ChartPanel
                  title={`FP${practiceSub} Tyre Programme`}
                  patternId="tyre-prog-triangles"
                  availableFrom={DATA_FROM.telemetry}
                  season={seasonNum}
                >
                  <TyreProgrammeChart
                    season={seasonNum}
                    round={roundNum}
                    practiceSession={practiceSub}
                  />
                </ChartPanel>

                {/* Cross-Session Comparison (only when multiple FP sessions exist) */}
                {(fp1Data || fp2Data || fp3Data) &&
                  [fp1Data, fp2Data, fp3Data].filter(Boolean).length >= 2 && (
                    <div className="bg-bg-tertiary border border-border-primary rounded-sm shadow-sm overflow-hidden">
                      <div className="relative h-10 bg-bg-primary border-b border-border-primary px-4 flex items-center overflow-hidden">
                        <TrianglePattern id="cross-session-triangles" />
                        <span className="relative z-10 text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono">
                          FP1 / FP2 / FP3 Session Comparison
                        </span>
                      </div>
                      <div className="p-3 md:p-6">
                        <CrossSessionComparison
                          fp1Data={fp1Data}
                          fp2Data={fp2Data}
                          fp3Data={fp3Data}
                        />
                      </div>
                    </div>
                  )}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
