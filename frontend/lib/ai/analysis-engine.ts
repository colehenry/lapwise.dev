import type { ChartConfig } from "../chat";
import {
  type AnalysisPageContext,
  type AnalysisPlan,
  type AnswerArtifact,
  analysisPlanSchema,
} from "./analysis-contracts";
import { renderArtifactMarkdown } from "./artifact-markdown";
import {
  type DriverCandidate,
  loadSeasonDriverCandidates,
  resolveDriversInQuestion,
} from "./driver-resolution";
import { buildQualifyingArtifact } from "./qualifying-artifact";
import {
  loadQualifyingComparison,
  QUALIFYING_COMPARISON_SQL,
} from "./qualifying-comparison";
import { extractSeason } from "./question-parsing";
import { tryRunRaceAnalysis } from "./race-analysis";
import { tryRunRaceStrategyInsight } from "./race-strategy-analysis";
import { tryRunRulesAnalysis } from "./rules-analysis";
import { tryRunSessionResultAnalysis } from "./session-result-analysis";
import { tryRunStandingsAnalysis } from "./standings-analysis";
import { tryRunWeatherAnalysis } from "./weather-analysis";

export interface DeterministicAnalysisResult {
  plan: AnalysisPlan;
  markdown: string;
  charts: ChartConfig[];
  queries: string[];
  model: string;
}

interface ArtifactExecution {
  plan: AnalysisPlan;
  artifact: AnswerArtifact;
  queries: string[];
  model: string;
}

function finalizeExecution(
  execution: ArtifactExecution,
): DeterministicAnalysisResult {
  return {
    plan: execution.plan,
    markdown: renderArtifactMarkdown(execution.artifact),
    charts: execution.artifact.charts.map(({ id: _id, ...chart }) => chart),
    queries: execution.queries,
    model: execution.model,
  };
}

export function looksLikeQualifyingComparison(question: string): boolean {
  return (
    /\b(quali(?:fying)?|q[123]|pole positions?)\b/i.test(question) &&
    /\b(compare|comparison|versus|vs\.?|head[- ]to[- ]head|between)\b/i.test(
      question,
    )
  );
}

export function createQualifyingComparisonPlan(
  question: string,
  candidates: DriverCandidate[],
  pageContext?: AnalysisPageContext,
): AnalysisPlan | null {
  const season = extractSeason(question) ?? pageContext?.season ?? null;
  if (season === null || !looksLikeQualifyingComparison(question)) return null;

  const mentionedDrivers = resolveDriversInQuestion(question, candidates);
  const contextualDrivers = (pageContext?.driverSlugs ?? [])
    .map((slug) => candidates.find((candidate) => candidate.slug === slug))
    .filter((driver): driver is DriverCandidate => driver !== undefined);
  const drivers =
    mentionedDrivers.length === 2 ? mentionedDrivers : contextualDrivers;
  if (drivers.length !== 2) return null;

  return analysisPlanSchema.parse({
    version: 1,
    question,
    entities: [
      ...drivers.map((driver) => ({
        kind: "driver" as const,
        id: driver.id,
        name: driver.fullName,
        slug: driver.slug,
      })),
      { kind: "season" as const, id: season, name: String(season) },
    ],
    scope: { season, sessionTypes: ["qualifying"] },
    facets: [
      {
        family: "qualifying_comparison",
        objective: "Compare qualifying performance across the season",
        metrics: ["head_to_head", "poles", "mutual_q3", "median_q3_gap"],
        presentations: ["narrative", "metric_cards", "table", "chart"],
      },
    ],
    assumptions: [
      "Head-to-head uses final qualifying classification in each shared round.",
      "Q3 gap uses only rounds where both drivers recorded a Q3 time.",
    ],
    unresolvedTerms: [],
  });
}

async function tryRunQualifyingComparison(
  question: string,
  pageContext?: AnalysisPageContext,
): Promise<DeterministicAnalysisResult | null> {
  const season = extractSeason(question) ?? pageContext?.season ?? null;
  if (season === null || !looksLikeQualifyingComparison(question)) return null;

  const candidates = await loadSeasonDriverCandidates(season);
  const plan = createQualifyingComparisonPlan(
    question,
    candidates,
    pageContext,
  );
  if (!plan) return null;

  const drivers = plan.entities.filter(
    (entity) => entity.kind === "driver" && entity.slug,
  );
  if (drivers.length !== 2) return null;

  const comparison = await loadQualifyingComparison(season, [
    drivers[0].slug as string,
    drivers[1].slug as string,
  ]);
  const artifact = buildQualifyingArtifact(comparison);
  return finalizeExecution({
    plan,
    artifact,
    queries: [QUALIFYING_COMPARISON_SQL.trim()],
    model: "deterministic/qualifying-comparison-v1",
  });
}

export async function tryRunDeterministicAnalysis(
  question: string,
  pageContext?: AnalysisPageContext,
): Promise<DeterministicAnalysisResult | null> {
  const rules = tryRunRulesAnalysis(question);
  if (rules) return finalizeExecution(rules);

  const qualifying = await tryRunQualifyingComparison(question, pageContext);
  if (qualifying) return qualifying;

  const standings = await tryRunStandingsAnalysis(question, pageContext);
  if (standings) return finalizeExecution(standings);

  const weather = await tryRunWeatherAnalysis(question, pageContext);
  if (weather) return finalizeExecution(weather);

  const strategy = await tryRunRaceStrategyInsight(question, pageContext);
  if (strategy) return finalizeExecution(strategy);

  const race = await tryRunRaceAnalysis(question, pageContext);
  if (race) return finalizeExecution(race);

  const result = await tryRunSessionResultAnalysis(question, pageContext);
  return result ? finalizeExecution(result) : null;
}
