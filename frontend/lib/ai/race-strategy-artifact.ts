import {
  type AnswerArtifact,
  answerArtifactSchema,
} from "./analysis-contracts";
import type { SafeStopCase } from "./race-stop-loss";
import type { RaceStrategyEvidence } from "./race-strategy-calculation";
import type { DoubleStackEvent, UndercutFailure } from "./race-strategy-events";

export type RaceStrategyIntent =
  | "undercut_failure"
  | "safe_stop"
  | "double_stack";

interface ArtifactContext {
  season: number;
  round: number;
  eventName: string;
  sessionType: "race" | "sprint_race";
}

function seconds(value: number, signed = false): string {
  const prefix = signed && value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(3)}s`;
}

function action(context: ArtifactContext) {
  return {
    label: `Open ${context.eventName} analysis`,
    href: `/results/${context.season}/${context.round}${
      context.sessionType === "sprint_race" ? "?tab=sprint" : ""
    }`,
  };
}

function evidenceRows(
  evidence: RaceStrategyEvidence,
  calculationFields: Record<string, unknown>,
) {
  return [
    {
      id: `race-strategy-laps-${evidence.sessionId}`,
      kind: "database" as const,
      label: "Lap, tyre, position, and pit-marker records",
      source: "laps + session_results + drivers + teams",
      fields: {
        sessionId: evidence.sessionId,
        rows: evidence.coverage.inputRows,
        timedRows: evidence.coverage.timedRows,
        completePitMarkers: evidence.coverage.completePitMarkers,
      },
    },
    {
      id: `race-strategy-calculation-${evidence.sessionId}`,
      kind: "calculation" as const,
      label: "Deterministic strategy calculation",
      source: "race-strategy-v1",
      fields: calculationFields,
    },
  ];
}

export function undercutFailureArtifact(
  context: ArtifactContext,
  evidence: RaceStrategyEvidence,
  failure: UndercutFailure | null,
): AnswerArtifact {
  const evidenceId = `race-strategy-laps-${evidence.sessionId}`;
  const calculationId = `race-strategy-calculation-${evidence.sessionId}`;
  if (!failure) {
    return answerArtifactSchema.parse({
      version: 1,
      family: "strategy",
      title: `${context.season} ${context.eventName} undercut check`,
      summary:
        "I could not verify a failed green-flag undercut matching the required gap, stop-order, and timing evidence in this race.",
      metrics: [],
      tables: [],
      charts: [],
      evidence: evidenceRows(evidence, { candidates: 0 }),
      caveats: evidence.coverage.limitations,
      actions: [action(context)],
    });
  }
  const tyreSentence =
    failure.comparedNewTyreLaps > 0
      ? `${failure.attacker.driverName}'s fresh-tyre laps gained ${seconds(
          failure.newTyreGainSeconds,
        )} over ${failure.comparedNewTyreLaps} comparable lap${
          failure.comparedNewTyreLaps === 1 ? "" : "s"
        }.`
      : "There was no clean representative lap between the two stops to price the fresh-tyre gain.";
  const transitDirection =
    failure.transitDeltaSeconds >= 0 ? "longer" : "shorter";
  const summary = `${failure.attacker.driverName} stopped on lap ${failure.attacker.inLap}, ${failure.target.driverName} on lap ${failure.target.inLap}. The gap changed from ${seconds(failure.gapBeforeSeconds)} behind to ${seconds(failure.gapAfterSeconds)} behind. ${tyreSentence} The earlier stopper's total pit-lane transit was ${seconds(Math.abs(failure.transitDeltaSeconds))} ${transitDirection}.`;
  return answerArtifactSchema.parse({
    version: 1,
    family: "strategy",
    title: `Why the undercut did not work`,
    summary,
    metrics: [
      {
        id: "gap-before",
        label: "Gap before",
        value: failure.gapBeforeSeconds,
        displayValue: `${seconds(failure.gapBeforeSeconds)} behind`,
        evidenceIds: [evidenceId],
      },
      {
        id: "gap-after",
        label: "Gap after both stops",
        value: failure.gapAfterSeconds,
        displayValue: `${seconds(failure.gapAfterSeconds)} behind`,
        evidenceIds: [evidenceId],
      },
      {
        id: "lane-transit-delta",
        label: "Earlier stopper lane delta",
        value: failure.transitDeltaSeconds,
        displayValue: seconds(failure.transitDeltaSeconds, true),
        evidenceIds: [calculationId],
      },
      ...(failure.comparedNewTyreLaps > 0
        ? [
            {
              id: "new-tyre-gain",
              label: "Fresh-tyre lap gain",
              value: failure.newTyreGainSeconds,
              displayValue: seconds(failure.newTyreGainSeconds),
              evidenceIds: [calculationId],
            },
          ]
        : []),
    ],
    tables: [
      {
        id: "stop-comparison",
        title: "Stop sequence",
        columns: [
          { key: "driver", label: "Driver" },
          { key: "lap", label: "In lap" },
          { key: "compound", label: "New tyre" },
          { key: "transit", label: "Pit-lane transit" },
        ],
        rows: [failure.attacker, failure.target].map((stop) => ({
          driver: stop.driverName,
          lap: stop.inLap,
          compound: stop.afterCompound ?? "Unknown",
          transit: seconds(stop.transitSeconds),
        })),
      },
    ],
    charts: [],
    evidence: evidenceRows(evidence, {
      gapChangeSeconds: failure.gapChangeSeconds,
      transitDeltaSeconds: failure.transitDeltaSeconds,
      newTyreGainSeconds: failure.newTyreGainSeconds,
      comparedNewTyreLaps: failure.comparedNewTyreLaps,
    }),
    caveats: [
      "Pit-lane transit is entry to exit, not stationary service time.",
      "Timing alone cannot separate queueing, driving through the lane, operational delay, traffic, or team intent.",
    ],
    actions: [action(context)],
  });
}

