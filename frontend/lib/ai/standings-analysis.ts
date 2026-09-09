import {
  type AnalysisPageContext,
  type AnalysisPlan,
  type AnswerArtifact,
  analysisPlanSchema,
  answerArtifactSchema,
} from "./analysis-contracts";
import { executeAIParamQuery } from "./db";
import { extractSeason, extractTopLimit } from "./question-parsing";

export const DRIVER_STANDINGS_SQL = `
  SELECT
    championship_position,
    driver_name AS entrant_name,
    driver_slug AS entrant_slug,
    team_name,
    points,
    points_scored,
    wins,
    podiums,
    classification_status,
    standings_source,
    explanation,
    explanation_source_url
  FROM v_driver_standings
  WHERE year = $1
  ORDER BY championship_position NULLS LAST, points_scored DESC
  LIMIT $2
`;

export const CONSTRUCTOR_STANDINGS_SQL = `
  SELECT
    championship_position,
    team_name AS entrant_name,
    constructor_slug AS entrant_slug,
    team_name,
    points,
    points_scored,
    wins,
    podiums,
    classification_status,
    standings_source,
    explanation,
    explanation_source_url
  FROM v_constructor_standings
  WHERE year = $1
  ORDER BY championship_position NULLS LAST, points_scored DESC
  LIMIT $2
`;

export type StandingsEntrantType = "driver" | "constructor";

export interface StandingsRow {
  championshipPosition: number | null;
  entrantName: string;
  entrantSlug: string;
  teamName: string | null;
  points: number | null;
  pointsScored: number;
  wins: number;
  podiums: number;
  classificationStatus: string;
  standingsSource: string;
  explanation: string | null;
  explanationSourceUrl: string | null;
}

export interface StandingsExecution {
  plan: AnalysisPlan;
  artifact: AnswerArtifact;
  queries: string[];
  model: string;
}

function numberOrNull(value: unknown): number | null {
  const parsed = Number(value);
  return value !== null && value !== "" && Number.isFinite(parsed)
    ? parsed
    : null;
}

function parseStandingsRow(row: Record<string, unknown>): StandingsRow | null {
  const entrantName = String(row.entrant_name ?? "").trim();
  const entrantSlug = String(row.entrant_slug ?? "").trim();
  if (!entrantName || !entrantSlug) return null;
  return {
    championshipPosition: numberOrNull(row.championship_position),
    entrantName,
    entrantSlug,
    teamName: typeof row.team_name === "string" ? row.team_name : null,
    points: numberOrNull(row.points),
    pointsScored: numberOrNull(row.points_scored) ?? 0,
    wins: numberOrNull(row.wins) ?? 0,
    podiums: numberOrNull(row.podiums) ?? 0,
    classificationStatus: String(row.classification_status ?? "unknown"),
    standingsSource: String(row.standings_source ?? "unknown"),
    explanation: typeof row.explanation === "string" ? row.explanation : null,
    explanationSourceUrl:
      typeof row.explanation_source_url === "string"
        ? row.explanation_source_url
        : null,
  };
}

export function looksLikeStandingsQuestion(question: string): boolean {
  return /\b(standings|championship|champion)\b/i.test(question);
}

export function standingsEntrantType(question: string): StandingsEntrantType {
  return /\b(constructor|constructors|team|teams)\b/i.test(question)
    ? "constructor"
    : "driver";
}

