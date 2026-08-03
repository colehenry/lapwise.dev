"use client";

import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import RaceComments from "@/components/comments/RaceComments";
import JumpToRace from "@/components/layout/JumpToRace";
import SessionDetail from "@/components/session/SessionDetail";
import type { SessionSummary } from "@/components/session/SessionSummaryCard";
import DeferredSection from "@/components/ui/DeferredSection";
import { seasonsQuery } from "@/lib/queries/seasons";
import {
  defaultPracticeNumber,
  roundAvailabilityQuery,
  roundSessionQuery,
  roundSummariesQuery,
  serverSessionType,
  availableTabs as tabsFromAvailability,
} from "@/lib/queries/sessions";
import type { SessionResultsResponse } from "@/lib/types";
import RoundAnalysisCharts, { type RoundTab } from "./RoundAnalysisCharts";

const TAB_LABELS: Record<RoundTab, string> = {
  race: "Race",
  qualifying: "Qualifying",
  sprint: "Sprint",
  "sprint-qualifying": "Sprint Quali",
  practice: "Practice",
};

const VALID_TABS = new Set<RoundTab>([
  "race",
  "qualifying",
  "sprint",
  "sprint-qualifying",
  "practice",
]);

function parseTab(tab: string | null): RoundTab {
  return tab && VALID_TABS.has(tab as RoundTab) ? (tab as RoundTab) : "race";
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
  const [activeTab, setActiveTab] = useState<RoundTab>(urlTab);

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
    if (rawUrlTab && !VALID_TABS.has(rawUrlTab as RoundTab)) {
      router.replace(`/results/${season}/${round}`, { scroll: false });
    }
  }, [rawUrlTab, router, season, round]);

  const queryClient = useQueryClient();

  // One metadata request describes the weekend; sessions load on selection.
  const { data: availability, isLoading: availabilityLoading } = useQuery(
    roundAvailabilityQuery(seasonNum, roundNum),
  );

  const availableTabs = tabsFromAvailability(availability);
  const isActiveTabAvailable = availableTabs.includes(activeTab);
  const resolvedTab: RoundTab = isActiveTabAvailable ? activeTab : "race";

  const [practiceSub, setPracticeSub] = useState<1 | 2 | 3 | null>(null);
  const practiceNumbers = availability?.practice_numbers ?? [];
  const activePractice = practiceSub ?? defaultPracticeNumber(availability);

  // Keeping the previous session on screen means a tab change never blanks
  // the page while the newly selected session loads.
  const { data: sessionData, isLoading: sessionLoading } = useQuery({
    ...roundSessionQuery(seasonNum, roundNum, resolvedTab, activePractice),
    placeholderData: keepPreviousData,
  });

  const { data: summariesData } = useQuery({
    ...roundSummariesQuery(seasonNum, roundNum),
    enabled: (availability?.summary_session_types.length ?? 0) > 0,
  });

  const { data: availableYears = [] } = useQuery(seasonsQuery());

  const loading = availabilityLoading || (sessionLoading && !sessionData);

  // Warm a tab on hover or keyboard focus, never on mount.
  const prefetchTab = useCallback(
    (tab: RoundTab) => {
      queryClient.prefetchQuery(
        roundSessionQuery(seasonNum, roundNum, tab, activePractice),
      );
    },
    [queryClient, seasonNum, roundNum, activePractice],
  );

  // Update URL when tab changes
  const switchTab = (tab: RoundTab) => {
    setActiveTab(tab);
    const url =
      tab === "race"
        ? `/results/${season}/${round}`
        : `/results/${season}/${round}?tab=${tab}`;
    router.replace(url, { scroll: false });
  };

  useEffect(() => {
    if (availability && !isActiveTabAvailable) {
      setActiveTab("race");
      router.replace(`/results/${season}/${round}`, { scroll: false });
    }
  }, [availability, isActiveTabAvailable, router, season, round]);

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

  if (!availability || !sessionData) {
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

  const activeSessionData: SessionResultsResponse | null = sessionData ?? null;

  // Check if the active tab is a results tab (shows SessionDetail)
  const isResultsTab = availableTabs.includes(resolvedTab);
  const isSprint =
    resolvedTab === "sprint" || resolvedTab === "sprint-qualifying";
  const sessionTypeForDetail =
    resolvedTab === "qualifying" || resolvedTab === "sprint-qualifying"
      ? "qualifying"
      : "race";

  const activeSessionType = serverSessionType(resolvedTab, activePractice);
  const activeSummary = summariesData?.summaries.find(
    (summary) => summary.session_type === activeSessionType,
  ) as SessionSummary | undefined;

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
                    ROUND {String(availability.round).padStart(2, "0")}
                  </span>
                  <span className="text-text-muted text-[10px] tracking-widest uppercase font-bold truncate w-full">
                    {availability.event_name.replace("Grand Prix", "GP")}
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
                    const isActive = resolvedTab === tab;

                    return (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => switchTab(tab)}
                        onPointerEnter={() => prefetchTab(tab)}
                        onFocus={() => prefetchTab(tab)}
                        className={`px-4 py-2.5 text-xs font-bold font-mono uppercase tracking-widest transition-colors duration-150 border-b-2 whitespace-nowrap ${
                          isActive
                            ? "border-purple-500 text-purple-300"
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
            {resolvedTab === "practice" && (
              <div className="px-6 pt-6 flex justify-center">
                <div className="inline-flex bg-bg-primary border border-border-primary rounded-sm overflow-hidden">
                  {([1, 2, 3] as const).map((num) => {
                    const hasData = practiceNumbers.includes(num);
                    const isActive = activePractice === num;
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
              data={activeSessionData}
              // The session-type toggle is not offered here, which is the only
              // consumer of qualifying context inside SessionDetail.
              qualifyingData={null}
              season={season}
              isSprint={isSprint}
              sessionType={
                resolvedTab === "practice" ? "practice" : sessionTypeForDetail
              }
              onSessionTypeChange={undefined}
              onBack={() => router.push(`/results/${season}`)}
              hideHeader={true}
              summary={activeSummary}
            />
            <RoundAnalysisCharts
              activeTab={resolvedTab}
              season={seasonNum}
              round={roundNum}
              practiceSession={activePractice}
              sessionData={activeSessionData}
              practiceNumbers={practiceNumbers}
            />
          </>
        )}

        <DeferredSection minHeight={320}>
          <RaceComments season={seasonNum} round={roundNum} />
        </DeferredSection>
      </div>
    </main>
  );
}
