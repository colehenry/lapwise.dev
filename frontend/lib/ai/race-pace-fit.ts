import type { NormalizedRaceLap } from "./race-evidence-quality";

export type PaceFeature =
  | { kind: "intercept" }
  | { kind: "driver"; value: number }
  | { kind: "lap" }
  | { kind: "compound"; value: string }
  | { kind: "degradation"; value: string };

export interface CoreRacePaceFit {
  coefficients: number[];
  features: PaceFeature[];
  rmseSeconds: number;
  conditioningRatio: number;
}

function dot(left: number[], right: number[]): number {
  let total = 0;
  for (let index = 0; index < left.length; index += 1) {
    total += left[index] * right[index];
  }
  return total;
}

function featureValue(feature: PaceFeature, lap: NormalizedRaceLap): number {
  if (feature.kind === "intercept") return 1;
  if (feature.kind === "driver") return lap.driverId === feature.value ? 1 : 0;
  if (feature.kind === "lap") return lap.lapNumber;
  if (feature.kind === "compound")
    return lap.compound === feature.value ? 1 : 0;
  return lap.compound === feature.value ? (lap.tyreLife ?? 0) : 0;
}

function buildFeatures(laps: NormalizedRaceLap[]): PaceFeature[] {
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
  return [
    { kind: "intercept" },
    ...drivers
      .slice(1)
      .map((value): PaceFeature => ({ kind: "driver", value })),
    { kind: "lap" },
    ...compounds
      .slice(1)
      .map((value): PaceFeature => ({ kind: "compound", value })),
    ...compounds.map((value): PaceFeature => ({ kind: "degradation", value })),
  ];
}

function solveLeastSquares(
  laps: NormalizedRaceLap[],
  features: PaceFeature[],
): { coefficients: number[]; conditioningRatio: number } | null {
  const rawColumns = features.map((feature) =>
    laps.map((lap) => featureValue(feature, lap)),
  );
  const means = rawColumns.map((column, index) =>
    index === 0
      ? 0
      : column.reduce((sum, value) => sum + value, 0) / column.length,
  );
  const scales = rawColumns.map((column, index) => {
    if (index === 0) return 1;
    const variance =
      column.reduce((sum, value) => sum + (value - means[index]) ** 2, 0) /
      column.length;
    return Math.sqrt(variance);
  });
  if (scales.some((scale) => !Number.isFinite(scale) || scale < 1e-9)) {
    return null;
  }

  const columns = rawColumns.map((column, index) =>
    index === 0
      ? column
      : column.map((value) => (value - means[index]) / scales[index]),
  );
  const qColumns: number[][] = [];
  const upper = features.map(() => features.map(() => 0));
  const diagonals: number[] = [];
  for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
    const vector = [...columns[columnIndex]];
    for (let pass = 0; pass < 2; pass += 1) {
      for (let previous = 0; previous < qColumns.length; previous += 1) {
        const projection = dot(qColumns[previous], vector);
        upper[previous][columnIndex] += projection;
        for (let row = 0; row < vector.length; row += 1) {
          vector[row] -= projection * qColumns[previous][row];
        }
      }
    }
    const norm = Math.sqrt(dot(vector, vector));
    if (!Number.isFinite(norm) || norm < 1e-8) return null;
    upper[columnIndex][columnIndex] = norm;
    diagonals.push(norm);
    qColumns.push(vector.map((value) => value / norm));
  }

  const outcome = laps.map((lap) => lap.lapTimeSeconds as number);
  const transformedOutcome = qColumns.map((column) => dot(column, outcome));
  const standardized = features.map(() => 0);
  for (let row = features.length - 1; row >= 0; row -= 1) {
    let remainder = transformedOutcome[row];
    for (let column = row + 1; column < features.length; column += 1) {
      remainder -= upper[row][column] * standardized[column];
    }
    standardized[row] = remainder / upper[row][row];
  }

  const coefficients = standardized.map(
    (value, index) => value / scales[index],
  );
  coefficients[0] = standardized[0];
  for (let index = 1; index < coefficients.length; index += 1) {
    coefficients[0] -= coefficients[index] * means[index];
  }
  return {
    coefficients,
    conditioningRatio: Math.max(...diagonals) / Math.min(...diagonals),
  };
}

export function fitRacePaceCore(
  laps: NormalizedRaceLap[],
): CoreRacePaceFit | null {
  const features = buildFeatures(laps);
  if (laps.length <= features.length) return null;
  const solved = solveLeastSquares(laps, features);
  if (!solved) return null;
  const squaredErrors = laps.map((lap) => {
    const prediction = features.reduce(
      (sum, feature, index) =>
        sum + solved.coefficients[index] * featureValue(feature, lap),
      0,
    );
    return ((lap.lapTimeSeconds as number) - prediction) ** 2;
  });
  return {
    ...solved,
    features,
    rmseSeconds: Math.sqrt(
      squaredErrors.reduce((sum, value) => sum + value, 0) /
        squaredErrors.length,
    ),
  };
}

export function paceCoefficient(
  fit: CoreRacePaceFit,
  predicate: (feature: PaceFeature) => boolean,
): number {
  const index = fit.features.findIndex(predicate);
  return index >= 0 ? fit.coefficients[index] : 0;
}
