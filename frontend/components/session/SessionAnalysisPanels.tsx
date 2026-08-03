"use client";

import dynamic from "next/dynamic";
import { TrianglePattern } from "@/components/layout/Patterns";
import DeferredSection from "@/components/ui/DeferredSection";
import Skeleton from "@/components/ui/Skeleton";
import type { SessionResultDetail } from "@/lib/types";

// Session charts load with their panel, keeping the classification table first.
const ChartFallback = () => <Skeleton variant="rectangular" height="320px" />;
const LapTimeByLapGraph = dynamic(
  () => import("@/components/charts/LapTimeByLapGraph"),
  {
    loading: ChartFallback,
  },
);
const QualifyingSpreadChart = dynamic(
  () => import("@/components/charts/QualifyingSpreadChart"),
  {
    loading: ChartFallback,
  },
);
const TyreStintChart = dynamic(
  () => import("@/components/charts/TyreStintChart"),
  {
    loading: ChartFallback,
  },
);

type SessionAnalysisPanelsProps = {
  season: number;
  round: number;
  isSprint: boolean;
  isQualifying: boolean;
  isPractice: boolean;
  results: SessionResultDetail[];
};

export default function SessionAnalysisPanels({
  season,
  round,
  isSprint,
  isQualifying,
  isPractice,
  results,
}: SessionAnalysisPanelsProps) {
  return (
    <>
      {/* ── Lap Time Graph (Race) or Gap Chart (Qualifying) ── */}
      {!isPractice && (
        <div className="bg-bg-tertiary border border-border-primary rounded-sm shadow-sm overflow-visible">
          <div className="relative h-10 bg-bg-primary border-b border-border-primary px-4 flex items-center overflow-hidden rounded-t-sm">
            <TrianglePattern id="analysis-triangles" />
            <span className="relative z-10 text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono">
              {isQualifying ? "Qualifying Analysis" : "Race Performance"}
            </span>
          </div>

          <div className="p-6">
            <DeferredSection minHeight={320} placeholder={<ChartFallback />}>
              {!isQualifying ? (
                <LapTimeByLapGraph
                  season={season}
                  round={round}
                  isSprint={isSprint}
                />
              ) : (
                <QualifyingSpreadChart results={results} />
              )}
            </DeferredSection>
          </div>
        </div>
      )}

      {/* ── Tyre Strategy (Race only) ── */}
      {!isQualifying && !isPractice && (
        <div className="mt-6 bg-bg-tertiary border border-border-primary rounded-sm shadow-sm overflow-hidden">
          <div className="relative h-10 bg-bg-primary border-b border-border-primary px-4 flex items-center overflow-hidden">
            <TrianglePattern id="tyre-triangles" />
            <span className="relative z-10 text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono">
              Tyre Strategy
            </span>
          </div>

          <div className="p-6">
            <DeferredSection minHeight={320} placeholder={<ChartFallback />}>
              <TyreStintChart
                season={season}
                round={round}
                isSprint={isSprint}
              />
            </DeferredSection>
          </div>
        </div>
      )}
    </>
  );
}
