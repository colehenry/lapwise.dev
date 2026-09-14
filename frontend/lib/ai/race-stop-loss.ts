import { type NormalizedRaceLap, quantile } from "./race-evidence-quality";
import { predictRaceLapSeconds, type RacePaceModel } from "./race-pace-model";
import {
  createGapResolver,
  type PitTransitEvent,
  raceLapIndex,
} from "./race-strategy-events";

export interface StopLossSample {
  driverCode: string;
  inLap: number;
  lossSeconds: number;
}

export interface StopLossDistribution {
  sampleCount: number;
  lowerQuartileSeconds: number;
  medianSeconds: number;
  upperQuartileSeconds: number;
  samples: StopLossSample[];
}

export interface SafeStopCase {
  driverId: number;
  driverCode: string;
  driverName: string;
  inLap: number;
  positionBefore: number;
  positionAfter: number | null;
  carBehindCode: string;
  gapBehindSeconds: number;
  expectedStopLossSeconds: number;
  bufferSeconds: number;
  retainedPosition: boolean;
  hadTwoSecondBuffer: boolean;
}

function validGreenStop(
  event: PitTransitEvent,
  inLap: NormalizedRaceLap | undefined,
  outLap: NormalizedRaceLap | undefined,
): inLap is NormalizedRaceLap {
  return Boolean(
    !event.underNeutralization &&
      inLap &&
      outLap &&
      inLap.trackStatus === "1" &&
      outLap.trackStatus === "1" &&
      inLap.lapTimeSeconds !== null &&
      outLap.lapTimeSeconds !== null,
  );
}

export function calculateStopLossDistribution(
  laps: NormalizedRaceLap[],
  stops: PitTransitEvent[],
  model: RacePaceModel,
): StopLossDistribution | null {
  if (!model.quality.usable) return null;
  const index = raceLapIndex(laps);
  const samples: StopLossSample[] = [];
  for (const stop of stops) {
    const inLap = index.get(`${stop.driverId}:${stop.inLap}`);
    const outLap = index.get(`${stop.driverId}:${stop.outLap}`);
    if (!validGreenStop(stop, inLap, outLap) || !outLap) continue;
    const predictedIn = predictRaceLapSeconds(model, inLap);
    const predictedOut = predictRaceLapSeconds(model, outLap);
    if (predictedIn === null || predictedOut === null) continue;
    const loss =
      (inLap.lapTimeSeconds as number) +
      (outLap.lapTimeSeconds as number) -
      predictedIn -
      predictedOut;
    if (!Number.isFinite(loss) || loss < 8 || loss > 45) continue;
    samples.push({
      driverCode: stop.driverCode,
      inLap: stop.inLap,
      lossSeconds: loss,
    });
  }
  const losses = samples.map((sample) => sample.lossSeconds);
  if (losses.length < 5) return null;
  return {
    sampleCount: samples.length,
    lowerQuartileSeconds: quantile(losses, 0.25) as number,
    medianSeconds: quantile(losses, 0.5) as number,
    upperQuartileSeconds: quantile(losses, 0.75) as number,
    samples,
  };
}

export function findSafeStopCases(
  laps: NormalizedRaceLap[],
  stops: PitTransitEvent[],
  distribution: StopLossDistribution | null,
): SafeStopCase[] {
  if (!distribution) return [];
  const index = raceLapIndex(laps);
  const gapAt = createGapResolver(laps);
  const cases: SafeStopCase[] = [];
  for (const stop of stops) {
    if (stop.underNeutralization) continue;
    const beforeLapNumber = stop.inLap - 1;
    const before = index.get(`${stop.driverId}:${beforeLapNumber}`);
    const after = index.get(`${stop.driverId}:${stop.outLap}`);
    if (before?.position === null || before?.position === undefined) continue;
    const behind = laps.find(
      (lap) =>
        lap.lapNumber === beforeLapNumber &&
        lap.position === (before.position as number) + 1,
    );
    if (!behind) continue;
    const gapBehind = gapAt(behind.driverId, stop.driverId, beforeLapNumber);
    if (gapBehind === null || gapBehind <= 0 || gapBehind > 90) continue;
    const buffer = gapBehind - distribution.medianSeconds;
    cases.push({
      driverId: stop.driverId,
      driverCode: stop.driverCode,
      driverName: stop.driverName,
      inLap: stop.inLap,
      positionBefore: before.position,
      positionAfter: after?.position ?? null,
      carBehindCode: behind.driverCode,
      gapBehindSeconds: gapBehind,
      expectedStopLossSeconds: distribution.medianSeconds,
      bufferSeconds: buffer,
      retainedPosition: after?.position === before.position,
      hadTwoSecondBuffer: buffer >= 2,
    });
  }
  return cases.sort(
    (a, b) => Math.abs(a.bufferSeconds) - Math.abs(b.bufferSeconds),
  );
}
