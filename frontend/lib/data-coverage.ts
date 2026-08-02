/**
 * First season each class of race data exists for.
 *
 * Charts gate on these rather than on a hardcoded year, and the results page
 * omits any panel whose data does not reach the season being viewed.
 */
export const DATA_FROM = {
  /** Lap times and positions. Jolpica 1996-2017, FastF1 2018+. */
  laps: 1996,
  /** Pit lane times. Jolpica 2011-2017, FastF1 2018+. */
  pitStops: 2011,
  /** FastF1 only: sectors, speed traps, weather, tyre compounds, track status. */
  telemetry: 2018,
} as const;
