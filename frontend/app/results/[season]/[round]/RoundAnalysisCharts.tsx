"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { TrianglePattern } from "@/components/Patterns";
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

export type RoundTab =
  | "race"
  | "qualifying"
  | "sprint"
  | "sprint-qualifying"
  | "practice";

interface ChartPanelProps {
  title: ReactNode;
  patternId: string;
  availableFrom?: number;
  season: number;
  children: ReactNode;
}

function ChartPanel({
  title,
  patternId,
  availableFrom,
  season,
  children,
}: ChartPanelProps) {
  if (availableFrom && season < availableFrom) return null;

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

interface RoundAnalysisChartsProps {
  activeTab: RoundTab;
  season: number;
  round: number;
  practiceSession: 1 | 2 | 3;
  sessionData: SessionResultsResponse | null;
  fp1Data?: SessionResultsResponse | null;
  fp2Data?: SessionResultsResponse | null;
  fp3Data?: SessionResultsResponse | null;
}

export default function RoundAnalysisCharts({
  activeTab,
  season,
  round,
  practiceSession,
  sessionData,
  fp1Data,
  fp2Data,
  fp3Data,
}: RoundAnalysisChartsProps) {
  if (activeTab === "qualifying" || activeTab === "sprint-qualifying") {
    return (
      <div className="p-3 md:p-6 space-y-4 md:space-y-6">
        <ChartPanel
          title="Q1 → Q2 → Q3 Progression"
          patternId="quali-prog-triangles"
          season={season}
        >
          <QualifyingProgressionChart qualifyingData={sessionData} />
        </ChartPanel>
        <ChartPanel
          title="Sector Comparison"
          patternId="qualifying-tab-sector-triangles"
          availableFrom={DATA_FROM.telemetry}
          season={season}
        >
          <QualifyingSectorComparison season={season} round={round} />
        </ChartPanel>
        <ChartPanel
          title="Sector Heatmap — All Drivers"
          patternId="quali-heat-triangles"
          availableFrom={DATA_FROM.telemetry}
          season={season}
        >
          <QualifyingSectorHeatmap season={season} round={round} />
        </ChartPanel>
      </div>
    );
  }

  if (activeTab === "race") {
    return (
      <div className="p-3 md:p-6 space-y-4 md:space-y-6">
        <ChartPanel
          title="Lap Time Distribution"
          patternId="lap-dist-triangles"
          availableFrom={DATA_FROM.laps}
          season={season}
        >
          <LapTimeDistributionChart season={season} round={round} />
        </ChartPanel>
        <ChartPanel
          title="Fastest Lap Timeline"
          patternId="fastest-lap-triangles"
          availableFrom={DATA_FROM.laps}
          season={season}
        >
          <FastestLapTimeline season={season} round={round} />
        </ChartPanel>
        <ChartPanel
          title="Pit Stop Duration"
          patternId="pit-stop-triangles"
          availableFrom={DATA_FROM.pitStops}
          season={season}
        >
          <PitStopDeltaChart season={season} round={round} />
        </ChartPanel>
        <ChartPanel
          title="Race Pace Evolution"
          patternId="race-track-evo-triangles"
          availableFrom={DATA_FROM.telemetry}
          season={season}
        >
          <RaceTrackEvolutionChart season={season} round={round} />
        </ChartPanel>
        <ChartPanel
          title="Tyre Degradation"
          patternId="tyre-deg-triangles"
          availableFrom={DATA_FROM.telemetry}
          season={season}
        >
          <TyreDegradationChart season={season} round={round} />
        </ChartPanel>
      </div>
    );
  }

  if (activeTab !== "practice") return null;

  const sessionCount = [fp1Data, fp2Data, fp3Data].filter(Boolean).length;

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6">
      <ChartPanel
        title={`FP${practiceSession} Long Run Pace`}
        patternId="long-run-triangles"
        availableFrom={DATA_FROM.telemetry}
        season={season}
      >
        <LongRunPaceChart
          season={season}
          round={round}
          practiceSession={practiceSession}
        />
      </ChartPanel>
      <ChartPanel
        title={`FP${practiceSession} Track Evolution`}
        patternId="track-evo-triangles"
        availableFrom={DATA_FROM.telemetry}
        season={season}
      >
        <TrackEvolutionChart
          season={season}
          round={round}
          practiceSession={practiceSession}
        />
      </ChartPanel>
      <ChartPanel
        title={`FP${practiceSession} Sector Analysis`}
        patternId="sector-heat-triangles"
        availableFrom={DATA_FROM.telemetry}
        season={season}
      >
        <PracticeSectorHeatmap
          season={season}
          round={round}
          practiceSession={practiceSession}
        />
      </ChartPanel>
      <ChartPanel
        title={`FP${practiceSession} Tyre Programme`}
        patternId="tyre-prog-triangles"
        availableFrom={DATA_FROM.telemetry}
        season={season}
      >
        <TyreProgrammeChart
          season={season}
          round={round}
          practiceSession={practiceSession}
        />
      </ChartPanel>
      {sessionCount >= 2 && (
        <ChartPanel
          title="FP1 / FP2 / FP3 Session Comparison"
          patternId="cross-session-triangles"
          season={season}
        >
          <CrossSessionComparison
            fp1Data={fp1Data}
            fp2Data={fp2Data}
            fp3Data={fp3Data}
          />
        </ChartPanel>
      )}
    </div>
  );
}