export function buildStandingsExecution(params: {
  question: string;
  season: number;
  entrantType: StandingsEntrantType;
  limit: number;
  rows: StandingsRow[];
  query: string;
}): StandingsExecution {
  const { question, season, entrantType, limit, rows, query } = params;
  if (rows.length === 0) throw new Error("No standings data found");

  const rankedRows = rows.filter(
    (row) => row.championshipPosition !== null && row.points !== null,
  );
  const source = rows[0].standingsSource;
  const label = entrantType === "driver" ? "Drivers" : "Constructors";
  const summary =
    rankedRows.length === 0
      ? `Canonical ${season} ${label.toLowerCase()} standings are unavailable. The on-track points shown below are not an official championship classification.`
      : limit === 1
        ? `${rankedRows[0].entrantName} was first in the ${season} ${label}' Championship with ${rankedRows[0].points} points.`
        : `${rankedRows[0].entrantName} led the ${season} ${label}' Championship with ${rankedRows[0].points} points. The requested top ${Math.min(limit, rankedRows.length)} is shown below.`;
  const evidenceId = `${entrantType}-standings-${season}`;
  const plan = analysisPlanSchema.parse({
    version: 1,
    question,
    entities: [{ kind: "season", id: season, name: String(season) }],
    scope: { season },
    facets: [
      {
        family: "standings",
        objective: `Return the top ${limit} ${entrantType} standings`,
        metrics: ["championship_position", "championship_points"],
        presentations: ["narrative", "table", "chart"],
      },
    ],
    assumptions: [],
    unresolvedTerms: [],
  });
  const displayRows = rankedRows.length > 0 ? rankedRows : rows;
  const caveats = new Set<string>();
  if (source === "computed_provisional") {
    caveats.add(
      "These standings are provisional and calculated from ingested results.",
    );
  }
  if (rankedRows.length === 0) {
    caveats.add(
      "No official classification snapshot is available, so no champion or ranking is inferred from summed points.",
    );
  }
  for (const row of rows) {
    if (row.explanation) caveats.add(row.explanation);
  }

  const artifact = answerArtifactSchema.parse({
    version: 1,
    family: "standings",
    title: `${season} ${label}' Championship standings`,
    summary,
    metrics: rankedRows.map((row) => ({
      id: `${entrantType}-${row.entrantSlug}`,
      label: `P${row.championshipPosition} ${row.entrantName}`,
      value: row.points as number,
      displayValue: `${row.points} points`,
      evidenceIds: [evidenceId],
    })),
    tables: [
      {
        id: "standings",
        title: source === "official" ? "Official classification" : "Standings",
        columns: [
          { key: "position", label: "Pos" },
          {
            key: "entrant",
            label: entrantType === "driver" ? "Driver" : "Constructor",
          },
          ...(entrantType === "driver" ? [{ key: "team", label: "Team" }] : []),
          {
            key: "points",
            label: rankedRows.length > 0 ? "Points" : "Points scored",
          },
          { key: "wins", label: "Wins" },
          { key: "status", label: "Status" },
        ],
        rows: displayRows.map((row) => ({
          position: row.championshipPosition ?? "—",
          entrant: row.entrantName,
          team: row.teamName ?? "—",
          points: row.points ?? row.pointsScored,
          wins: row.wins,
          status: row.classificationStatus,
        })),
      },
    ],
    charts:
      rankedRows.length > 1
        ? [
            {
              id: "standings-points",
              chartType: "bar",
              title: `${season} championship points`,
              xLabel: label.slice(0, -1),
              yLabel: "Points",
              data: rankedRows.map((row) => ({
                entrant: row.entrantName,
                points: row.points,
              })),
              xKey: "entrant",
              yKeys: ["points"],
              seriesLabels: ["Championship points"],
              colors: [],
            },
          ]
        : [],
    evidence: [
      {
        id: evidenceId,
        kind: "database",
        label: `${source} championship classification`,
        source:
          entrantType === "driver"
            ? "v_driver_standings"
            : "v_constructor_standings",
        fields: { season, source, rowCount: rows.length },
      },
    ],
    caveats: [...caveats],
    actions: [
      {
        label: `Open ${season} season results`,
        href: `/results/${season}`,
      },
    ],
  });

  return {
    plan,
    artifact,
    queries: [query.trim()],
    model: `deterministic/${entrantType}-standings-v1`,
  };
}

export async function tryRunStandingsAnalysis(
  question: string,
  pageContext?: AnalysisPageContext,
): Promise<StandingsExecution | null> {
  const season = extractSeason(question) ?? pageContext?.season ?? null;
  if (season === null || !looksLikeStandingsQuestion(question)) return null;
  const entrantType = standingsEntrantType(question);
  const championOnly = /\b(who won|champion)\b/i.test(question);
  const limit = extractTopLimit(question, championOnly ? 1 : 10, 20);
  const query =
    entrantType === "driver" ? DRIVER_STANDINGS_SQL : CONSTRUCTOR_STANDINGS_SQL;
  const result = await executeAIParamQuery(query, [season, limit]);
  const rows = result
    .map(parseStandingsRow)
    .filter((row): row is StandingsRow => row !== null);
  return buildStandingsExecution({
    question,
    season,
    entrantType,
    limit,
    rows,
    query,
  });
}
