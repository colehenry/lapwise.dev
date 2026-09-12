import {
  type NormalizedRaceLap,
  quantile,
  selectCleanPaceLaps,
} from "./race-evidence-quality";
import {
  type CoreRacePaceFit,
  fitRacePaceCore,
  paceCoefficient,
} from "./race-pace-fit";

const MIN_DRIVER_LAPS = 8;
const MIN_COMPOUND_LAPS = 12;
const MAX_RMSE_SECONDS = 0.8;
const MAX_CONDITIONING_RATIO = 250;
const MIN_FUEL_SLOPE = -0.15;
const MAX_FUEL_SLOPE = 0.02;
const MAX_DEGRADATION_MAGNITUDE = 0.4;
const BOOTSTRAP_SAMPLES = 24;

export interface RacePaceModelQuality {
  usable: boolean;
  cleanLapCount: number;
  driverCount: number;
  compoundCount: number;
  stintCount: number;
  rmseSeconds: number | null;
  conditioningRatio: number | null;
  bootstrapSamples: number;
  fuelSlopeInterval: [number, number] | null;
  rejectionReasons: string[];
  excludedLaps: Record<string, number>;
}

export interface RacePaceCoefficients {
  interceptSeconds: number;
  fuelSlopeSecondsPerLap: number;
  referenceDriverId: number;
  referenceCompound: string;
  driverAdjustments: Record<string, number>;
  compoundOffsets: Record<string, number>;
  degradationSecondsPerLap: Record<string, number>;
}

export interface RacePaceModel {
  quality: RacePaceModelQuality;
  coefficients: RacePaceCoefficients | null;
}

function supportedRows(laps: NormalizedRaceLap[]): NormalizedRaceLap[] {
  const driverCounts = new Map<number, number>();
  const compoundCounts = new Map<string, number>();
  for (const lap of laps) {
    driverCounts.set(lap.driverId, (driverCounts.get(lap.driverId) ?? 0) + 1);
    if (lap.compound)
      compoundCounts.set(
        lap.compound,
        (compoundCounts.get(lap.compound) ?? 0) + 1,
      );
  }
  return laps.filter(
    (lap) =>
      (driverCounts.get(lap.driverId) ?? 0) >= MIN_DRIVER_LAPS &&
      Boolean(
        lap.compound &&
          (compoundCounts.get(lap.compound) ?? 0) >= MIN_COMPOUND_LAPS,
      ),
  );
}

