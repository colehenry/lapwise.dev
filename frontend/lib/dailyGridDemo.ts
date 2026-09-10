import type { StandingsResponse } from "@/lib/championshipTypes";

/**
 * A scripted round of the Daily Grid, shown so a first-time visitor can see
 * what the game is before clicking into it.
 *
 * Only one row and one column are ever uncovered, and the face at their
 * intersection is the one claim the board makes: Kimi Antonelli won the 2026
 * Italian Grand Prix for Mercedes. Every other face sits under a header that
 * stays hatched, so the board shows the *shape* of the game — a driver per
 * cell, categories down the side — without asserting anything.
 *
 * This is deliberately hand-written rather than derived. Today's real board is
 * concealed on purpose and its answers are never served to any client, so there
 * is nothing to compute from.
 */

/** The uncovered pair. Both indices are the middle of a three-by-three board. */
export const DEMO_ROW = 1;
export const DEMO_COLUMN = 1;

export const DEMO_ROW_LABEL = "Mercedes";
export const DEMO_COLUMN_LABEL = "Won at Monza";

export type DemoPlacement = {
  row: number;
  column: number;
  /** Resolved against the championship the page already holds. */
  code: string;
  /** A wrong guess costs a life and leaves the cell empty; it does not fill it. */
  correct: boolean;
};

/**
 * The intersection first, then cells whose headers stay covered. None of them
 * share a row or column with the uncovered pair, so none of them are claimed to
 * satisfy `Mercedes` or `Won at Monza`.
 *
 * Leclerc appears twice on purpose: once as a guess that misses, and then in
 * the cell he belongs in. A driver cannot correctly fill two cells of one
 * board, so showing him right twice would be showing something impossible.
 */
export const DEMO_PLACEMENTS: DemoPlacement[] = [
  { row: DEMO_ROW, column: DEMO_COLUMN, code: "ANT", correct: true },
  { row: 0, column: 0, code: "LEC", correct: false },
  { row: 2, column: 2, code: "LEC", correct: true },
  { row: 0, column: 2, code: "SAI", correct: true },
];

export type DemoDriver = {
  code: string;
  name: string;
  headshot: string | null;
};

export type DemoCell = DemoPlacement & { driver: DemoDriver };

/** Looks each placement up in the standings, dropping any driver not racing. */
export function resolveDemoCells(
  standings: StandingsResponse | undefined,
): DemoCell[] {
  const drivers = standings?.drivers ?? [];
  if (drivers.length === 0) return [];

  return DEMO_PLACEMENTS.flatMap((placement) => {
    const driver = drivers.find(
      (candidate) => candidate.driver_code === placement.code,
    );
    if (!driver) return [];
    return [
      {
        ...placement,
        driver: {
          code: placement.code,
          name: driver.full_name,
          headshot: driver.headshot_url,
        },
      },
    ];
  });
}