export function safeStopArtifact(
  context: ArtifactContext,
  evidence: RaceStrategyEvidence,
  stop: SafeStopCase | null,
): AnswerArtifact {
  const evidenceId = `race-strategy-laps-${evidence.sessionId}`;
  const calculationId = `race-strategy-calculation-${evidence.sessionId}`;
  const distribution = evidence.stopLoss;
  const unavailable = !stop || !distribution;
  const summary = unavailable
    ? distribution
      ? "A safe-stop answer was withheld because no stop had both a clock-aligned gap to the next car and a verified rejoin position."
      : `A safe-stop answer was withheld. ${evidence.paceModelSummary}`
    : `Before ${stop.driverName}'s lap-${stop.inLap} stop, the gap to ${stop.carBehindCode} was ${seconds(stop.gapBehindSeconds)}. The race's modeled green-stop loss was ${seconds(stop.expectedStopLossSeconds)}, leaving ${seconds(stop.bufferSeconds, true)} of margin. ${stop.retainedPosition ? `The car remained P${stop.positionBefore} after the out-lap.` : `It changed from P${stop.positionBefore} to P${stop.positionAfter ?? "?"} through the stop.`}`;
  return answerArtifactSchema.parse({
    version: 1,
    family: "strategy",
    title: `${context.eventName} safe-stop check`,
    summary,
    metrics:
      unavailable || !stop || !distribution
        ? []
        : [
            {
              id: "gap-behind",
              label: "Gap behind",
              value: stop.gapBehindSeconds,
              displayValue: seconds(stop.gapBehindSeconds),
              evidenceIds: [evidenceId],
            },
            {
              id: "expected-stop-loss",
              label: "Median green-stop loss",
              value: distribution.medianSeconds,
              displayValue: seconds(distribution.medianSeconds),
              evidenceIds: [calculationId],
            },
            {
              id: "position-buffer",
              label: "Position buffer",
              value: stop.bufferSeconds,
              displayValue: seconds(stop.bufferSeconds, true),
              evidenceIds: [calculationId],
            },
          ],
    tables: [],
    charts: [],
    evidence: evidenceRows(evidence, {
      modelQuality: evidence.paceModel.quality,
      stopLoss: distribution,
    }),
    caveats: [
      ...evidence.coverage.limitations,
      ...(distribution
        ? [
            `The estimate is based on ${distribution.sampleCount} green stops; its middle 50% spans ${seconds(distribution.lowerQuartileSeconds)} to ${seconds(distribution.upperQuartileSeconds)}.`,
          ]
        : []),
      "The estimate cannot predict a rival reaction, future caution, penalty, or traffic after rejoining.",
    ],
    actions: [action(context)],
  });
}

export function doubleStackArtifact(
  context: ArtifactContext,
  evidence: RaceStrategyEvidence,
  stack: DoubleStackEvent | null,
): AnswerArtifact {
  const calculationId = `race-strategy-calculation-${evidence.sessionId}`;
  const summary = stack
    ? `${stack.teamName} brought both cars in on lap ${stack.lapNumber}. ${stack.second.driverName} arrived ${seconds(stack.arrivalGapSeconds)} after ${stack.first.driverName} and spent ${seconds(stack.secondTransitTaxSeconds, true)} longer in the pit lane.`
    : "I could not verify a likely same-lap teammate double-stack with arrival timestamps within ten seconds in this race.";
  return answerArtifactSchema.parse({
    version: 1,
    family: "strategy",
    title: `${context.eventName} double-stack check`,
    summary,
    metrics: stack
      ? [
          {
            id: "arrival-gap",
            label: "Arrival gap",
            value: stack.arrivalGapSeconds,
            displayValue: seconds(stack.arrivalGapSeconds),
            evidenceIds: [calculationId],
          },
          {
            id: "second-car-tax",
            label: "Second-car lane delta",
            value: stack.secondTransitTaxSeconds,
            displayValue: seconds(stack.secondTransitTaxSeconds, true),
            evidenceIds: [calculationId],
          },
        ]
      : [],
    tables: stack
      ? [
          {
            id: "double-stack-stops",
            title: "Pit-lane transit",
            columns: [
              { key: "order", label: "Arrival" },
              { key: "driver", label: "Driver" },
              { key: "transit", label: "Transit" },
            ],
            rows: [
              {
                order: "First",
                driver: stack.first.driverName,
                transit: seconds(stack.first.transitSeconds),
              },
              {
                order: "Second",
                driver: stack.second.driverName,
                transit: seconds(stack.second.transitSeconds),
              },
            ],
          },
        ]
      : [],
    charts: [],
    evidence: evidenceRows(evidence, {
      candidates: evidence.doubleStacks.length,
      selected: stack,
    }),
    caveats: [
      "This measures total pit-lane transit, not stationary service or pit-crew performance.",
      "The data cannot separate queueing, tyre handling, penalties, or deliberate delay.",
    ],
    actions: [action(context)],
  });
}
