"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import LapTimeByLapGraph from "@/components/LapTimeByLapGraph";
import { TrianglePattern } from "@/components/Patterns";
import PitStrategyTimeline from "@/components/PitStrategyTimeline";
import QualifyingSectorComparison from "@/components/QualifyingSectorComparison";
import SessionDetail from "@/components/SessionDetail";
import SpeedTrapChart from "@/components/SpeedTrapChart";
import TyreDegradationChart from "@/components/TyreDegradationChart";
import WeatherChart from "@/components/WeatherChart";
import { apiHeaders, apiUrl } from "@/lib/api";

// Type definitions matching API responses
type CircuitInfo = {
  id: number;
  name: string;
  location: string;
  country: string;
  track_length_km: number | null;
  track_map_url: string | null;
};

type DriverInfo = {
  driver_number: number | null;
  driver_code: string;
  full_name: string;
  country_code: string | null;
};

type TeamInfo = {
  name: string;
  team_color: string | null;
};

type SessionResultDetail = {
  position: number | null;
  status: string;
  headshot_url: string | null;
  driver: DriverInfo;
  team: TeamInfo;
  grid_position: number | null;
  points: number | null;
  laps_completed: number | null;
  time_seconds: number | null;
  fastest_lap: boolean;
  q1_time_seconds: number | null;
  q2_time_seconds: number | null;
  q3_time_seconds: number | null;
};

type SessionInfo = {
  id: number;
  year: number;
  round: number;
  session_type: string;
  event_name: string;
  date: string;
  circuit: CircuitInfo;
};

type SessionResultsResponse = {
  session: SessionInfo;
  results: SessionResultDetail[];
};

type TabType = "race" | "qualifying" | "sprint" | "strategy" | "analysis";

const TAB_LABELS: Record<TabType, string> = {
  race: "Race",
  qualifying: "Qualifying",
  sprint: "Sprint",
  strategy: "Strategy",
  analysis: "Analysis",
};

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

  // Data states
  const [raceData, setRaceData] = useState<SessionResultsResponse | null>(null);
  const [qualifyingData, setQualifyingData] =
    useState<SessionResultsResponse | null>(null);
  const [sprintData, setSprintData] = useState<SessionResultsResponse | null>(
    null,
  );
  const [sprintQualData, setSprintQualData] =
    useState<SessionResultsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasSprint, setHasSprint] = useState(false);

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

  // Fetch all session data
  useEffect(() => {
    if (!season || !round) return;

    let isMounted = true;

    (async () => {
      try {
        setLoading(true);

        // Fetch race data
        const raceRes = await fetch(apiUrl(`/api/results/${season}/${round}`), {
          cache: "no-store",
          headers: apiHeaders(),
        });
        if (raceRes.ok) {
          const raceJson = await raceRes.json();
          if (isMounted) setRaceData(raceJson);
        }

        if (!isMounted) return;

        // Prefetch qualifying, sprint, sprint-qualifying in parallel
        const [qualRes, sprintRes, sprintQualRes] = await Promise.allSettled([
          fetch(apiUrl(`/api/results/${season}/${round}/qualifying`), {
            cache: "no-store",
            headers: apiHeaders(),
          }),
          fetch(apiUrl(`/api/results/${season}/${round}/sprint`), {
            cache: "no-store",
            headers: apiHeaders(),
          }),
          fetch(apiUrl(`/api/results/${season}/${round}/sprint-qualifying`), {
            cache: "no-store",
            headers: apiHeaders(),
          }),
        ]);

        if (!isMounted) return;

        // Process qualifying
        if (qualRes.status === "fulfilled" && qualRes.value.ok) {
          setQualifyingData(await qualRes.value.json());
        }

        // Process sprint
        if (sprintRes.status === "fulfilled" && sprintRes.value.ok) {
          const sprintJson = await sprintRes.value.json();
          setSprintData(sprintJson);
          setHasSprint(true);
        }

        // Process sprint qualifying
        if (sprintQualRes.status === "fulfilled" && sprintQualRes.value.ok) {
          setSprintQualData(await sprintQualRes.value.json());
        }
      } catch (error) {
        if (isMounted) {
          console.error("Failed to fetch round details:", error);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [season, round]);

  // Update URL when tab changes
  const switchTab = (tab: TabType) => {
    setActiveTab(tab);
    const url =
      tab === "race"
        ? `/results/${season}/${round}`
        : `/results/${season}/${round}?tab=${tab}`;
    router.replace(url, { scroll: false });
  };

  // Available tabs (sprint only if sprint data exists)
  const availableTabs: TabType[] = ["race", "qualifying"];
  if (hasSprint) availableTabs.push("sprint");
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
  const getSessionDetailData = () => {
    switch (activeTab) {
      case "qualifying":
        return qualifyingData;
      case "sprint":
        return sprintData;
      default:
        return raceData;
    }
  };

  const getQualifyingDataForTab = () => {
    if (activeTab === "sprint") return sprintQualData;
    return qualifyingData;
  };

  // Check if the active tab is a results tab (shows SessionDetail)
  const isResultsTab = ["race", "qualifying", "sprint"].includes(activeTab);
  const isSprint = activeTab === "sprint";
  const sessionTypeForDetail =
    activeTab === "qualifying" ? "qualifying" : "race";

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
                (tab === "sprint" && !sprintData);

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
        )}

        {/* Strategy Tab */}
        {activeTab === "strategy" && (
          <div className="p-6 space-y-6">
            {/* Pit Strategy Timeline */}
            <div className="bg-bg-tertiary border border-border-primary rounded-sm shadow-sm overflow-hidden">
              <div className="relative h-10 bg-bg-primary border-b border-border-primary px-4 flex items-center overflow-hidden">
                <TrianglePattern id="pit-strategy-triangles" />
                <span className="relative z-10 text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono">
                  Pit Strategy
                </span>
              </div>
              <div className="p-6">
                <PitStrategyTimeline season={seasonNum} round={roundNum} />
              </div>
            </div>

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
