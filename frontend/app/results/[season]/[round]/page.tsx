"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import LapTimeByLapGraph from "@/components/LapTimeByLapGraph";
import { TrianglePattern } from "@/components/Patterns";
import QualifyingSectorComparison from "@/components/QualifyingSectorComparison";
import SessionDetail from "@/components/SessionDetail";
import SpeedTrapChart from "@/components/SpeedTrapChart";
import TyreDegradationChart from "@/components/TyreDegradationChart";
import WeatherChart from "@/components/WeatherChart";
import { apiHeaders, apiUrl } from "@/lib/api";
import type { SessionResultsResponse } from "@/lib/types";

type TabType =
  | "race"
  | "qualifying"
  | "sprint"
  | "sprint-qualifying"
  | "strategy"
  | "analysis";

const TAB_LABELS: Record<TabType, string> = {
  race: "Race",
  qualifying: "Qualifying",
  sprint: "Sprint",
  "sprint-qualifying": "Sprint Quali",
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

export default function RoundDetailPage() {
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

  const loading = raceLoading;
  const hasSprint = !!sprintData;

  // Update URL when tab changes
  const switchTab = (tab: TabType) => {
    setActiveTab(tab);
    const url =
      tab === "race"
        ? `/results/${season}/${round}`
        : `/results/${season}/${round}?tab=${tab}`;
    router.replace(url, { scroll: false });
  };

  // Available tabs (sprint tabs only if sprint data exists)
  const availableTabs: TabType[] = ["race", "qualifying"];
  if (hasSprint) {
    availableTabs.push("sprint");
    if (sprintQualData) availableTabs.push("sprint-qualifying");
  }
  availableTabs.push("strategy", "analysis");

  if (loading) {
    return (
      <main className="min-h-screen bg-bg-secondary p-8">
        <div className="max-w-7xl mx-auto">
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
        <div className="max-w-7xl mx-auto">
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
  ].includes(activeTab);
  const isSprint = activeTab === "sprint" || activeTab === "sprint-qualifying";
  const sessionTypeForDetail =
    activeTab === "qualifying" || activeTab === "sprint-qualifying"
      ? "qualifying"
      : "race";

  return (
    <main className="min-h-screen bg-bg-secondary">
      {/* Sticky Header with Tabs */}
      <div className="sticky top-0 z-40 bg-bg-secondary border-b border-border-primary">
        <div className="max-w-7xl mx-auto px-6">
          <div className="h-16 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => router.push(`/results/${season}`)}
                className="bg-bg-primary border border-border-primary text-text-primary font-mono text-xs font-bold px-4 py-2 rounded-sm hover:border-purple-500 hover:text-purple-300 transition-colors duration-150 cursor-pointer flex items-center gap-2"
              >
                <span>←</span>
                <span className="hidden sm:inline">BACK TO {season}</span>
              </button>
              <div className="flex flex-col">
                <span className="text-text-primary font-mono text-sm font-bold leading-none">
                  ROUND {String(raceData.session.round).padStart(2, "0")}
                </span>
                <span className="text-text-muted text-[10px] tracking-widest uppercase font-bold hidden sm:inline">
                  {raceData.session.event_name.replace("Grand Prix", "GP")}
                </span>
              </div>
            </div>
          </div>

          {/* Tab Bar */}
          <div className="flex items-center gap-1 -mb-px overflow-x-auto pb-0">
            {availableTabs.map((tab) => {
              const isActive = activeTab === tab;
              const isDisabled =
                (tab === "qualifying" && !qualifyingData) ||
                (tab === "sprint" && !sprintData) ||
                (tab === "sprint-qualifying" && !sprintQualData);

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

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto">
        {/* Race / Qualifying / Sprint tabs — show SessionDetail */}
        {isResultsTab && (
          <>
            <SessionDetail
              data={getSessionDetailData()}
              qualifyingData={getQualifyingDataForTab()}
              season={season}
              isSprint={isSprint}
              sessionType={sessionTypeForDetail}
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
