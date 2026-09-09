import { executeAIParamQuery } from "./db";
import { normalizeQuestionText } from "./question-parsing";

export const SEASON_DRIVER_CANDIDATES_SQL = `
  SELECT DISTINCT
    d.id,
    d.slug,
    d.full_name,
    d.jolpica_id,
    d.full_name AS display_name,
    d.driver_code
  FROM sessions s
  JOIN session_results sr ON sr.session_id = s.id
  JOIN drivers d ON d.id = sr.driver_id
  WHERE s.year = $1
    AND s.session_type = 'qualifying'
  ORDER BY d.full_name
`;

export interface DriverCandidate {
  id: number;
  slug: string;
  fullName: string;
  displayName: string | null;
  driverCode: string | null;
  externalId: string | null;
}

export interface ResolvedDriver extends DriverCandidate {
  matchedAlias: string;
  mentionIndex: number;
}

function parseCandidate(row: Record<string, unknown>): DriverCandidate | null {
  const id = Number(row.id);
  const slug = String(row.slug ?? "").trim();
  const fullName = String(row.full_name ?? "").trim();
  if (!Number.isInteger(id) || !slug || !fullName) return null;

  return {
    id,
    slug,
    fullName,
    displayName: typeof row.display_name === "string" ? row.display_name : null,
    driverCode: typeof row.driver_code === "string" ? row.driver_code : null,
    externalId: typeof row.jolpica_id === "string" ? row.jolpica_id : null,
  };
}

function candidateAliases(candidate: DriverCandidate): string[] {
  const nameParts = normalizeQuestionText(candidate.fullName).split(" ");
  const lastName = nameParts.at(-1) ?? "";
  return [
    candidate.fullName,
    candidate.displayName,
    candidate.slug,
    candidate.externalId,
    lastName.length >= 4 ? lastName : null,
    candidate.driverCode,
  ]
    .filter((alias): alias is string => Boolean(alias))
    .map(normalizeQuestionText)
    .filter(
      (alias, index, aliases) => alias && aliases.indexOf(alias) === index,
    )
    .sort((a, b) => b.length - a.length);
}

export function resolveDriversInQuestion(
  question: string,
  candidates: DriverCandidate[],
): ResolvedDriver[] {
  const normalizedQuestion = ` ${normalizeQuestionText(question)} `;
  const matches: ResolvedDriver[] = [];

  for (const candidate of candidates) {
    const alias = candidateAliases(candidate).find((value) =>
      normalizedQuestion.includes(` ${value} `),
    );
    if (!alias) continue;

    matches.push({
      ...candidate,
      matchedAlias: alias,
      mentionIndex: normalizedQuestion.indexOf(` ${alias} `),
    });
  }

  return matches.sort((a, b) => a.mentionIndex - b.mentionIndex);
}

export async function loadSeasonDriverCandidates(
  season: number,
): Promise<DriverCandidate[]> {
  const rows = await executeAIParamQuery(SEASON_DRIVER_CANDIDATES_SQL, [
    season,
  ]);
  return rows
    .map(parseCandidate)
    .filter((candidate): candidate is DriverCandidate => candidate !== null);
}
