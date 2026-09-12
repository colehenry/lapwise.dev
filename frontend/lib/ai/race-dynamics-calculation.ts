import {
  finiteNumber as asNumber,
  nonEmptyText as asString,
} from "./race-evidence-quality";

type DataRow = Record<string, unknown>;
export interface RacePositionPath {
  driverCode: string;
  driverName: string;
  grid: number | null;
  lap1: number | null;
  best: number | null;
  worst: number | null;
  finish: number | null;
  lapsLed: number;
  firstP1Lap: number | null;
}
export interface RacePitStop {
  driverCode: string;
  lapRange: string | null;
  inLap: number | null;
  outLap: number | null;
  compound: string | null;
  underScOrVsc: boolean;
}
export interface RaceStintSummary {
  driverCode: string;
  driverName: string;
  stint: number;
  compound: string | null;
  startLap: number;
  endLap: number;
  lapCount: number;
  medianCleanLapSeconds: number | null;
}
export interface RaceDynamicsEvidence {
  sessionId: number;
  finalResults: DataRow[];
  leaderTimeline: string[];
  lapsLed: Record<string, number>;
  neutralizedLaps: {
    safetyCar: string[];
    virtualSafetyCar: string[];
    redFlag: string[];
  };
  positionPaths: RacePositionPath[];
  pitStops: RacePitStop[];
  stintSummaries: RaceStintSummary[];
  raceControl: DataRow[];
  evidenceRules: string[];
}

function compressRanges(numbers: number[]): string[] {
  if (numbers.length === 0) return [];
  const ranges: string[] = [];
  let start = numbers[0];
  let previous = numbers[0];
  for (const number of numbers.slice(1)) {
    if (number === previous + 1) {
      previous = number;
      continue;
    }
    ranges.push(start === previous ? `L${start}` : `L${start}-L${previous}`);
    start = number;
    previous = number;
  }
  ranges.push(start === previous ? `L${start}` : `L${start}-L${previous}`);
  return ranges;
}

