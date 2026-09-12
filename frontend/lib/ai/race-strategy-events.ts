import type { NormalizedRaceLap } from "./race-evidence-quality";

export interface PitTransitEvent {
  driverId: number;
  driverCode: string;
  driverName: string;
  teamId: number | null;
  teamName: string | null;
  inLap: number;
  outLap: number;
  pitInTimeSeconds: number;
  pitOutTimeSeconds: number;
  transitSeconds: number;
  beforeCompound: string | null;
  afterCompound: string | null;
  underNeutralization: boolean;
}

export interface UndercutFailure {
  attacker: PitTransitEvent;
  target: PitTransitEvent;
  gapBeforeSeconds: number;
  gapAfterSeconds: number;
  gapChangeSeconds: number;
  newTyreGainSeconds: number;
  comparedNewTyreLaps: number;
  transitDeltaSeconds: number;
}

export interface DoubleStackEvent {
  teamId: number;
  teamName: string;
  lapNumber: number;
  first: PitTransitEvent;
  second: PitTransitEvent;
  arrivalGapSeconds: number;
  secondTransitTaxSeconds: number;
}

function hasNeutralizedStatus(status: string | null): boolean {
  return status ? /[4567]/.test(status) : false;
}

function driverLaps(
  laps: NormalizedRaceLap[],
): Map<number, NormalizedRaceLap[]> {
  const grouped = new Map<number, NormalizedRaceLap[]>();
  for (const lap of laps) {
    grouped.set(lap.driverId, [...(grouped.get(lap.driverId) ?? []), lap]);
  }
  for (const values of grouped.values()) {
    values.sort((a, b) => a.lapNumber - b.lapNumber);
  }
  return grouped;
}

export function raceLapIndex(
  laps: NormalizedRaceLap[],
): Map<string, NormalizedRaceLap> {
  return new Map(laps.map((lap) => [`${lap.driverId}:${lap.lapNumber}`, lap]));
}

function cumulativeElapsedIndex(
  laps: NormalizedRaceLap[],
): Map<string, number> {
  const elapsed = new Map<string, number>();
  for (const [driverId, values] of driverLaps(laps)) {
    let total = 0;
    let complete = true;
    for (const lap of values) {
      if (lap.lapTimeSeconds === null) complete = false;
      else total += lap.lapTimeSeconds;
      if (complete) elapsed.set(`${driverId}:${lap.lapNumber}`, total);
    }
  }
  return elapsed;
}

export function createGapResolver(
  laps: NormalizedRaceLap[],
): (
  behindDriverId: number,
  aheadDriverId: number,
  afterLap: number,
) => number | null {
  const index = raceLapIndex(laps);
  const cumulative = cumulativeElapsedIndex(laps);
  return (behindDriverId, aheadDriverId, afterLap) => {
    const behindNext = index.get(`${behindDriverId}:${afterLap + 1}`);
    const aheadNext = index.get(`${aheadDriverId}:${afterLap + 1}`);
    if (
      behindNext?.lapStartTimeSeconds !== null &&
      behindNext?.lapStartTimeSeconds !== undefined &&
      aheadNext?.lapStartTimeSeconds !== null &&
      aheadNext?.lapStartTimeSeconds !== undefined
    ) {
      return behindNext.lapStartTimeSeconds - aheadNext.lapStartTimeSeconds;
    }
    const behindElapsed = cumulative.get(`${behindDriverId}:${afterLap}`);
    const aheadElapsed = cumulative.get(`${aheadDriverId}:${afterLap}`);
    return behindElapsed === undefined || aheadElapsed === undefined
      ? null
      : behindElapsed - aheadElapsed;
  };
}

export function extractPitTransitEvents(
  laps: NormalizedRaceLap[],
): PitTransitEvent[] {
  const events: PitTransitEvent[] = [];
  const allByDriver = driverLaps(laps);
  for (const values of allByDriver.values()) {
    let pending: NormalizedRaceLap | null = null;
    for (const lap of values) {
      if (lap.pitOutTimeSeconds !== null && pending) {
        const inLap = pending;
        const duration =
          lap.pitOutTimeSeconds - (inLap.pitInTimeSeconds as number);
        if (duration > 0 && Number.isFinite(duration)) {
          events.push({
            driverId: lap.driverId,
            driverCode: lap.driverCode,
            driverName: lap.driverName,
            teamId: lap.teamId,
            teamName: lap.teamName,
            inLap: inLap.lapNumber,
            outLap: lap.lapNumber,
            pitInTimeSeconds: inLap.pitInTimeSeconds as number,
            pitOutTimeSeconds: lap.pitOutTimeSeconds,
            transitSeconds: duration,
            beforeCompound: inLap.compound,
            afterCompound: lap.compound,
            underNeutralization: values
              .filter(
                (value) =>
                  value.lapNumber >= inLap.lapNumber &&
                  value.lapNumber <= lap.lapNumber,
              )
              .some((value) => hasNeutralizedStatus(value.trackStatus)),
          });
        }
        pending = null;
      }
      if (lap.pitInTimeSeconds !== null) pending = lap;
    }
  }
  return events.sort(
    (a, b) => a.inLap - b.inLap || a.pitInTimeSeconds - b.pitInTimeSeconds,
  );
}

