import {
  evaluateRaceDataCoverage,
  normalizeRaceLaps,
  type RaceDataCoverage,
  type RaceDataRow,
} from "./race-evidence-quality";
import {
  describePaceModel,
  fitRacePaceModel,
  type RacePaceModel,
} from "./race-pace-model";
import {
  calculateStopLossDistribution,
  findSafeStopCases,
  type SafeStopCase,
  type StopLossDistribution,
} from "./race-stop-loss";
import {
  type DoubleStackEvent,
  extractPitTransitEvents,
  findDoubleStacks,
  findUndercutFailures,
  type PitTransitEvent,
  type UndercutFailure,
} from "./race-strategy-events";

export interface RaceStrategyEvidence {
  sessionId: number;
  coverage: RaceDataCoverage;
  paceModel: RacePaceModel;
  paceModelSummary: string;
  pitStops: PitTransitEvent[];
  undercutFailures: UndercutFailure[];
  doubleStacks: DoubleStackEvent[];
  stopLoss: StopLossDistribution | null;
  safeStopCases: SafeStopCase[];
  evidenceRules: string[];
}

export function calculateRaceStrategyEvidence(params: {
  sessionId: number;
  laps: RaceDataRow[];
}): RaceStrategyEvidence {
  const laps = normalizeRaceLaps(params.laps);
  const coverage = evaluateRaceDataCoverage(laps);
  const paceModel = fitRacePaceModel(laps);
  const pitStops = extractPitTransitEvents(laps);
  const stopLoss = calculateStopLossDistribution(laps, pitStops, paceModel);
  return {
    sessionId: params.sessionId,
    coverage,
    paceModel,
    paceModelSummary: describePaceModel(paceModel),
    pitStops,
    undercutFailures: findUndercutFailures(laps, pitStops),
    doubleStacks: findDoubleStacks(pitStops),
    stopLoss,
    safeStopCases: findSafeStopCases(laps, pitStops, stopLoss),
    evidenceRules: [
      "Missing numeric values include NULL and non-finite values such as PostgreSQL NaN.",
      "Pit duration means entry-to-exit pit-lane transit, never stationary service time.",
      "Undercut components are observed separately; the data does not assign operational cause.",
      "Safe-stop estimates are withheld when pace-model quality or stop-loss support fails.",
      "The pace intercept describes a driver-entry, not a car or driver in isolation.",
    ],
  };
}
