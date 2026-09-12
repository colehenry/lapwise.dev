export type RaceDataRow = Record<string, unknown>;

const DRY_COMPOUNDS = new Set(["SOFT", "MEDIUM", "HARD"]);

export interface NormalizedRaceLap {
  driverId: number;
  driverCode: string;
  driverName: string;
  teamId: number | null;
  teamName: string | null;
  lapNumber: number;
  position: number | null;
  lapTimeSeconds: number | null;
  lapStartTimeSeconds: number | null;
  pitInTimeSeconds: number | null;
  pitOutTimeSeconds: number | null;
  stint: number | null;
  compound: string | null;
  tyreLife: number | null;
  trackStatus: string | null;
  isAccurate: boolean;
  isDeleted: boolean;
}

export interface RaceDataCoverage {
  inputRows: number;
  timedRows: number;
  richRows: number;
  cleanPaceRows: number;
  driverCount: number;
  compoundCount: number;
  stintCount: number;
  completePitMarkers: number;
  supportsPaceModel: boolean;
  supportsPitStrategy: boolean;
  limitations: string[];
}

export interface CleanPaceSelection {
  laps: NormalizedRaceLap[];
  excluded: Record<string, number>;
}

export function finiteNumber(value: unknown): number | null {
  if (value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function nonEmptyText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function median(values: number[]): number | null {
  return quantile(values, 0.5);
}

export function quantile(values: number[], probability: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * Math.min(1, Math.max(0, probability));
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

export function normalizeRaceLaps(rows: RaceDataRow[]): NormalizedRaceLap[] {
  const laps: NormalizedRaceLap[] = [];
  for (const row of rows) {
    const driverId = finiteNumber(row.driver_id);
    const lapNumber = finiteNumber(row.lap_number);
    if (driverId === null || lapNumber === null) continue;
    const driverName =
      nonEmptyText(row.full_name) ?? nonEmptyText(row.driver_code);
    if (!driverName) continue;
    laps.push({
      driverId,
      driverCode: nonEmptyText(row.driver_code) ?? driverName,
      driverName,
      teamId: finiteNumber(row.team_id),
      teamName: nonEmptyText(row.team_name),
      lapNumber,
      position: finiteNumber(row.position),
      lapTimeSeconds: finiteNumber(row.lap_time_seconds),
      lapStartTimeSeconds: finiteNumber(row.lap_start_time_seconds),
      pitInTimeSeconds: finiteNumber(row.pit_in_time_seconds),
      pitOutTimeSeconds: finiteNumber(row.pit_out_time_seconds),
      stint: finiteNumber(row.stint),
      compound: nonEmptyText(row.compound)?.toUpperCase() ?? null,
      tyreLife: finiteNumber(row.tyre_life),
      trackStatus: nonEmptyText(row.track_status),
      isAccurate: row.is_accurate === true,
      isDeleted: row.deleted === true,
    });
  }
  return laps.sort(
    (a, b) => a.driverId - b.driverId || a.lapNumber - b.lapNumber,
  );
}

function increment(counts: Record<string, number>, reason: string): void {
  counts[reason] = (counts[reason] ?? 0) + 1;
}

function pitAdjacentKeys(laps: NormalizedRaceLap[]): Set<string> {
  const keys = new Set<string>();
  for (const lap of laps) {
    if (lap.pitInTimeSeconds === null && lap.pitOutTimeSeconds === null)
      continue;
    for (let offset = -1; offset <= 1; offset += 1) {
      keys.add(`${lap.driverId}:${lap.lapNumber + offset}`);
    }
  }
  return keys;
}

export function selectCleanPaceLaps(
  laps: NormalizedRaceLap[],
): CleanPaceSelection {
  const excluded: Record<string, number> = {};
  const pitAdjacent = pitAdjacentKeys(laps);
  const candidates: NormalizedRaceLap[] = [];
  for (const lap of laps) {
    let reason: string | null = null;
    if (lap.lapTimeSeconds === null) reason = "missing_or_non_finite_time";
    else if (lap.lapNumber <= 2) reason = "opening_lap";
    else if (!lap.isAccurate) reason = "inaccurate";
    else if (lap.isDeleted) reason = "deleted";
    else if (lap.trackStatus !== "1") reason = "not_all_green";
    else if (!lap.compound || !DRY_COMPOUNDS.has(lap.compound))
      reason = "unsupported_compound";
    else if (lap.tyreLife === null || lap.stint === null)
      reason = "missing_stint_or_tyre_age";
    else if (pitAdjacent.has(`${lap.driverId}:${lap.lapNumber}`))
      reason = "pit_adjacent";
    if (reason) increment(excluded, reason);
    else candidates.push(lap);
  }

  const fieldTimes = new Map<number, number[]>();
  for (const lap of candidates) {
    const times = fieldTimes.get(lap.lapNumber) ?? [];
    times.push(lap.lapTimeSeconds as number);
    fieldTimes.set(lap.lapNumber, times);
  }
  const fieldMedian = new Map<number, number>();
  for (const [lapNumber, times] of fieldTimes) {
    const value = median(times);
    if (value !== null) fieldMedian.set(lapNumber, value);
  }

  const clean = candidates.filter((lap) => {
    const reference = fieldMedian.get(lap.lapNumber);
    if (
      reference === undefined ||
      Math.abs((lap.lapTimeSeconds as number) / reference - 1) > 0.04
    ) {
      increment(excluded, "field_outlier");
      return false;
    }
    return true;
  });
  return { laps: clean, excluded };
}

function countCompletePitMarkers(laps: NormalizedRaceLap[]): number {
  const pending = new Map<number, number>();
  let count = 0;
  for (const lap of laps) {
    if (lap.pitOutTimeSeconds !== null && pending.has(lap.driverId)) {
      count += 1;
      pending.delete(lap.driverId);
    }
    if (lap.pitInTimeSeconds !== null) pending.set(lap.driverId, lap.lapNumber);
  }
  return count;
}

export function evaluateRaceDataCoverage(
  laps: NormalizedRaceLap[],
): RaceDataCoverage {
  const selection = selectCleanPaceLaps(laps);
  const timed = laps.filter((lap) => lap.lapTimeSeconds !== null);
  const rich = timed.filter(
    (lap) =>
      lap.compound !== null && lap.tyreLife !== null && lap.stint !== null,
  );
  const completePitMarkers = countCompletePitMarkers(laps);
  const driverCount = new Set(selection.laps.map((lap) => lap.driverId)).size;
  const compoundCount = new Set(selection.laps.map((lap) => lap.compound)).size;
  const stintCount = new Set(
    selection.laps.map((lap) => `${lap.driverId}:${lap.stint}`),
  ).size;
  const supportsPaceModel =
    selection.laps.length >= 80 && driverCount >= 4 && compoundCount >= 2;
  const supportsPitStrategy = completePitMarkers >= 2;
  const limitations: string[] = [];
  if (timed.length === 0)
    limitations.push("No finite lap times are available.");
  if (rich.length < 80)
    limitations.push("Rich tyre and stint coverage is too sparse.");
  if (!supportsPaceModel)
    limitations.push(
      "There is not enough clean, overlapping data for a pace model.",
    );
  if (!supportsPitStrategy)
    limitations.push("There are too few complete pit entry/exit markers.");
  return {
    inputRows: laps.length,
    timedRows: timed.length,
    richRows: rich.length,
    cleanPaceRows: selection.laps.length,
    driverCount,
    compoundCount,
    stintCount,
    completePitMarkers,
    supportsPaceModel,
    supportsPitStrategy,
    limitations,
  };
}
