import {
  type AnalysisPlan,
  type AnswerArtifact,
  analysisPlanSchema,
  answerArtifactSchema,
} from "./analysis-contracts";
import { KNOWLEDGE_NODES } from "./knowledge-registry";
import { extractSeason } from "./question-parsing";

export interface RulesAnalysisExecution {
  plan: AnalysisPlan;
  artifact: AnswerArtifact;
  queries: string[];
  model: string;
}

export function tryRunRulesAnalysis(
  question: string,
): RulesAnalysisExecution | null {
  if (!/\bfastest[- ]lap point\b/i.test(question)) return null;
  const season = extractSeason(question);
  if (season === null) return null;
  const eligible = season >= 2019 && season <= 2024;
  const summary = eligible
    ? `Yes. In ${season}, the race fastest lap was worth one championship point, but only when the driver finished in the top ten.`
    : season >= 2025
      ? `No. The fastest-lap bonus point was removed for the ${season} season.`
      : `No. The modern fastest-lap bonus point did not apply in ${season}; it ran from 2019 through 2024.`;
  const node = KNOWLEDGE_NODES.find(
    (candidate) => candidate.id === "fastest-lap-bonus",
  );
  if (!node) throw new Error("Fastest-lap knowledge node is unavailable");
  const evidenceId = `${node.id}-${season}`;
  const plan = analysisPlanSchema.parse({
    version: 1,
    question,
    entities: [{ kind: "season", id: season, name: String(season) }],
    scope: { season },
    facets: [
      {
        family: "rules",
        objective:
          "Explain the fastest-lap bonus rule for the requested season",
        metrics: ["rule_effective_dates", "eligibility_condition"],
        presentations: ["narrative", "metric_cards"],
      },
    ],
    assumptions: [],
    unresolvedTerms: [],
  });
  const artifact = answerArtifactSchema.parse({
    version: 1,
    family: "rules",
    title: `${season} fastest-lap point rule`,
    summary,
    metrics: [
      {
        id: "bonus-point",
        label: "Fastest-lap bonus",
        value: eligible ? 1 : 0,
        displayValue: eligible ? "1 point" : "No bonus point",
        evidenceIds: [evidenceId],
      },
      {
        id: "effective-seasons",
        label: "Modern rule window",
        value: "2019-2024",
        displayValue: "2019–2024",
        evidenceIds: [evidenceId],
      },
    ],
    tables: [],
    charts: [],
    evidence: [
      {
        id: evidenceId,
        kind: "knowledge_node",
        label: "Fastest-lap bonus rule node",
        source: node.id,
        fields: { season, eligible, tags: node.tags },
      },
    ],
    caveats: eligible
      ? ["The bonus required a top-ten classified finish."]
      : [],
  });
  return {
    plan,
    artifact,
    queries: [],
    model: "deterministic/rules-fastest-lap-v1",
  };
}
