import {
  type AnalysisPageContext,
  type AnalysisPlan,
  type AnswerArtifact,
  analysisPlanSchema,
  answerArtifactSchema,
} from "./analysis-contracts";
import { executeAIParamQuery } from "./db";
import { extractSeason, normalizeQuestionText } from "./question-parsing";

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
    sr.points
  FROM session_results sr
  JOIN drivers d ON d.id = sr.driver_id
  WHERE sr.session_id = $1
  ORDER BY sr.position NULLS LAST, d.full_name
`;

export interface ResultSessionCandidate {
  id: number;
  eventName: string;
  round: number;
  date: string;
}

export interface SessionClassificationRow {
  slug: string;
  driverName: string;
  position: number | null;
  status: string;
  gridPosition: number | null;
  points: number | null;
}

export interface SessionResultExecution {
  plan: AnalysisPlan;
  artifact: AnswerArtifact;
  queries: string[];
  model: string;
}

type ResultMode = "winner" | "podium" | "classification";
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

function resultMode(question: string): ResultMode {
  if (/\b(podium|top three|top 3)\b/i.test(question)) return "podium";
  if (/\b(who won|winner)\b/i.test(question)) return "winner";
  return "classification";
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
): ResultSessionCandidate | null {
  return pageContext?.sessionId
    ? (candidates.find((candidate) => candidate.id === pageContext.sessionId) ??
        null)
    : resolveResultSession(question, candidates);
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
  };
}

export function buildSessionResultExecution(params: {
  question: string;
  season: number;
  sessionType: "race" | "sprint_race";
  session: ResultSessionCandidate;
  rows: SessionClassificationRow[];
}): SessionResultExecution {
  const { question, season, sessionType, session } = params;
  const mode = resultMode(question);
  const classified = params.rows.filter((row) => row.position !== null);
  const visibleRows =
    mode === "winner"
      ? classified.slice(0, 1)
      : mode === "podium"
        ? classified.slice(0, 3)
        : params.rows;
  if (visibleRows.length === 0) throw new Error("No classification data found");

  const names = visibleRows.map((row) => row.driverName);
  const sessionLabel = sessionType === "sprint_race" ? "sprint" : "race";
  const summary =
    mode === "podium" && names.length === 3
      ? `${names[0]} won the ${season} ${session.eventName}, ahead of ${names[1]} and ${names[2]} on the podium.`
      : mode === "winner"
        ? `${names[0]} won the ${season} ${session.eventName}.`
        : `This is the canonical ${sessionLabel} classification for the ${season} ${session.eventName}.`;

  const evidenceId = `session-${session.id}-classification`;
  const plan = analysisPlanSchema.parse({
    version: 1,
    question,
    entities: [
      { kind: "event", id: session.id, name: session.eventName },
      { kind: "season", id: season, name: String(season) },
    ],
    scope: { season, rounds: [session.round], sessionTypes: [sessionType] },
    facets: [
      {
        family: "results",
        objective: `Return the ${mode}`,
        metrics: ["finishing_position", "status", "points"],
        presentations: ["narrative", "table"],
      },
    ],
    assumptions: [],
    unresolvedTerms: [],
  });
  const artifact = answerArtifactSchema.parse({
    version: 1,
    family: "results",
    title: `${season} ${session.eventName}${sessionType === "sprint_race" ? " sprint" : ""} result`,
    summary,
    metrics: visibleRows.map((row) => ({
      id: `position-${row.position ?? row.slug}`,
      label: row.position === 1 ? "Winner" : `Position ${row.position ?? "—"}`,
      value: row.position ?? row.status,
      displayValue: row.driverName,
      evidenceIds: [evidenceId],
    })),
    tables: [
      {
        id: "classification",
        title:
          mode === "classification" ? "Classification" : "Requested result",
        columns: [
          { key: "position", label: "Pos" },
          { key: "driver", label: "Driver" },
          { key: "grid", label: "Grid" },
          { key: "status", label: "Status" },
          { key: "points", label: "Points" },
        ],
        rows: visibleRows.map((row) => ({
          position: row.position ?? "—",
          driver: row.driverName,
          grid: row.gridPosition ?? "—",
          status: row.status,
          points: row.points ?? 0,
        })),
      },
    ],
    charts: [],
    evidence: [
      {
        id: evidenceId,
        kind: "database",
        label: "Canonical session classification",
        source: "sessions + session_results + drivers",
        fields: {
          sessionId: session.id,
          season,
          round: session.round,
          sessionType,
          rowCount: params.rows.length,
        },
      },
    ],
    caveats: [],
    actions: [
      {
        label: `Open ${session.eventName} results`,
        href: `/results/${season}/${session.round}${sessionType === "sprint_race" ? "?tab=sprint" : ""}`,
      },
    ],
  });

  return {
    plan,
    artifact,
    queries: [
      RESULT_SESSION_CANDIDATES_SQL.trim(),
      SESSION_CLASSIFICATION_SQL.trim(),
    ],
    model: "deterministic/session-results-v1",
  };
}

export async function tryRunSessionResultAnalysis(
  question: string,
  pageContext?: AnalysisPageContext,
): Promise<SessionResultExecution | null> {
  const season = extractSeason(question) ?? pageContext?.season ?? null;
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
  });
}
