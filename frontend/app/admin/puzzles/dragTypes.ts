export type Game = "grid" | "guess";

/** One MIME type per game, so a Grid chip can only land in a Grid slot. */
export const DRAG_TYPE: Record<Game, string> = {
  grid: "application/x-lapwise-grid",
  guess: "application/x-lapwise-guess",
};

export function readDrag(event: React.DragEvent, game: Game): number | null {
  const raw = event.dataTransfer.getData(DRAG_TYPE[game]);
  return raw ? Number(raw) : null;
}
