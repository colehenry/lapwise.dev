"use client";

import dynamic from "next/dynamic";
import { TrianglePattern } from "@/components/layout/Patterns";
import DeferredSection from "@/components/ui/DeferredSection";
import Skeleton from "@/components/ui/Skeleton";

const ANALYSIS_MIN_HEIGHT = 360;

const PointsByRoundGraph = dynamic(
  () => import("@/components/charts/PointsByRoundGraph"),
  { loading: () => <Skeleton variant="rectangular" height="320px" /> },
);

const TeammateHeadToHead = dynamic(
  () => import("@/components/standings/TeammateHeadToHead"),
  { loading: () => <Skeleton variant="rectangular" height="320px" /> },
);

type SeasonAnalysisPanelsProps = {
  season: string;
  sessionType: "race" | "qualifying";
};

function PanelShell({
  title,
  patternId,
  children,
}: {
  title: string;
  patternId: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6 overflow-hidden bg-bg-tertiary border border-border-primary rounded-sm shadow-sm">
      <div className="relative h-10 bg-bg-primary border-b border-border-primary px-4 flex items-center overflow-hidden">
        <TrianglePattern id={patternId} />
        <span className="relative z-10 text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono">
          {title}
        </span>
      </div>
      <div className="min-w-0 p-3 md:p-4">
        <DeferredSection minHeight={ANALYSIS_MIN_HEIGHT}>
          {children}
        </DeferredSection>
      </div>
    </div>
  );
}

/**
 * Below-fold season analysis. Both charts are dynamically imported and mount
 * only as the reader approaches them, so they never compete with the standings
 * for the initial load.
 */
export default function SeasonAnalysisPanels({
  season,
  sessionType,
}: SeasonAnalysisPanelsProps) {
  return (
    <>
      <PanelShell title="Championship Battle" patternId="points-triangles">
        <PointsByRoundGraph season={season} pointsType={sessionType} />
      </PanelShell>
      <PanelShell
        title="Teammate Head-to-Head"
        patternId="teammate-h2h-triangles"
      >
        <TeammateHeadToHead season={season} mode={sessionType} />
      </PanelShell>
    </>
  );
}
