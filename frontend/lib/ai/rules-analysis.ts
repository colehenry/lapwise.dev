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

function asksAboutChampionshipScoring(question: string): boolean {
  return /\b(points? system|scoring (?:work|system|change|history)|how (?:do|does|did)\b[^?]*\b(?:points? work|scor)|score points|scoring changed)\b/i.test(
    question,
  );
}

function buildScoringAnalysis(question: string): RulesAnalysisExecution {
  const node = KNOWLEDGE_NODES.find(
    (candidate) => candidate.id === "championship-points-system",
  );
  if (!node)
    throw new Error("Championship-points knowledge node is unavailable");

  const evidenceId = `${node.id}-current`;
  const plan = analysisPlanSchema.parse({
    version: 1,
    question,
    entities: [],
    scope: {},
    facets: [
      {
        family: "rules",
        objective: "Explain current Formula 1 scoring and its major changes",
        metrics: ["grand_prix_points", "sprint_points", "historical_changes"],
        presentations: ["narrative", "table"],
      },
    ],
    assumptions: [],
    unresolvedTerms: [],
  });
  const artifact = answerArtifactSchema.parse({
    version: 1,
    family: "rules",
    title: "How F1 scoring works",
    summary:
      "In a Grand Prix, the top 10 score **25–18–15–12–10–8–6–4–2–1**. A Sprint pays the top eight **8–7–6–5–4–3–2–1**. Drivers keep the points they score, while each team gets the combined points from both cars. The highest total at the end of the season wins—there are no playoffs.\n\nThe points system has changed several times, but it does not automatically change with new car or engine regulations. Scoring belongs to F1's sporting rules, so it can be revised on its own even when a major technical-rule change happens in the same season.",
    metrics: [],
    tables: [
      {
        id: "points-history",
        title: "The biggest scoring changes",
        columns: [
          { key: "era", label: "From" },
          { key: "change", label: "What changed" },
        ],
        rows: [
          { era: "1950", change: "Top five scored; a win was worth 8 points" },
          { era: "1960", change: "Points expanded to the top six" },
          {
            era: "1991",
            change:
              "Every result counted instead of only a driver's best results",
          },
          { era: "2003", change: "Points expanded to the top eight" },
          {
            era: "2010",
            change: "The current top-10 scale was introduced",
          },
          {
            era: "2019–2024",
            change: "A top-10 finisher could earn a fastest-lap bonus point",
          },
        ],
      },
    ],
    charts: [],
    evidence: [
      {
        id: evidenceId,
        kind: "knowledge_node",
        label: "Formula 1 championship points rules and history",
        source: node.id,
        fields: { tags: node.tags },
      },
    ],
    caveats: [],
  });

  return {
    plan,
    artifact,
    queries: [],
    model: "deterministic/rules-scoring-v1",
  };
}

export function tryRunRulesAnalysis(
  question: string,
): RulesAnalysisExecution | null {
  const asksAboutFastestLapPoint = /\bfastest[- ]lap point\b/i.test(question);
  if (!asksAboutFastestLapPoint && asksAboutChampionshipScoring(question)) {
    return buildScoringAnalysis(question);
  }
  if (!asksAboutFastestLapPoint) return null;
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