function compressLeaders(
  leaders: Array<{ lapNumber: number; driverCode: string }>,
): string[] {
  if (leaders.length === 0) return [];
  const segments: string[] = [];
  let { lapNumber: start, driverCode } = leaders[0];
  let end = start;
  for (const leader of leaders.slice(1)) {
    if (leader.driverCode === driverCode && leader.lapNumber === end + 1) {
      end = leader.lapNumber;
      continue;
    }
    segments.push(
      `${start === end ? `L${start}` : `L${start}-L${end}`} ${driverCode}`,
    );
    start = leader.lapNumber;
    end = leader.lapNumber;
    driverCode = leader.driverCode;
  }
  segments.push(
    `${start === end ? `L${start}` : `L${start}-L${end}`} ${driverCode}`,
  );
  return segments;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function isNeutralized(trackStatus: string | null): boolean {
  return trackStatus ? /[4567]/.test(trackStatus) : false;
}

export function calculateRaceDynamics(params: {
  sessionId: number;
  results: DataRow[];
  laps: DataRow[];
  raceControl: DataRow[];
  driverCodes?: string[];
}): RaceDynamicsEvidence {
  const resultByDriver = new Map<number, DataRow>();
  const codeByDriver = new Map<number, string>();
  const nameByDriver = new Map<number, string>();
  for (const row of params.results) {
    const driverId = asNumber(row.driver_id);
    if (driverId === null) continue;
    resultByDriver.set(driverId, row);
    codeByDriver.set(
      driverId,
      asString(row.driver_code) ?? asString(row.full_name) ?? `${driverId}`,
    );
    nameByDriver.set(
      driverId,
      asString(row.full_name) ?? asString(row.driver_code) ?? `${driverId}`,
    );
  }

  const leaders: Array<{ lapNumber: number; driverCode: string }> = [];
  const lapsLed = new Map<string, number>();
  const lapsByDriver = new Map<number, DataRow[]>();
  const statusLaps = new Map<string, Set<number>>();
  for (const row of params.laps) {
    const driverId = asNumber(row.driver_id);
    const lapNumber = asNumber(row.lap_number);
    if (driverId === null || lapNumber === null) continue;
    const driverCode =
      asString(row.driver_code) ?? codeByDriver.get(driverId) ?? `${driverId}`;
    codeByDriver.set(driverId, driverCode);
    nameByDriver.set(
      driverId,
      asString(row.full_name) ?? nameByDriver.get(driverId) ?? driverCode,
    );
    lapsByDriver.set(driverId, [...(lapsByDriver.get(driverId) ?? []), row]);
    if (asNumber(row.position) === 1) {
      leaders.push({ lapNumber, driverCode });
      lapsLed.set(driverCode, (lapsLed.get(driverCode) ?? 0) + 1);
    }
    for (const status of asString(row.track_status) ?? "") {
      if (!["4", "5", "6", "7"].includes(status)) continue;
      const existing = statusLaps.get(status) ?? new Set<number>();
      existing.add(lapNumber);
      statusLaps.set(status, existing);
    }
  }

  const requestedCodes = new Set(
    (params.driverCodes ?? []).map((code) => code.toUpperCase()),
  );
  const selectedDriverIds = params.results
    .filter((row) => {
      const position = asNumber(row.position);
      const code = asString(row.driver_code)?.toUpperCase();
      return (
        (position !== null && position <= 10) ||
        Boolean(code && requestedCodes.has(code))
      );
    })
    .map((row) => asNumber(row.driver_id))
    .filter((id): id is number => id !== null);

  const positionPaths = selectedDriverIds.map((driverId) => {
    const driverLaps = lapsByDriver.get(driverId) ?? [];
    const positions = driverLaps
      .map((lap) => asNumber(lap.position))
      .filter((position): position is number => position !== null);
    const result = resultByDriver.get(driverId);
    const code = codeByDriver.get(driverId) ?? `${driverId}`;
    return {
      driverCode: code,
      driverName: nameByDriver.get(driverId) ?? code,
      grid: result ? asNumber(result.grid_position) : null,
      lap1: asNumber(
        driverLaps.find((lap) => asNumber(lap.lap_number) === 1)?.position,
      ),
      best: positions.length > 0 ? Math.min(...positions) : null,
      worst: positions.length > 0 ? Math.max(...positions) : null,
      finish: result ? asNumber(result.position) : null,
      lapsLed: lapsLed.get(code) ?? 0,
      firstP1Lap: asNumber(
        driverLaps.find((lap) => asNumber(lap.position) === 1)?.lap_number,
      ),
    };
  });

  const scVscLaps = new Set<number>([
    ...(statusLaps.get("4") ?? []),
    ...(statusLaps.get("6") ?? []),
  ]);
  const pitStops: RacePitStop[] = [];
  const stintSummaries: RaceStintSummary[] = [];
  for (const driverId of selectedDriverIds) {
    const driverLaps = lapsByDriver.get(driverId) ?? [];
    let pendingInLap: number | null = null;
    const stints = new Map<number, DataRow[]>();
    for (const lap of driverLaps) {
      const lapNumber = asNumber(lap.lap_number);
      const stint = asNumber(lap.stint);
      if (stint !== null)
        stints.set(stint, [...(stints.get(stint) ?? []), lap]);
      if (asNumber(lap.pit_in_time_seconds) !== null) pendingInLap = lapNumber;
      if (asNumber(lap.pit_out_time_seconds) === null) continue;
      const outLap = lapNumber;
      const inLap = pendingInLap ?? outLap;
      const affectedLaps =
        inLap !== null && outLap !== null
          ? Array.from(
              { length: Math.abs(outLap - inLap) + 1 },
              (_, index) => Math.min(inLap, outLap) + index,
            )
          : [];
      pitStops.push({
        driverCode: codeByDriver.get(driverId) ?? `${driverId}`,
        lapRange: inLap === outLap ? `L${inLap}` : `L${inLap}-L${outLap}`,
        inLap,
        outLap,
        compound: asString(lap.compound),
        underScOrVsc: affectedLaps.some((number) => scVscLaps.has(number)),
      });
      pendingInLap = null;
    }
    for (const [stint, stintLaps] of stints) {
      const lapNumbers = stintLaps
        .map((lap) => asNumber(lap.lap_number))
        .filter((lap): lap is number => lap !== null);
      if (lapNumbers.length === 0) continue;
      const cleanTimes = stintLaps
        .filter(
          (lap) =>
            lap.is_accurate === true &&
            lap.deleted !== true &&
            !isNeutralized(asString(lap.track_status)),
        )
        .map((lap) => asNumber(lap.lap_time_seconds))
        .filter((time): time is number => time !== null);
      stintSummaries.push({
        driverCode: codeByDriver.get(driverId) ?? `${driverId}`,
        driverName: nameByDriver.get(driverId) ?? `${driverId}`,
        stint,
        compound: asString(
          stintLaps.find((lap) => asString(lap.compound))?.compound,
        ),
        startLap: Math.min(...lapNumbers),
        endLap: Math.max(...lapNumbers),
        lapCount: lapNumbers.length,
        medianCleanLapSeconds: median(cleanTimes),
      });
    }
  }

  return {
    sessionId: params.sessionId,
    finalResults: params.results.slice(0, 10),
    leaderTimeline: compressLeaders(leaders),
    lapsLed: Object.fromEntries(
      [...lapsLed.entries()].sort((a, b) => b[1] - a[1]),
    ),
    neutralizedLaps: {
      safetyCar: compressRanges(
        [...(statusLaps.get("4") ?? [])].sort((a, b) => a - b),
      ),
      virtualSafetyCar: compressRanges(
        [...(statusLaps.get("6") ?? [])].sort((a, b) => a - b),
      ),
      redFlag: compressRanges(
        [...(statusLaps.get("5") ?? [])].sort((a, b) => a - b),
      ),
    },
    positionPaths,
    pitStops,
    stintSummaries,
    raceControl: params.raceControl,
    evidenceRules: [
      "Led from pole to flag requires grid P1, lap 1 P1, every leader segment matching the winner, and finish P1.",
      "Dominance requires lap-position, pace, or laps-led evidence; final margin alone is insufficient.",
      "SC/VSC benefit requires pit or position evidence overlapping neutralized laps.",
    ],
  };
}
