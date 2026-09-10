import type { AnalysisPageContext } from "./analysis-contracts";

export function buildClutchHref(
  question: string,
  context: AnalysisPageContext,
): string {
  const params = new URLSearchParams({ q: question, from: context.route });
  if (context.season) params.set("season", String(context.season));
  if (context.round) params.set("round", String(context.round));
  if (context.sessionId) params.set("sessionId", String(context.sessionId));
  if (context.sessionType) params.set("sessionType", context.sessionType);
  for (const slug of context.driverSlugs ?? []) params.append("driver", slug);
  for (const slug of context.constructorSlugs ?? []) {
    params.append("constructor", slug);
  }
  for (const [key, value] of Object.entries(context.activeFilters ?? {})) {
    params.append("filter", `${key}=${String(value)}`);
  }
  return `/ask?${params.toString()}`;
}
