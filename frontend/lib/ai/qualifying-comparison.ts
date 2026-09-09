import { executeAIParamQuery } from "./db";

export const QUALIFYING_COMPARISON_SQL = `
  SELECT
    s.round,
    s.event_name,
    s.date::text AS date,
    d.slug,
    d.full_name,
    sr.position,
    sr.q1_time_seconds,
    sr.q2_time_seconds,
    sr.q3_time_seconds
  FROM sessions s
  JOIN session_results sr ON sr.session_id = s.id
  JOIN drivers d ON d.id = sr.driver_id
  WHERE s.year = $1
    AND s.session_type = 'qualifying'
    AND d.slug = ANY($2::text[])
  ORDER BY s.round, d.slug
`;

export interface QualifyingResultRow {
  round: number;
  event_name: string;
  date: string;
  slug: string;
  full_name: string;
  position: number | null;
  q1_time_seconds: number | null;
  q2_time_seconds: number | null;
  q3_time_seconds: number | null;
}

export interface QualifyingDriverSummary {
  slug: string;
  name: string;
  headToHeadWins: number;
  poles: number;
  q3Appearances: number;
  fasterQ3Appearances: number;
}

export interface QualifyingRoundComparison {
  round: number;
  event: string;
  date: string;
  firstPosition: number | null;
  secondPosition: number | null;
  secondMinusFirstQ3Seconds: number | null;
}

export interface QualifyingComparison {
  season: number;
  drivers: [QualifyingDriverSummary, QualifyingDriverSummary];
  qualifyingRounds: number;
  comparedRounds: number;
  tiedRounds: number;
  mutualQ3Rounds: number;
  medianSecondMinusFirstQ3Seconds: number | null;
  rounds: QualifyingRoundComparison[];
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseRow(row: Record<string, unknown>): QualifyingResultRow {
  return {
    round: asNumber(row.round) ?? 0,
    event_name: String(row.event_name ?? "Unknown event"),
    date: String(row.date ?? ""),
    slug: String(row.slug ?? ""),
    full_name: String(row.full_name ?? row.slug ?? "Unknown driver"),
    position: asNumber(row.position),
    q1_time_seconds: asNumber(row.q1_time_seconds),
    q2_time_seconds: asNumber(row.q2_time_seconds),
    q3_time_seconds: asNumber(row.q3_time_seconds),
  };
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

export function calculateQualifyingComparison(
  season: number,
  driverSlugs: [string, string],
  rows: QualifyingResultRow[],
): QualifyingComparison {
  const [firstSlug, secondSlug] = driverSlugs;
  if (firstSlug === secondSlug) {
    throw new Error("Qualifying comparison requires two different drivers");
  }

  const firstRows = rows.filter((row) => row.slug === firstSlug);
  const secondRows = rows.filter((row) => row.slug === secondSlug);
  if (firstRows.length === 0 || secondRows.length === 0) {
    throw new Error("No qualifying data found for one or both drivers");
  }

  const secondByRound = new Map(secondRows.map((row) => [row.round, row]));
  let firstWins = 0;
  let secondWins = 0;
  let ties = 0;
  let firstFasterQ3 = 0;
  let secondFasterQ3 = 0;
  const gaps: number[] = [];
  const roundComparisons: QualifyingRoundComparison[] = [];

  for (const first of firstRows) {
    const second = secondByRound.get(first.round);
    if (!second) continue;

    if (first.position !== null && second.position !== null) {
      if (first.position < second.position) firstWins += 1;
      else if (second.position < first.position) secondWins += 1;
      else ties += 1;
    }

    let gap: number | null = null;
    if (first.q3_time_seconds !== null && second.q3_time_seconds !== null) {
      gap = Number((second.q3_time_seconds - first.q3_time_seconds).toFixed(6));
      gaps.push(gap);
      if (gap > 0) firstFasterQ3 += 1;
      else if (gap < 0) secondFasterQ3 += 1;
    }

    roundComparisons.push({
      round: first.round,
      event: first.event_name,
      date: first.date,
      firstPosition: first.position,
      secondPosition: second.position,
      secondMinusFirstQ3Seconds: gap,
    });
  }

  const driverSummary = (
    slug: string,
    driverRows: QualifyingResultRow[],
    headToHeadWins: number,
    fasterQ3Appearances: number,
  ): QualifyingDriverSummary => ({
    slug,
    name: driverRows[0].full_name,
    headToHeadWins,
    poles: driverRows.filter((row) => row.position === 1).length,
    q3Appearances: driverRows.filter((row) => row.q3_time_seconds !== null)
      .length,
    fasterQ3Appearances,
  });

  return {
    season,
    drivers: [
      driverSummary(firstSlug, firstRows, firstWins, firstFasterQ3),
      driverSummary(secondSlug, secondRows, secondWins, secondFasterQ3),
    ],
    qualifyingRounds: new Set(rows.map((row) => row.round)).size,
    comparedRounds: firstWins + secondWins + ties,
    tiedRounds: ties,
    mutualQ3Rounds: gaps.length,
    medianSecondMinusFirstQ3Seconds: median(gaps),
    rounds: roundComparisons.sort((a, b) => a.round - b.round),
  };
}

export async function loadQualifyingComparison(
  season: number,
  driverSlugs: [string, string],
): Promise<QualifyingComparison> {
  const rows = await executeAIParamQuery(QUALIFYING_COMPARISON_SQL, [
    season,
    driverSlugs,
  ]);
  return calculateQualifyingComparison(season, driverSlugs, rows.map(parseRow));
}
