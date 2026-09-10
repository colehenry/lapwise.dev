import type { AnalysisPageContext } from "./analysis-contracts";

interface SearchParamsReader {
  get(name: string): string | null;
  getAll(name: string): string[];
}

/* The server revalidates this context against analysisPageContextSchema, so
   the browser bundle checks the same bounds by hand rather than shipping zod
   to every visitor of /ask. */
const SESSION_TYPES = [
  "race",
  "sprint_race",
  "qualifying",
  "sprint_qualifying",
] as const;

type SessionType = (typeof SESSION_TYPES)[number];

function parseInteger(value: string | null): number | undefined {
  if (!value || !/^\d+$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

function inRange(value: number | undefined, min: number, max: number): boolean {
  return value === undefined || (value >= min && value <= max);
}

function uniqueValues(values: string[]): string[] | undefined {
  const unique = [
    ...new Set(values.map((value) => value.trim()).filter(Boolean)),
  ];
  return unique.length > 0 ? unique.slice(0, 4) : undefined;
}

function parseFilters(
  values: string[],
): Record<string, string | number | boolean> | undefined {
  const filters: Record<string, string | number | boolean> = {};
  for (const value of values.slice(0, 8)) {
    const separator = value.indexOf("=");
    if (separator < 1) continue;
    const key = value.slice(0, separator).trim();
    const raw = value.slice(separator + 1).trim();
    if (!key || !raw || key.length > 60 || raw.length > 200) continue;
    filters[key] =
      raw === "true"
        ? true
        : raw === "false"
          ? false
          : /^\d+$/.test(raw)
            ? Number(raw)
            : raw;
  }
  return Object.keys(filters).length > 0 ? filters : undefined;
}

export function pageContextFromSearchParams(
  searchParams: SearchParamsReader,
): AnalysisPageContext | undefined {
  const route = searchParams.get("from");
  if (!route || !route.startsWith("/") || route.length > 300) return undefined;

  const season = parseInteger(searchParams.get("season"));
  const round = parseInteger(searchParams.get("round"));
  const sessionId = parseInteger(searchParams.get("sessionId"));
  if (
    !inRange(season, 1950, 2100) ||
    !inRange(round, 1, 40) ||
    !inRange(sessionId, 1, Number.MAX_SAFE_INTEGER)
  ) {
    return undefined;
  }

  const rawSessionType = searchParams.get("sessionType");
  if (
    rawSessionType &&
    !SESSION_TYPES.includes(rawSessionType as SessionType)
  ) {
    return undefined;
  }

  const driverSlugs = uniqueValues(searchParams.getAll("driver"));
  const constructorSlugs = uniqueValues(searchParams.getAll("constructor"));
  const tooLong = (slugs: string[] | undefined) =>
    slugs?.some((slug) => slug.length > 100) ?? false;
  if (tooLong(driverSlugs) || tooLong(constructorSlugs)) return undefined;

  return {
    route,
    season,
    round,
    sessionId,
    sessionType: (rawSessionType as SessionType | null) ?? undefined,
    driverSlugs,
    constructorSlugs,
    activeFilters: parseFilters(searchParams.getAll("filter")),
  };
}
