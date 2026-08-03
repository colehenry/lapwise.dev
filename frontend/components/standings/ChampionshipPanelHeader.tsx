import { GridPattern } from "@/components/layout/Patterns";
import type { ChampionshipScoringInfo } from "@/lib/types";
import ChampionshipScoringControl, {
  type ChampionshipPointsMode,
} from "./ChampionshipScoringControl";

export default function ChampionshipPanelHeader({
  patternId,
  raceTitle,
  qualifyingTitle,
  sessionType,
  scoring,
  mode,
  onModeChange,
}: {
  patternId: string;
  raceTitle: string;
  qualifyingTitle: string;
  sessionType: "race" | "qualifying";
  scoring: ChampionshipScoringInfo | undefined;
  mode: ChampionshipPointsMode;
  onModeChange: (mode: ChampionshipPointsMode) => void;
}) {
  return (
    <div className="relative h-10 bg-bg-primary border-b border-border-primary px-4 flex items-center gap-2">
      <GridPattern id={patternId} />
      <span className="relative z-10 text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono text-nowrap">
        {sessionType === "race" ? raceTitle : qualifyingTitle}
      </span>
      {sessionType === "race" && (
        <ChampionshipScoringControl
          info={scoring}
          mode={mode}
          onChange={onModeChange}
        />
      )}
    </div>
  );
}
