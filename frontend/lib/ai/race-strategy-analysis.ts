import {
  type AnalysisPageContext,
  type AnalysisPlan,
  type AnswerArtifact,
  analysisPlanSchema,
} from "./analysis-contracts";
import { extractSeason, normalizeQuestionText } from "./question-parsing";
import {
  loadRaceStrategyEvidence,
  RACE_STRATEGY_LAPS_SQL,
} from "./race-strategy";
import {
  doubleStackArtifact,
  type RaceStrategyIntent,
  safeStopArtifact,
  undercutFailureArtifact,
} from "./race-strategy-artifact";
import type { RaceStrategyEvidence } from "./race-strategy-calculation";
import {
  loadResultSessionCandidates,
  RESULT_SESSION_CANDIDATES_SQL,
  type ResultSessionCandidate,
  type ResultSessionType,
  selectResultSession,
} from "./session-result-analysis";

export interface RaceStrategyExecution {
  plan: AnalysisPlan;
  artifact: AnswerArtifact;
  queries: string[];
  model: string;
}

export function raceStrategyIntent(
  question: string,
): RaceStrategyIntent | null {
  if (/\bdouble[- ]stack(?:ed|ing)?\b/i.test(question)) return "double_stack";
  if (
    /\b(?:free|safe) stop\b/i.test(question) ||
    /\bpit\b.*\b(?:keep|retain|lose|hold)\b.*\b(?:position|place|p\d+)\b/i.test(
      question,
    )
  ) {
    return "safe_stop";
  }
  if (
    /\bundercut\b/i.test(question) &&
    /\b(?:why|fail(?:ed)?|didn'?t|did not|not work)\b/i.test(question)
  ) {
    return "undercut_failure";
  }
  return null;
}

export function looksLikeRaceStrategyInsight(question: string): boolean {
  return raceStrategyIntent(question) !== null;
}

function mentionsEntity(
  question: string,
  name: string | null,
  code?: string | null,
): boolean {
  const normalized = ` ${normalizeQuestionText(question)} `;
  const fullName = name ? normalizeQuestionText(name) : "";
  const surname = fullName.split(" ").at(-1) ?? "";
  const normalizedCode = code ? normalizeQuestionText(code) : "";
  return [fullName, surname.length >= 4 ? surname : "", normalizedCode].some(
    (candidate) => candidate && normalized.includes(` ${candidate} `),
  );
}

function selectArtifact(params: {
  question: string;
  intent: RaceStrategyIntent;
  season: number;
  sessionType: ResultSessionType;
  session: ResultSessionCandidate;
  evidence: RaceStrategyEvidence;
}): AnswerArtifact {
  const { question, intent, season, sessionType, session, evidence } = params;
  const context = {
    season,
    round: session.round,
    eventName: session.eventName,
    sessionType,
  };
  if (intent === "undercut_failure") {
    const salient = evidence.undercutFailures.filter(
      (failure) =>
        Math.max(
          Math.abs(failure.gapChangeSeconds),
          Math.abs(failure.transitDeltaSeconds),
          Math.abs(failure.newTyreGainSeconds),
        ) >= 1.5,
    );
    const mentioned = salient.find(
      (failure) =>
        mentionsEntity(
          question,
          failure.attacker.driverName,
          failure.attacker.driverCode,
        ) ||
        mentionsEntity(
          question,
          failure.target.driverName,
          failure.target.driverCode,
        ),
    );
    const hasExplicitDriver = evidence.pitStops.some((stop) =>
      mentionsEntity(question, stop.driverName, stop.driverCode),
    );
    return undercutFailureArtifact(
      context,
      evidence,
      mentioned ?? (hasExplicitDriver ? null : (salient[0] ?? null)),
    );
  }
  if (intent === "safe_stop") {
    const mentioned = evidence.safeStopCases.find((stop) =>
      mentionsEntity(question, stop.driverName, stop.driverCode),
    );
    const hasExplicitDriver = evidence.pitStops.some((stop) =>
      mentionsEntity(question, stop.driverName, stop.driverCode),
    );
    return safeStopArtifact(
      context,
      evidence,
      mentioned ??
        (hasExplicitDriver ? null : (evidence.safeStopCases[0] ?? null)),
    );
  }
  const costly = evidence.doubleStacks.filter(
    (stack) => stack.secondTransitTaxSeconds >= 2,
  );
  const mentioned = costly.find(
    (stack) =>
      mentionsEntity(question, stack.teamName) ||
      mentionsEntity(
        question,
        stack.first.driverName,
        stack.first.driverCode,
      ) ||
      mentionsEntity(
        question,
        stack.second.driverName,
        stack.second.driverCode,
      ),
  );
  const hasExplicitEntity = evidence.pitStops.some(
    (stop) =>
      mentionsEntity(question, stop.teamName) ||
      mentionsEntity(question, stop.driverName, stop.driverCode),
  );
  return doubleStackArtifact(
    context,
    evidence,
    mentioned ?? (hasExplicitEntity ? null : (costly[0] ?? null)),
  );
}

function buildPlan(params: {
  question: string;
  intent: RaceStrategyIntent;
  season: number;
  sessionType: ResultSessionType;
  session: ResultSessionCandidate;
}): AnalysisPlan {
  const metrics: Record<RaceStrategyIntent, string[]> = {
    undercut_failure: [
      "gap_before",
      "gap_after",
      "new_tyre_gain",
      "pit_lane_transit_delta",
    ],
    safe_stop: ["gap_behind", "modeled_stop_loss", "position_buffer"],
    double_stack: ["arrival_gap", "second_car_pit_lane_transit_delta"],
  };
  return analysisPlanSchema.parse({
    version: 1,
    question: params.question,
    entities: [
      { kind: "event", id: params.session.id, name: params.session.eventName },
      { kind: "season", id: params.season, name: String(params.season) },
    ],
    scope: {
      season: params.season,
      rounds: [params.session.round],
      sessionTypes: [params.sessionType],
    },
    facets: [
      {
        family: "strategy",
        objective: "Explain the observed pit-window decision and its limits",
        metrics: metrics[params.intent],
        presentations: ["narrative", "metric_cards", "table"],
      },
    ],
    assumptions: [
      "Pit duration is entry-to-exit pit-lane transit.",
      "Modeled estimates are withheld when coverage or fit-quality gates fail.",
    ],
    unresolvedTerms: [],
  });
}

export async function tryRunRaceStrategyInsight(
  question: string,
  pageContext?: AnalysisPageContext,
): Promise<RaceStrategyExecution | null> {
  const intent = raceStrategyIntent(question);
  const season = extractSeason(question) ?? pageContext?.season ?? null;
  if (!intent || season === null) return null;
  const sessionType: ResultSessionType =
    pageContext?.sessionType === "sprint_race" || /\bsprint\b/i.test(question)
      ? "sprint_race"
      : "race";
  const candidates = await loadResultSessionCandidates(season, sessionType);
  const session = selectResultSession(question, candidates, pageContext);
  if (!session) return null;
  const evidence = await loadRaceStrategyEvidence(session.id);
  return {
    plan: buildPlan({ question, intent, season, sessionType, session }),
    artifact: selectArtifact({
      question,
      intent,
      season,
      sessionType,
      session,
      evidence,
    }),
    queries: [
      RESULT_SESSION_CANDIDATES_SQL.trim(),
      RACE_STRATEGY_LAPS_SQL.trim(),
    ],
    model: `deterministic/strategy-${intent}-v1`,
  };
}
