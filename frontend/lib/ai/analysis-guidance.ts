import type { AnalysisPageContext } from "./analysis-contracts";
import {
  inferKnowledgeTopics,
  type KnowledgeTopic,
} from "./knowledge-registry";

export interface AnalysisGuidance {
  families: KnowledgeTopic[];
  requiredTools: string[];
  evidenceRequirements: string[];
  source: "deterministic-multifacet";
}

export function buildAnalysisGuidance(
  question: string,
  pageContext?: AnalysisPageContext,
): AnalysisGuidance {
  const families = inferKnowledgeTopics(question);
  const tools = new Set<string>();
  const evidence = new Set<string>();
  const needsSessionResolution = !pageContext?.sessionId;

  for (const family of families) {
    if (["results", "qualifying", "weather"].includes(family)) {
      if (needsSessionResolution) tools.add("resolve_session");
      evidence.add("session_records");
    }
    if (family === "race_narrative" || family === "strategy") {
      if (needsSessionResolution) tools.add("resolve_session");
      tools.add("get_race_dynamics");
      evidence.add("lap_positions");
      evidence.add("race_control");
    }
    if (family === "standings") evidence.add("canonical_standings");
    if (family === "weather") evidence.add("weather_samples");
  }

  return {
    families,
    requiredTools: [...tools],
    evidenceRequirements: [...evidence],
    source: "deterministic-multifacet",
  };
}
