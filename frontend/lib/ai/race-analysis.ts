import {
  type AnalysisPageContext,
  type AnalysisPlan,
  type AnswerArtifact,
  analysisPlanSchema,
  answerArtifactSchema,
} from "./analysis-contracts";
import { extractSeason } from "./question-parsing";
import {
  loadRaceDynamics,
  RACE_CONTROL_SQL,
  RACE_LAPS_SQL,
  RACE_RESULTS_SQL,
} from "./race-dynamics";
import type { RaceDynamicsEvidence } from "./race-dynamics-calculation";
import {
  loadResultSessionCandidates,
  type ResultSessionCandidate,
  type ResultSessionType,
  selectResultSession,
} from "./session-result-analysis";

export interface RaceAnalysisExecution {
  plan: AnalysisPlan;
  artifact: AnswerArtifact;
  queries: string[];
  model: string;
}

export function looksLikeRaceAnalysis(question: string): boolean {
  return /\b(how did|what decided|turning points?|winning strategy|strategy|pit stops?|stints?|tyres?|tires?|undercut|overcut|dominan(?:t|ce)|controlled|lucky|recovered|regained|led)\b/i.test(
    question,
  );
}

function analysisFamily(question: string): "strategy" | "race_narrative" {
  return /\b(strategy|pit stops?|stints?|tyres?|tires?|undercut|overcut)\b/i.test(
    question,
  )
    ? "strategy"
    : "race_narrative";
}

