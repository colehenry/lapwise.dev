import type { PageSurface } from "./analysis-contracts";

const SESSION_LABELS: Record<string, string> = {
  race: "race",
  sprint_race: "sprint",
  qualifying: "qualifying",
  sprint_qualifying: "sprint qualifying",
  fp1: "FP1",
  fp2: "FP2",
  fp3: "FP3",
};

/** The panel the reader is looking at, as one sentence the model can use. */
export function describeSurface(surface: PageSurface): string {
  const { digest } = surface;
  if (digest.kind === "session") {
    const label = SESSION_LABELS[digest.sessionType] ?? digest.sessionType;
    const facts = [
      digest.winner ? `winner ${digest.winner}` : null,
      digest.fastestLap ? `fastest lap ${digest.fastestLap}` : null,
      `${digest.classified} classified`,
    ].filter(Boolean);
    return `The reader is looking at "${surface.title}": the ${digest.season} round ${digest.round} ${label} (session id ${digest.sessionId}; ${facts.join(", ")}).`;
  }
  if (digest.kind === "career") {
    const title = digest.championships === 1 ? "title" : "titles";
    return `The reader is looking at "${surface.title}": the career of ${digest.entity} ${digest.slug} (${digest.seasons} seasons, ${digest.wins} wins, ${digest.championships} ${title}).`;
  }
  const facts = [
    digest.leader ? `leader ${digest.leader}` : null,
    digest.gap != null ? `gap ${digest.gap} points` : null,
    digest.roundsRun != null ? `${digest.roundsRun} rounds run` : null,
    digest.roundsLeft != null ? `${digest.roundsLeft} rounds left` : null,
  ].filter(Boolean);
  return `The reader is looking at "${surface.title}": the ${digest.season} ${digest.mode}' standings (${facts.join(", ")}).`;
}

/**
 * What the corner already answered on the page, so the model continues the
 * thread rather than restating it.
 */
export function describeAsked(surface: PageSurface): string {
  if (surface.asked.length === 0) return "";
  const lines = surface.asked.map(
    (turn) => `- Q: ${turn.question}\n  A: ${turn.answer}`,
  );
  return `Already answered on the page, from the same data — build on these, do not repeat them:\n${lines.join("\n")}`;
}