function cleanComparisonLap(lap: NormalizedRaceLap | undefined): boolean {
  return Boolean(
    lap &&
      lap.lapTimeSeconds !== null &&
      lap.trackStatus === "1" &&
      !lap.isDeleted &&
      lap.pitInTimeSeconds === null &&
      lap.pitOutTimeSeconds === null,
  );
}

function newTyreGain(
  attacker: PitTransitEvent,
  target: PitTransitEvent,
  index: Map<string, NormalizedRaceLap>,
): { seconds: number; laps: number } {
  let seconds = 0;
  let compared = 0;
  for (
    let lapNumber = attacker.outLap + 1;
    lapNumber < target.inLap;
    lapNumber += 1
  ) {
    const attackerLap = index.get(`${attacker.driverId}:${lapNumber}`);
    const targetLap = index.get(`${target.driverId}:${lapNumber}`);
    if (!cleanComparisonLap(attackerLap) || !cleanComparisonLap(targetLap))
      continue;
    seconds +=
      (targetLap?.lapTimeSeconds as number) -
      (attackerLap?.lapTimeSeconds as number);
    compared += 1;
  }
  return { seconds, laps: compared };
}

export function findUndercutFailures(
  laps: NormalizedRaceLap[],
  stops: PitTransitEvent[],
): UndercutFailure[] {
  const index = raceLapIndex(laps);
  const gapAt = createGapResolver(laps);
  const failures: UndercutFailure[] = [];
  for (const attacker of stops) {
    if (attacker.underNeutralization || attacker.transitSeconds >= 60) continue;
    for (const target of stops) {
      const stopDelta = target.inLap - attacker.inLap;
      if (
        attacker.driverId === target.driverId ||
        target.underNeutralization ||
        target.transitSeconds >= 60 ||
        stopDelta < 1 ||
        stopDelta > 4
      ) {
        continue;
      }
      const beforeLap = attacker.inLap - 1;
      const attackerBefore = index.get(`${attacker.driverId}:${beforeLap}`);
      const targetBefore = index.get(`${target.driverId}:${beforeLap}`);
      if (
        attackerBefore?.position === null ||
        targetBefore?.position === null ||
        (attackerBefore?.position ?? 0) <= (targetBefore?.position ?? 0)
      ) {
        continue;
      }
      const gapBefore = gapAt(attacker.driverId, target.driverId, beforeLap);
      const gapAfter = gapAt(attacker.driverId, target.driverId, target.outLap);
      if (
        gapBefore === null ||
        gapAfter === null ||
        gapBefore <= 0 ||
        gapBefore > 5 ||
        gapAfter <= 0
      ) {
        continue;
      }
      const tyreGain = newTyreGain(attacker, target, index);
      failures.push({
        attacker,
        target,
        gapBeforeSeconds: gapBefore,
        gapAfterSeconds: gapAfter,
        gapChangeSeconds: gapAfter - gapBefore,
        newTyreGainSeconds: tyreGain.seconds,
        comparedNewTyreLaps: tyreGain.laps,
        transitDeltaSeconds: attacker.transitSeconds - target.transitSeconds,
      });
    }
  }
  return failures.sort(
    (a, b) =>
      Math.abs(b.gapChangeSeconds) +
      Math.abs(b.transitDeltaSeconds) +
      Math.abs(b.newTyreGainSeconds) -
      (Math.abs(a.gapChangeSeconds) +
        Math.abs(a.transitDeltaSeconds) +
        Math.abs(a.newTyreGainSeconds)),
  );
}

export function findDoubleStacks(stops: PitTransitEvent[]): DoubleStackEvent[] {
  const events: DoubleStackEvent[] = [];
  for (let leftIndex = 0; leftIndex < stops.length; leftIndex += 1) {
    const left = stops[leftIndex];
    if (left.teamId === null || left.transitSeconds >= 60) continue;
    for (const right of stops.slice(leftIndex + 1)) {
      if (
        right.teamId !== left.teamId ||
        right.inLap !== left.inLap ||
        right.driverId === left.driverId ||
        right.transitSeconds >= 60
      ) {
        continue;
      }
      const [first, second] =
        left.pitInTimeSeconds <= right.pitInTimeSeconds
          ? [left, right]
          : [right, left];
      const arrivalGap = second.pitInTimeSeconds - first.pitInTimeSeconds;
      if (arrivalGap > 10) continue;
      events.push({
        teamId: left.teamId,
        teamName: left.teamName ?? right.teamName ?? `Team ${left.teamId}`,
        lapNumber: left.inLap,
        first,
        second,
        arrivalGapSeconds: arrivalGap,
        secondTransitTaxSeconds: second.transitSeconds - first.transitSeconds,
      });
    }
  }
  return events.sort(
    (a, b) => b.secondTransitTaxSeconds - a.secondTransitTaxSeconds,
  );
}