function numberOrNull(value: unknown): number | null {
  const parsed = Number(value);
  return value !== null && value !== "" && Number.isFinite(parsed)
    ? parsed
    : null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function neutralizationSummary(evidence: RaceDynamicsEvidence): string {
  const parts = [
    evidence.neutralizedLaps.safetyCar.length > 0
      ? `Safety Car ${evidence.neutralizedLaps.safetyCar.join(", ")}`
      : null,
    evidence.neutralizedLaps.virtualSafetyCar.length > 0
      ? `VSC ${evidence.neutralizedLaps.virtualSafetyCar.join(", ")}`
      : null,
    evidence.neutralizedLaps.redFlag.length > 0
      ? `red flag ${evidence.neutralizedLaps.redFlag.join(", ")}`
      : null,
  ].filter((part): part is string => part !== null);
  return parts.length > 0
    ? parts.join("; ")
    : "No neutralized laps appear in the available lap-status records";
}

export function buildRaceAnalysisExecution(params: {
  question: string;
  season: number;
  sessionType: ResultSessionType;
  session: ResultSessionCandidate;
  evidence: RaceDynamicsEvidence;
}): RaceAnalysisExecution {
  const { question, season, sessionType, session, evidence } = params;
  const family = analysisFamily(question);
  const winnerRow = evidence.finalResults.find(
    (row) => numberOrNull(row.position) === 1,
  );
  const winnerName = stringOrNull(winnerRow?.full_name) ?? "The winner";
  const winnerCode = stringOrNull(winnerRow?.driver_code);
  const winnerPath = evidence.positionPaths.find(
    (path) => path.driverCode === winnerCode,
  );
  const leaderLaps = Object.values(evidence.lapsLed).reduce(
    (total, laps) => total + laps,
    0,
  );
  const winnerStops = evidence.pitStops.filter(
    (stop) => stop.driverCode === winnerCode,
  );
  const winnerStints = evidence.stintSummaries.filter(
    (stint) => stint.driverCode === winnerCode,
  );
  const evidenceId = `race-dynamics-${session.id}`;
  const calculationId = `race-calculations-${session.id}`;
  const facts = [
    `${winnerName} won from grid position ${winnerPath?.grid ?? "unknown"}`,
    `${winnerPath?.lapsLed ?? 0} of ${leaderLaps} recorded leader laps`,
    `leader sequence: ${evidence.leaderTimeline.join(" → ") || "unavailable"}`,
    neutralizationSummary(evidence),
  ];
  const summary = `${facts.join("; ")}. This is an evidence summary of what happened, not an inference about team intent.`;
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
        family,
        objective:
          family === "strategy"
            ? "Summarize verified stint, stop-lap, position, and neutralization evidence"
            : "Summarize verified race-shape and position evidence",
        metrics: [
          "position_path",
          "laps_led",
          "leader_timeline",
          "stints",
          "pit_stop_laps",
          "neutralizations",
        ],
        presentations: ["narrative", "metric_cards", "table"],
      },
    ],
    assumptions: [],
    unresolvedTerms: [],
  });
  const artifact = answerArtifactSchema.parse({
    version: 1,
    family,
    title: `${season} ${session.eventName} evidence brief`,
    summary,
    metrics: [
      {
        id: "winner",
        label: "Winner",
        value: winnerName,
        displayValue: winnerName,
        evidenceIds: [evidenceId],
      },
      {
        id: "winner-laps-led",
        label: `${winnerName} laps led`,
        value: winnerPath?.lapsLed ?? 0,
        displayValue: `${winnerPath?.lapsLed ?? 0} of ${leaderLaps}`,
        evidenceIds: [calculationId],
      },
    ],
    tables: [
      {
        id: "position-paths",
        title: "Top-10 position paths",
        columns: [
          { key: "driver", label: "Driver" },
          { key: "grid", label: "Grid" },
          { key: "lap1", label: "Lap 1" },
          { key: "best", label: "Best" },
          { key: "worst", label: "Worst" },
          { key: "finish", label: "Finish" },
          { key: "lapsLed", label: "Laps led" },
        ],
        rows: evidence.positionPaths.map((path) => ({
          driver: path.driverName,
          grid: path.grid ?? "—",
          lap1: path.lap1 ?? "—",
          best: path.best ?? "—",
          worst: path.worst ?? "—",
          finish: path.finish ?? "—",
          lapsLed: path.lapsLed,
        })),
      },
      ...(winnerStints.length > 0
        ? [
            {
              id: "winner-stints",
              title: `${winnerName} stints`,
              columns: [
                { key: "stint", label: "Stint" },
                { key: "compound", label: "Compound" },
                { key: "laps", label: "Lap range" },
                { key: "median", label: "Median clean lap" },
              ],
              rows: winnerStints.map((stint) => ({
                stint: stint.stint,
                compound: stint.compound ?? "Unknown",
                laps: `L${stint.startLap}-L${stint.endLap}`,
                median:
                  stint.medianCleanLapSeconds === null
                    ? "—"
                    : `${stint.medianCleanLapSeconds.toFixed(3)}s`,
              })),
            },
          ]
        : []),
    ],
    charts: [],
    evidence: [
      {
        id: evidenceId,
        kind: "database",
        label: "Classification, laps, and race-control records",
        source: "session_results + laps + race_control_messages",
        fields: {
          sessionId: session.id,
          resultRows: evidence.finalResults.length,
          raceControlRows: evidence.raceControl.length,
        },
      },
      {
        id: calculationId,
        kind: "calculation",
        label: "Deterministic race-shape calculations",
        source: "race-dynamics-v2",
        fields: {
          leaderTimeline: evidence.leaderTimeline,
          neutralizedLaps: evidence.neutralizedLaps,
          winnerStopLaps: winnerStops.map((stop) => stop.lapRange),
        },
      },
    ],
    caveats: [
      "Stop evidence is derived from lap pit-in and pit-out markers; it does not include stationary stop duration.",
      ...(leaderLaps === 0
        ? ["Lap-position coverage is unavailable for this session."]
        : []),
    ],
    actions: [
      {
        label: `Open ${session.eventName} analysis`,
        href: `/results/${season}/${session.round}${sessionType === "sprint_race" ? "?tab=sprint" : ""}`,
      },
    ],
  });
  return {
    plan,
    artifact,
    queries: [
      RACE_RESULTS_SQL.trim(),
      RACE_LAPS_SQL.trim(),
      RACE_CONTROL_SQL.trim(),
    ],
    model: `deterministic/${family}-v1`,
  };
}

export async function tryRunRaceAnalysis(
  question: string,
  pageContext?: AnalysisPageContext,
): Promise<RaceAnalysisExecution | null> {
  const season = extractSeason(question) ?? pageContext?.season ?? null;
  if (season === null || !looksLikeRaceAnalysis(question)) return null;
  const sessionType: ResultSessionType =
    pageContext?.sessionType === "sprint_race" || /\bsprint\b/i.test(question)
      ? "sprint_race"
      : "race";
  const candidates = await loadResultSessionCandidates(season, sessionType);
  const session = selectResultSession(question, candidates, pageContext);
  if (!session) return null;
  const evidence = await loadRaceDynamics(session.id);
  if (evidence.finalResults.length === 0) return null;
  return buildRaceAnalysisExecution({
    question,
    season,
    sessionType,
    session,
    evidence,
  });
}
