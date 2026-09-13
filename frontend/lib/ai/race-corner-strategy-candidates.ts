import type {
  RaceCornerInsight,
  RaceCornerResult,
} from "./race-corner-insight";
import type { RaceStrategyEvidence } from "./race-strategy-calculation";
import type { DoubleStackEvent, UndercutFailure } from "./race-strategy-events";

function seconds(value: number): string {
  return `${value.toFixed(3)}s`;
}

function surname(name: string): string {
  return name.trim().split(/\s+/).at(-1) ?? name;
}

function undercutScore(event: UndercutFailure): number {
  if (event.comparedNewTyreLaps === 0) return 0;
  const salience = Math.max(
    Math.abs(event.gapChangeSeconds),
    Math.abs(event.transitDeltaSeconds),
    Math.abs(event.newTyreGainSeconds),
  );
  return salience >= 1.5 ? 80 + Math.min(10, salience) : 0;
}

function subjectResult(
  codes: string[],
  resultByCode: Map<string, RaceCornerResult>,
): RaceCornerResult | null {
  return (
    codes
      .map((code) => resultByCode.get(code))
      .filter((result): result is RaceCornerResult => Boolean(result))
      .sort((left, right) => left.position - right.position)[0] ?? null
  );
}

function undercutInsight(
  event: UndercutFailure,
  resultByCode: Map<string, RaceCornerResult>,
): RaceCornerInsight | null {
  const attacker = surname(event.attacker.driverName);
  const target = surname(event.target.driverName);
  const subject = subjectResult(
    [event.attacker.driverCode, event.target.driverCode],
    resultByCode,
  );
  if (!subject) return null;
  const stopDelta = event.target.inLap - event.attacker.inLap;
  const stopTiming = stopDelta === 1 ? "one lap" : `${stopDelta} laps`;
  const gapMovement = event.gapBeforeSeconds - event.gapAfterSeconds;
  const gapSentence =
    gapMovement >= 0
      ? `gaining ${seconds(gapMovement)} but remaining behind`
      : `losing another ${seconds(Math.abs(gapMovement))}`;
  const newerTyrePace =
    event.newTyreGainSeconds >= 0
      ? `gained ${seconds(event.newTyreGainSeconds)}`
      : `lost ${seconds(Math.abs(event.newTyreGainSeconds))}`;
  const pitLaneTime =
    event.transitDeltaSeconds >= 0
      ? `spent ${seconds(event.transitDeltaSeconds)} more time in the pit lane`
      : `spent ${seconds(Math.abs(event.transitDeltaSeconds))} less time in the pit lane`;
  return {
    kind: "covered_undercut",
    question: `How did ${target} cover ${attacker}'s undercut?`,
    answer: `${attacker} pitted ${stopTiming} before ${target}, likely attempting an undercut. ${attacker} was +${seconds(event.gapBeforeSeconds)} behind before their stops and +${seconds(event.gapAfterSeconds)} behind afterward, ${gapSentence}. Across ${event.comparedNewTyreLaps} full racing lap${event.comparedNewTyreLaps === 1 ? "" : "s"} before ${target} pitted, ${attacker} ${newerTyrePace} with newer tyres, but ${pitLaneTime}.`,
    score: undercutScore(event),
    subjectFinishPosition: subject.position,
    subjectDriverCode: subject.driverCode,
  };
}

function doubleStackInsight(
  event: DoubleStackEvent,
  resultByCode: Map<string, RaceCornerResult>,
): RaceCornerInsight | null {
  const subject = subjectResult(
    [event.first.driverCode, event.second.driverCode],
    resultByCode,
  );
  if (!subject) return null;
  const team = event.teamName;
  const possessive = /s$/i.test(team) ? `${team}'` : `${team}'s`;
  return {
    kind: "double_stack",
    question: `What did ${possessive} double-stack cost?`,
    answer: `${team} stopped both cars on lap ${event.lapNumber}. ${surname(event.second.driverName)} arrived ${seconds(event.arrivalGapSeconds)} later and spent ${seconds(event.secondTransitTaxSeconds)} longer in the pit lane than ${surname(event.first.driverName)}.`,
    score: 90 + Math.min(10, event.secondTransitTaxSeconds),
    subjectFinishPosition: subject.position,
    subjectDriverCode: subject.driverCode,
  };
}

export function strategyCandidateInsights(
  evidence: Pick<RaceStrategyEvidence, "undercutFailures" | "doubleStacks">,
  resultByCode: Map<string, RaceCornerResult>,
): RaceCornerInsight[] {
  return [
    ...evidence.undercutFailures
      .filter((event) => undercutScore(event) > 0)
      .map((event) => undercutInsight(event, resultByCode)),
    ...evidence.doubleStacks
      .filter((event) => event.secondTransitTaxSeconds >= 2)
      .map((event) => doubleStackInsight(event, resultByCode)),
  ].filter((insight): insight is RaceCornerInsight => Boolean(insight));
}
