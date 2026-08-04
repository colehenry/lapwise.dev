/**
 * Cache durations for query options, in the milliseconds React Query expects.
 *
 * One spelling, one ordering. Bare millisecond arithmetic inside
 * `lib/queries/` is a guardrail violation: `1000 * 60 * 5` and `5 * 60 * 1000`
 * are the same number written two ways, and both appeared here.
 */

export function minutes(n: number): number {
  return n * 60_000;
}

export function hours(n: number): number {
  return n * 3_600_000;
}
