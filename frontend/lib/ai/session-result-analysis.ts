import type { AnalysisPageContext } from "./analysis-contracts";
import { executeAIParamQuery } from "./db";
import { extractSeason, normalizeQuestionText } from "./question-parsing";
import {
  buildSessionResultExecution,
  type SessionClassificationRow,
  type SessionResultExecution,
} from "./session-result-artifact";

export const RESULT_SESSION_CANDIDATES_SQL = `
  SELECT id, event_name, round, date::text AS date
  FROM sessions
  WHERE year = $1 AND session_type = $2
  ORDER BY round
`;

export const SESSION_CLASSIFICATION_SQL = `
  SELECT
    d.slug,
    d.full_name,
    sr.position,
    sr.status,
    sr.grid_position,
    sr.points,
    sr.time_seconds,
    sr.fastest_lap,
    t.name AS team_name
  FROM session_results sr
  JOIN drivers d ON d.id = sr.driver_id
  JOIN teams t ON t.id = sr.team_id
  WHERE sr.session_id = $1
  ORDER BY sr.position NULLS LAST, d.full_name
`;

export interface ResultSessionCandidate {
  id: number;
  eventName: string;
  round: number;
  date: string;
}

export type ResultSessionType = "race" | "sprint_race";

function numberOrNull(value: unknown): number | null {
  const parsed = Number(value);
  return value !== null && value !== "" && Number.isFinite(parsed)
    ? parsed
    : null;
}

export function looksLikeSessionResultQuestion(question: string): boolean {
  return (
    /\b(who won|winner|podium|top three|top 3|results?|classification|finishing order)\b/i.test(
      question,
    ) && !/\b(standings|championship)\b/i.test(question)
  );
}

export function looksLikeLatestResultQuestion(question: string): boolean {
  return /\b(latest|most recent|last)\b.*\b(race|grand prix)\b/i.test(question);
}

export function resolveResultSession(
  question: string,
  candidates: ResultSessionCandidate[],
): ResultSessionCandidate | null {
  const normalizedQuestion = ` ${normalizeQuestionText(question)} `;
  const matches = candidates.filter((candidate) => {
    const fullName = normalizeQuestionText(candidate.eventName);
    const shortName = fullName.replace(/ grand prix$/, "");
    return (
      normalizedQuestion.includes(` ${fullName} `) ||
      (shortName.length >= 4 &&
        normalizedQuestion.includes(` ${shortName} `)) ||
      normalizedQuestion.includes(` round ${candidate.round} `)
    );
  });
  return matches.length === 1 ? matches[0] : null;
}

function parseSessionCandidate(
  row: Record<string, unknown>,
): ResultSessionCandidate | null {
  const id = Number(row.id);
  const round = Number(row.round);
  const eventName = String(row.event_name ?? "").trim();
  if (!Number.isInteger(id) || !Number.isInteger(round) || !eventName)
    return null;
  return { id, round, eventName, date: String(row.date ?? "") };
}

export async function loadResultSessionCandidates(
  season: number,
  sessionType: ResultSessionType,
): Promise<ResultSessionCandidate[]> {
  const rows = await executeAIParamQuery(RESULT_SESSION_CANDIDATES_SQL, [
    season,
    sessionType,
  ]);
  return rows
    .map(parseSessionCandidate)
    .filter((session): session is ResultSessionCandidate => session !== null);
}

export function selectResultSession(
  question: string,
  candidates: ResultSessionCandidate[],
  pageContext?: AnalysisPageContext,
  today = new Date().toISOString().slice(0, 10),
): ResultSessionCandidate | null {
  if (pageContext?.sessionId) {
    return (
      candidates.find((candidate) => candidate.id === pageContext.sessionId) ??
      null
    );
  }
  if (looksLikeLatestResultQuestion(question)) {
    return (
      candidates
        .filter((candidate) => candidate.date <= today)
        .sort((a, b) => b.date.localeCompare(a.date))[0] ?? null
    );
  }
  return resolveResultSession(question, candidates);
}

function parseClassification(
  row: Record<string, unknown>,
): SessionClassificationRow | null {
  const slug = String(row.slug ?? "").trim();
  const driverName = String(row.full_name ?? "").trim();
  if (!slug || !driverName) return null;
  return {
    slug,
    driverName,
    position: numberOrNull(row.position),
    status: String(row.status ?? "Unknown"),
    gridPosition: numberOrNull(row.grid_position),
    points: numberOrNull(row.points),
    timeSeconds: numberOrNull(row.time_seconds),
    fastestLap: row.fastest_lap === true,
    teamName: String(row.team_name ?? "").trim() || undefined,
  };
}

export async function tryRunSessionResultAnalysis(
  question: string,
  pageContext?: AnalysisPageContext,
): Promise<SessionResultExecution | null> {
  const season =
    extractSeason(question) ??
    pageContext?.season ??
    (looksLikeLatestResultQuestion(question)
      ? new Date().getUTCFullYear()
      : null);
  if (season === null || !looksLikeSessionResultQuestion(question)) return null;
  const contextualSessionType =
    pageContext?.sessionType === "race" ||
    pageContext?.sessionType === "sprint_race"
      ? pageContext.sessionType
      : null;
  const sessionType =
    contextualSessionType ??
    (/\bsprint\b/i.test(question) ? "sprint_race" : "race");
  const candidates = await loadResultSessionCandidates(season, sessionType);
  const session = selectResultSession(question, candidates, pageContext);
  if (!session) return null;

  const rows = await executeAIParamQuery(SESSION_CLASSIFICATION_SQL, [
    session.id,
  ]);
  const classification = rows
    .map(parseClassification)
    .filter((row): row is SessionClassificationRow => row !== null);
  return buildSessionResultExecution({
    question,
    season,
    sessionType,
    session,
    rows: classification,
    queries: [
      RESULT_SESSION_CANDIDATES_SQL.trim(),
      SESSION_CLASSIFICATION_SQL.trim(),
    ],
  });
}