function toPublicCoefficients(
  fit: CoreRacePaceFit,
  laps: NormalizedRaceLap[],
): RacePaceCoefficients {
  const drivers = [...new Set(laps.map((lap) => lap.driverId))].sort(
    (a, b) => a - b,
  );
  const compounds = [
    ...new Set(
      laps
        .map((lap) => lap.compound)
        .filter((value): value is string => !!value),
    ),
  ].sort();
  return {
    interceptSeconds: fit.coefficients[0],
    fuelSlopeSecondsPerLap: paceCoefficient(
      fit,
      (feature) => feature.kind === "lap",
    ),
    referenceDriverId: drivers[0],
    referenceCompound: compounds[0],
    driverAdjustments: Object.fromEntries(
      drivers.map((driverId) => [
        String(driverId),
        paceCoefficient(
          fit,
          (feature) => feature.kind === "driver" && feature.value === driverId,
        ),
      ]),
    ),
    compoundOffsets: Object.fromEntries(
      compounds.map((compound) => [
        compound,
        paceCoefficient(
          fit,
          (feature) =>
            feature.kind === "compound" && feature.value === compound,
        ),
      ]),
    ),
    degradationSecondsPerLap: Object.fromEntries(
      compounds.map((compound) => [
        compound,
        paceCoefficient(
          fit,
          (feature) =>
            feature.kind === "degradation" && feature.value === compound,
        ),
      ]),
    ),
  };
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function bootstrapFuelSlopes(laps: NormalizedRaceLap[]): number[] {
  const byDriver = new Map<number, NormalizedRaceLap[][]>();
  const grouped = new Map<string, NormalizedRaceLap[]>();
  for (const lap of laps) {
    const key = `${lap.driverId}:${lap.stint}`;
    grouped.set(key, [...(grouped.get(key) ?? []), lap]);
  }
  for (const group of grouped.values()) {
    const driverId = group[0].driverId;
    byDriver.set(driverId, [...(byDriver.get(driverId) ?? []), group]);
  }
  const random = seededRandom(laps.length * 7919 + grouped.size);
  const slopes: number[] = [];
  for (let sample = 0; sample < BOOTSTRAP_SAMPLES; sample += 1) {
    const resampled: NormalizedRaceLap[] = [];
    for (const stints of byDriver.values()) {
      for (let draw = 0; draw < stints.length; draw += 1) {
        const selected = stints[Math.floor(random() * stints.length)];
        resampled.push(...selected);
      }
    }
    const fit = fitRacePaceCore(resampled);
    if (!fit) continue;
    const slope = paceCoefficient(fit, (feature) => feature.kind === "lap");
    if (Number.isFinite(slope)) slopes.push(slope);
  }
  return slopes;
}

function hasRacePhaseOverlap(laps: NormalizedRaceLap[]): boolean {
  const ranges = new Map<string, { minimum: number; maximum: number }>();
  for (const lap of laps) {
    if (!lap.compound) continue;
    const range = ranges.get(lap.compound) ?? {
      minimum: lap.lapNumber,
      maximum: lap.lapNumber,
    };
    range.minimum = Math.min(range.minimum, lap.lapNumber);
    range.maximum = Math.max(range.maximum, lap.lapNumber);
    ranges.set(lap.compound, range);
  }
  const values = [...ranges.values()];
  return values.some((left, index) =>
    values
      .slice(index + 1)
      .some(
        (right) =>
          Math.min(left.maximum, right.maximum) -
            Math.max(left.minimum, right.minimum) >=
          5,
      ),
  );
}

export function fitRacePaceModel(laps: NormalizedRaceLap[]): RacePaceModel {
  const selection = selectCleanPaceLaps(laps);
  const supported = supportedRows(selection.laps);
  const drivers = new Set(supported.map((lap) => lap.driverId));
  const compounds = new Set(supported.map((lap) => lap.compound));
  const stints = new Set(
    supported.map((lap) => `${lap.driverId}:${lap.stint}`),
  );
  const fit = supported.length >= 80 ? fitRacePaceCore(supported) : null;
  const coefficients = fit ? toPublicCoefficients(fit, supported) : null;
  const fuelSlopes = fit ? bootstrapFuelSlopes(supported) : [];
  const fuelInterval =
    fuelSlopes.length >= 12
      ? ([
          quantile(fuelSlopes, 0.1) as number,
          quantile(fuelSlopes, 0.9) as number,
        ] as [number, number])
      : null;
  const rejectionReasons: string[] = [];
  if (supported.length < 80)
    rejectionReasons.push("fewer than 80 supported clean laps");
  if (drivers.size < 4)
    rejectionReasons.push("fewer than four supported drivers");
  if (compounds.size < 2)
    rejectionReasons.push("fewer than two supported compounds");
  if (!hasRacePhaseOverlap(supported))
    rejectionReasons.push("compound samples do not overlap in race phase");
  if (!fit) rejectionReasons.push("design matrix is rank deficient");
  if (fit && fit.rmseSeconds > MAX_RMSE_SECONDS)
    rejectionReasons.push(
      `RMSE exceeds ${MAX_RMSE_SECONDS.toFixed(1)} seconds`,
    );
  if (fit && fit.conditioningRatio > MAX_CONDITIONING_RATIO)
    rejectionReasons.push("pace coefficients are ill-conditioned");
  if (
    coefficients &&
    (coefficients.fuelSlopeSecondsPerLap < MIN_FUEL_SLOPE ||
      coefficients.fuelSlopeSecondsPerLap > MAX_FUEL_SLOPE)
  ) {
    rejectionReasons.push("fuel/race-phase slope is outside its sanity range");
  }
  if (
    coefficients &&
    Object.values(coefficients.degradationSecondsPerLap).some(
      (value) => Math.abs(value) > MAX_DEGRADATION_MAGNITUDE,
    )
  ) {
    rejectionReasons.push("a degradation slope is outside its sanity range");
  }
  if (fit && fuelInterval === null)
    rejectionReasons.push("stint bootstrap support is insufficient");

  return {
    coefficients,
    quality: {
      usable: rejectionReasons.length === 0,
      cleanLapCount: supported.length,
      driverCount: drivers.size,
      compoundCount: compounds.size,
      stintCount: stints.size,
      rmseSeconds: fit?.rmseSeconds ?? null,
      conditioningRatio: fit?.conditioningRatio ?? null,
      bootstrapSamples: fuelSlopes.length,
      fuelSlopeInterval: fuelInterval,
      rejectionReasons: [...new Set(rejectionReasons)],
      excludedLaps: selection.excluded,
    },
  };
}

export function predictRaceLapSeconds(
  model: RacePaceModel,
  lap: NormalizedRaceLap,
): number | null {
  const coefficients = model.coefficients;
  if (!coefficients || !lap.compound || lap.tyreLife === null) return null;
  const driverAdjustment = coefficients.driverAdjustments[String(lap.driverId)];
  const compoundOffset = coefficients.compoundOffsets[lap.compound];
  const degradation = coefficients.degradationSecondsPerLap[lap.compound];
  if (
    driverAdjustment === undefined ||
    compoundOffset === undefined ||
    degradation === undefined
  ) {
    return null;
  }
  return (
    coefficients.interceptSeconds +
    driverAdjustment +
    coefficients.fuelSlopeSecondsPerLap * lap.lapNumber +
    compoundOffset +
    degradation * lap.tyreLife
  );
}

export function describePaceModel(model: RacePaceModel): string {
  if (!model.quality.usable)
    return `Pace model withheld: ${model.quality.rejectionReasons.join("; ")}.`;
  const rmse = model.quality.rmseSeconds ?? 0;
  const slope = model.coefficients?.fuelSlopeSecondsPerLap ?? 0;
  const interval = model.quality.fuelSlopeInterval;
  return `Pace model accepted on ${model.quality.cleanLapCount} laps (RMSE ${rmse.toFixed(3)}s; race-phase slope ${slope.toFixed(3)}s/lap${interval ? `, 80% stint-bootstrap interval ${interval[0].toFixed(3)} to ${interval[1].toFixed(3)}` : ""}).`;
}
