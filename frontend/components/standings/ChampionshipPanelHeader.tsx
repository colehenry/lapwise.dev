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
    <div className="relative h-10 bg-surface-page border-b border-line-soft px-4 flex items-center gap-2">
      <GridPattern id={patternId} />
      <span className="relative z-10 text-[10px] tracking-widest text-ink-faint font-bold uppercase font-mono text-nowrap">
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
