import {
  type AnalysisPageContext,
  analysisPageContextSchema,
} from "./analysis-contracts";

interface SearchParamsReader {
  get(name: string): string | null;
  getAll(name: string): string[];
}

function parseInteger(value: string | null): number | undefined {
  if (!value || !/^\d+$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
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
  if (!route) return undefined;

  const candidate = {
    route,
    season: parseInteger(searchParams.get("season")),
    round: parseInteger(searchParams.get("round")),
    sessionId: parseInteger(searchParams.get("sessionId")),
    sessionType: searchParams.get("sessionType") ?? undefined,
    driverSlugs: uniqueValues(searchParams.getAll("driver")),
    constructorSlugs: uniqueValues(searchParams.getAll("constructor")),
    activeFilters: parseFilters(searchParams.getAll("filter")),
  };
  const parsed = analysisPageContextSchema.safeParse(candidate);
  return parsed.success ? parsed.data : undefined;
}
