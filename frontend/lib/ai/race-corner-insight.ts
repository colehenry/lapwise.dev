import type { SafeStopCase } from "./race-stop-loss";
import type { RaceStrategyEvidence } from "./race-strategy-calculation";
import type { DoubleStackEvent, UndercutFailure } from "./race-strategy-events";

export type RaceCornerInsightKind =
  | "failed_undercut"
  | "safe_stop"
  | "double_stack";

export interface RaceCornerInsight {
  kind: RaceCornerInsightKind;
  question: string;
  answer: string;
  followupQuestion: string;
  score: number;
}

type CornerEvidence = Pick<
  RaceStrategyEvidence,
  "undercutFailures" | "safeStopCases" | "doubleStacks"
>;

function seconds(value: number, signed = false): string {
  const prefix = signed && value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(3)}s`;
}

function surname(name: string): string {
  return name.trim().split(/\s+/).at(-1) ?? name;
}

function teamPossessive(name: string): string {
  return /s$/i.test(name) ? `${name}'` : `${name}'s`;
}

function undercutScore(event: UndercutFailure): number {
  const salience = Math.max(
    Math.abs(event.gapChangeSeconds),
    Math.abs(event.transitDeltaSeconds),
    Math.abs(event.newTyreGainSeconds),
  );
  return salience >= 1.5 ? 80 + Math.min(10, salience) : 0;
}

function undercutInsight(event: UndercutFailure): RaceCornerInsight {
  const attacker = surname(event.attacker.driverName);
  const target = surname(event.target.driverName);
  const transitDirection =
    event.transitDeltaSeconds >= 0 ? "longer" : "shorter";
  const tyreEvidence =
    event.comparedNewTyreLaps > 0
      ? `The fresh-tyre comparison gained ${seconds(event.newTyreGainSeconds)} over ${event.comparedNewTyreLaps} clean lap${event.comparedNewTyreLaps === 1 ? "" : "s"}.`
      : "There was no clean lap between the stops to price the tyre gain.";
  return {
    kind: "failed_undercut",
    question: `Why didn't ${attacker}'s undercut work?`,
    answer: `${attacker} stopped on lap ${event.attacker.inLap}, ${target} on lap ${event.target.inLap}; the gap moved from ${seconds(event.gapBeforeSeconds)} to ${seconds(event.gapAfterSeconds)} behind. ${tyreEvidence} ${attacker}'s total pit-lane transit was ${seconds(Math.abs(event.transitDeltaSeconds))} ${transitDirection}.`,
    followupQuestion: `Why didn't ${attacker}'s undercut on ${target} work?`,
    score: undercutScore(event),
  };
}

function doubleStackInsight(event: DoubleStackEvent): RaceCornerInsight {
  const team = event.teamName;
  return {
    kind: "double_stack",
    question: `What did ${teamPossessive(team)} double-stack cost?`,
    answer: `${team} stopped both cars on lap ${event.lapNumber}. ${surname(event.second.driverName)} arrived ${seconds(event.arrivalGapSeconds)} later and spent ${seconds(event.secondTransitTaxSeconds)} longer in the pit lane than ${surname(event.first.driverName)}.`,
    followupQuestion: `What did the ${team} double-stack cost?`,
    score: 90 + Math.min(10, event.secondTransitTaxSeconds),
  };
}

function safeStopInsight(event: SafeStopCase): RaceCornerInsight {
  const driver = surname(event.driverName);
  const outcome = event.retainedPosition
    ? `The car remained P${event.positionBefore} after the out-lap.`
    : `The car changed from P${event.positionBefore} to P${event.positionAfter ?? "?"} through the stop.`;
  return {
    kind: "safe_stop",
    question: `Could ${driver} pit and keep position?`,
    answer: `Before the lap-${event.inLap} stop, ${driver} had ${seconds(event.gapBehindSeconds)} to the next car. Against a ${seconds(event.expectedStopLossSeconds)} median green-stop loss, the margin was ${seconds(event.bufferSeconds, true)}. ${outcome}`,
    followupQuestion: `Could ${driver} pit and keep position?`,
    score:
      Math.abs(event.bufferSeconds) <= 6
        ? 84 - Math.abs(event.bufferSeconds)
        : 58 + Math.min(8, Math.abs(event.bufferSeconds) / 4),
  };
}

export function selectRaceCornerInsight(
  evidence: CornerEvidence,
): RaceCornerInsight | null {
  const insights: RaceCornerInsight[] = [];
  const undercut = evidence.undercutFailures.find(
    (event) => undercutScore(event) > 0,
  );
  if (undercut) insights.push(undercutInsight(undercut));
  const stack = evidence.doubleStacks.find(
    (event) => event.secondTransitTaxSeconds >= 2,
  );
  if (stack) insights.push(doubleStackInsight(stack));
  if (evidence.safeStopCases[0])
    insights.push(safeStopInsight(evidence.safeStopCases[0]));
  return (
    insights.sort(
      (left, right) =>
        right.score - left.score || left.kind.localeCompare(right.kind),
    )[0] ?? null
  );
}
