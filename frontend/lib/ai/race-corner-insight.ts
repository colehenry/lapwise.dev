import { strategyCandidateInsights } from "./race-corner-strategy-candidates";
import type {
  RaceDynamicsEvidence,
  RacePositionPath,
} from "./race-dynamics-calculation";
import {
  finiteNumber,
  nonEmptyText,
  type RaceDataRow,
} from "./race-evidence-quality";
import type { RaceStrategyEvidence } from "./race-strategy-calculation";

export type RaceCornerInsightKind =
  | "winner_story"
  | "lead_loss"
  | "brief_leader"
  | "recovery"
  | "high_grid_drop"
  | "covered_undercut"
  | "double_stack";

export interface RaceCornerInsight {
  kind: RaceCornerInsightKind;
  question: string;
  answer: string;
  score: number;
  subjectFinishPosition: number;
  subjectDriverCode: string;
}

interface CornerEvidence {
  strategy: Pick<RaceStrategyEvidence, "undercutFailures" | "doubleStacks">;
  dynamics: Pick<
    RaceDynamicsEvidence,
    "finalResults" | "lapsLed" | "positionPaths"
  >;
}

export interface RaceCornerResult {
  position: number;
  gridPosition: number | null;
  driverCode: string;
  driverName: string;
  status: string | null;
  gapSeconds: number | null;
}

function seconds(value: number): string {
  return `${value.toFixed(3)}s`;
}

function surname(name: string): string {
  return name.trim().split(/\s+/).at(-1) ?? name;
}

function resultFromRow(row: RaceDataRow): RaceCornerResult | null {
  const position = finiteNumber(row.position);
  const driverName = nonEmptyText(row.full_name);
  const driverCode = nonEmptyText(row.driver_code) ?? driverName;
  if (position === null || !driverName || !driverCode) return null;
  return {
    position,
    gridPosition: finiteNumber(row.grid_position),
    driverCode,
    driverName,
    status: nonEmptyText(row.status),
    gapSeconds: finiteNumber(row.time_seconds),
  };
}

function totalLaps(dynamics: CornerEvidence["dynamics"]): number {
  return Object.values(dynamics.lapsLed).reduce(
    (total, count) => total + count,
    0,
  );
}

function winnerStory(
  results: RaceCornerResult[],
  dynamics: CornerEvidence["dynamics"],
): RaceCornerInsight | null {
  const winner = results.find((result) => result.position === 1);
  if (!winner) return null;
  const path = dynamics.positionPaths.find(
    (entry) => entry.driverCode === winner.driverCode,
  );
  const runnerUp = results.find((result) => result.position === 2);
  const shortName = surname(winner.driverName);
  const gain =
    winner.gridPosition === null ? null : winner.gridPosition - winner.position;
  const question =
    gain !== null && gain >= 5
      ? `How did ${shortName} go from P${winner.gridPosition} to victory?`
      : winner.gridPosition === 1 &&
          path &&
          totalLaps(dynamics) > 0 &&
          path.lapsLed === totalLaps(dynamics)
        ? `Did ${shortName} lead from start to finish?`
        : totalLaps(dynamics) > 0
          ? `What shaped ${shortName}'s win?`
          : `What stands out about ${shortName}'s win?`;
  const answer = [
    winner.gridPosition === null
      ? `${shortName} won the race.`
      : gain !== null && gain > 0
        ? `${shortName} started P${winner.gridPosition} and won, gaining ${gain} position${gain === 1 ? "" : "s"}.`
        : `${shortName} started P${winner.gridPosition} and won.`,
    path && totalLaps(dynamics) > 0
      ? `${shortName}${path.firstP1Lap ? ` first reached P1 on lap ${path.firstP1Lap} and` : ""} led ${path.lapsLed} of ${totalLaps(dynamics)} laps.`
      : null,
    runnerUp?.gapSeconds !== null && runnerUp?.gapSeconds !== undefined
      ? `${shortName} finished ${seconds(runnerUp.gapSeconds)} ahead of ${surname(runnerUp.driverName)}.`
      : null,
  ]
    .filter((sentence): sentence is string => Boolean(sentence))
    .join(" ");
  return {
    kind: "winner_story",
    question,
    answer,
    score: 100 + Math.max(0, gain ?? 0),
    subjectFinishPosition: 1,
    subjectDriverCode: winner.driverCode,
  };
}

