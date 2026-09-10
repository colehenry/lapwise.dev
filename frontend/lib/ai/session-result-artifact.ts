import {
  type AnalysisPlan,
  type AnswerArtifact,
  analysisPlanSchema,
  answerArtifactSchema,
} from "./analysis-contracts";

export interface SessionClassificationRow {
  slug: string;
  driverName: string;
  position: number | null;
  status: string;
  gridPosition: number | null;
  points: number | null;
  timeSeconds?: number | null;
  fastestLap?: boolean;
  teamName?: string;
}

export interface SessionResultExecution {
  plan: AnalysisPlan;
  artifact: AnswerArtifact;
  queries: string[];
  model: string;
}

type ResultMode = "winner" | "podium" | "classification";

function resultMode(question: string): ResultMode {
  if (/\b(podium|top three|top 3)\b/i.test(question)) return "podium";
  if (/\b(who won|winner)\b/i.test(question)) return "winner";
  return "classification";
}

function ordinal(value: number): string {
  const tens = value % 100;
  const suffix =
    tens >= 11 && tens <= 13
      ? "th"
      : value % 10 === 1
        ? "st"
        : value % 10 === 2
          ? "nd"
          : value % 10 === 3
            ? "rd"
            : "th";
  return `${value}${suffix}`;
}

function joinClauses(clauses: string[]): string {
  if (clauses.length < 2) return clauses[0] ?? "";
  if (clauses.length === 2) return clauses.join(" and ");
  return `${clauses.slice(0, -1).join(", ")}, and ${clauses.at(-1)}`;
}

function buildWinnerHighlight(
  winner: SessionClassificationRow,
  runnerUp?: SessionClassificationRow,
): string | null {
  const clauses: string[] = [];
  if (winner.gridPosition && winner.gridPosition > 1) {
    clauses.push(`started ${ordinal(winner.gridPosition)}`);
  }
  if (winner.fastestLap) clauses.push("set the fastest lap");
  if (
    runnerUp?.timeSeconds &&
    runnerUp.timeSeconds > 0 &&
    runnerUp.timeSeconds < 600
  ) {
    const teammate =
      winner.teamName && runnerUp.teamName === winner.teamName
        ? "teammate "
        : "";
    clauses.push(
      `finished ${runnerUp.timeSeconds.toFixed(3)} seconds ahead of ${teammate}[${runnerUp.driverName}](/drivers/${runnerUp.slug})`,
    );
  }
  if (winner.teamName && runnerUp?.teamName === winner.teamName) {
    clauses.push(`completed a ${winner.teamName} 1–2`);
  }
  if (clauses.length === 0) return null;
  const shortName = winner.driverName.split(" ").at(-1) ?? winner.driverName;
  return `${shortName} ${joinClauses(clauses)}.`;
}

export function buildSessionResultExecution(params: {
  question: string;
  season: number;
  sessionType: "race" | "sprint_race";
  session: { id: number; eventName: string; round: number };
  rows: SessionClassificationRow[];
  queries: string[];
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

  const linkedNames = visibleRows.map(
    (row) => `[${row.driverName}](/drivers/${row.slug})`,
  );
  const sessionLabel = sessionType === "sprint_race" ? "sprint" : "race";
  const resultHref = `/results/${season}/${session.round}${sessionType === "sprint_race" ? "?tab=sprint" : ""}`;
  const linkedEvent = `[${season} ${session.eventName}](${resultHref})`;
  const winner = visibleRows[0];
  const winnerHighlight = buildWinnerHighlight(winner, classified[1]);
  const summary =
    mode === "podium" && linkedNames.length === 3
      ? `${linkedNames[0]} won the ${linkedEvent}, ahead of ${linkedNames[1]} and ${linkedNames[2]} on the podium.`
      : mode === "winner"
        ? `${linkedNames[0]} won the ${linkedEvent}${winner.teamName ? ` for **${winner.teamName}**` : ""}.${winnerHighlight ? `\n\n${winnerHighlight}` : ""}`
        : `This is the ${sessionLabel} classification for the ${season} ${session.eventName}.`;

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
        presentations:
          mode === "winner" ? ["narrative"] : ["narrative", "table"],
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
    metrics:
      mode === "winner"
        ? []
        : visibleRows.map((row) => ({
            id: `position-${row.position ?? row.slug}`,
            label:
              row.position === 1 ? "Winner" : `Position ${row.position ?? "—"}`,
            value: row.position ?? row.status,
            displayValue: row.driverName,
            evidenceIds: [evidenceId],
          })),
    tables:
      mode === "winner"
        ? []
        : [
            {
              id: "classification",
              title:
                mode === "classification"
                  ? "Classification"
                  : "Requested result",
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
        label: "Session classification",
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
    actions:
      mode === "winner"
        ? []
        : [
            {
              label: `Open ${session.eventName} results`,
              href: resultHref,
            },
          ],
  });

  return {
    plan,
    artifact,
    queries: params.queries,
    model: "deterministic/session-results-v1",
  };
}