function leadStories(
  results: RaceCornerResult[],
  dynamics: CornerEvidence["dynamics"],
): RaceCornerInsight[] {
  const winner = results.find((result) => result.position === 1);
  const laps = totalLaps(dynamics);
  if (!winner || laps === 0) return [];
  const winnerLaps = dynamics.lapsLed[winner.driverCode] ?? 0;
  const nonWinners = results
    .filter((result) => result.position > 1)
    .map((result) => ({
      result,
      led: dynamics.lapsLed[result.driverCode] ?? 0,
    }))
    .filter(({ led }) => led > 0)
    .sort((left, right) => right.led - left.led);
  const mostLapsLed = nonWinners.find(
    ({ led }) => led > winnerLaps && led >= Math.max(3, Math.ceil(laps * 0.2)),
  );
  const stories: RaceCornerInsight[] = [];
  if (mostLapsLed) {
    const { result, led } = mostLapsLed;
    const shortName = surname(result.driverName);
    stories.push({
      kind: "lead_loss",
      question: `How did ${shortName} lead ${led} laps but lose?`,
      answer: `${shortName} led ${led} of ${laps} laps, more than any other driver, but finished P${result.position}${result.gapSeconds !== null ? `, ${seconds(result.gapSeconds)} behind ${surname(winner.driverName)}` : ""}. ${surname(winner.driverName)} led ${winnerLaps} laps and was ahead at the finish.`,
      score: 95 + led / laps,
      subjectFinishPosition: result.position,
      subjectDriverCode: result.driverCode,
    });
  }
  for (const { result, led } of nonWinners) {
    if (result.driverCode === mostLapsLed?.result.driverCode || led < 2)
      continue;
    const shortName = surname(result.driverName);
    stories.push({
      kind: "brief_leader",
      question: `How did ${shortName} lead ${led} laps and finish P${result.position}?`,
      answer: `${shortName} led ${led} lap${led === 1 ? "" : "s"} and finished P${result.position}${result.gapSeconds !== null ? `, ${seconds(result.gapSeconds)} behind ${surname(winner.driverName)}` : ""}. ${surname(winner.driverName)} was ahead at the finish.`,
      score: 75 + led / laps,
      subjectFinishPosition: result.position,
      subjectDriverCode: result.driverCode,
    });
  }
  return stories;
}

function positionStories(
  results: RaceCornerResult[],
  positionPaths: RacePositionPath[],
): RaceCornerInsight[] {
  const stories: RaceCornerInsight[] = [];
  for (const result of results) {
    if (result.gridPosition === null || result.position === 1) continue;
    const shortName = surname(result.driverName);
    const change = result.gridPosition - result.position;
    const path = positionPaths.find(
      (entry) => entry.driverCode === result.driverCode,
    );
    if (change >= 5) {
      const pathSentence =
        path?.lap1 && path.best
          ? `After lap one, ${shortName} was P${path.lap1}; the best position reached was P${path.best}.`
          : null;
      stories.push({
        kind: "recovery",
        question: `How did ${shortName} climb from P${result.gridPosition} to P${result.position}?`,
        answer: [
          `${shortName} gained ${change} positions, starting P${result.gridPosition} and finishing P${result.position}.`,
          pathSentence,
        ]
          .filter((sentence): sentence is string => Boolean(sentence))
          .join(" "),
        score: 70 + change,
        subjectFinishPosition: result.position,
        subjectDriverCode: result.driverCode,
      });
    }
    const loss = result.position - result.gridPosition;
    if (result.gridPosition <= 5 && loss >= 5) {
      stories.push({
        kind: "high_grid_drop",
        question: `What happened to ${shortName} after starting P${result.gridPosition}?`,
        answer: `${shortName} started P${result.gridPosition} but was classified P${result.position}${result.status ? ` with the result recorded as ${result.status.toLowerCase()}` : ""}, a loss of ${loss} positions.`,
        score: 65 + loss,
        subjectFinishPosition: result.position,
        subjectDriverCode: result.driverCode,
      });
    }
  }
  return stories;
}

export function selectRaceCornerInsights(
  evidence: CornerEvidence,
): RaceCornerInsight[] {
  const results = evidence.dynamics.finalResults
    .map(resultFromRow)
    .filter((result): result is RaceCornerResult => Boolean(result));
  const resultByCode = new Map(
    results.map((result) => [result.driverCode, result]),
  );
  const candidates = [
    winnerStory(results, evidence.dynamics),
    ...leadStories(results, evidence.dynamics),
    ...positionStories(results, evidence.dynamics.positionPaths),
    ...strategyCandidateInsights(evidence.strategy, resultByCode),
  ]
    .filter((insight): insight is RaceCornerInsight => Boolean(insight))
    .sort(
      (left, right) =>
        left.subjectFinishPosition - right.subjectFinishPosition ||
        right.score - left.score ||
        left.kind.localeCompare(right.kind),
    );

  const selected: RaceCornerInsight[] = [];
  const usedDrivers = new Set<string>();
  const usedKinds = new Set<RaceCornerInsightKind>();
  for (const candidate of candidates) {
    if (
      usedDrivers.has(candidate.subjectDriverCode) ||
      usedKinds.has(candidate.kind)
    ) {
      continue;
    }
    selected.push(candidate);
    usedDrivers.add(candidate.subjectDriverCode);
    usedKinds.add(candidate.kind);
    if (selected.length === 3) break;
  }
  return selected;
}
