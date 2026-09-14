"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import DailyGameLights from "@/components/games/DailyGameLights";
import type { PanelState } from "@/hooks/useHomeConsole";
import type {
  DailyGameSummaryItem,
  DailyGamesSummary,
} from "@/lib/queries/dailyGames";
import ConsolePanel, { PanelFailure, PanelLabel } from "./ConsolePanel";

const GAME_COPY = {
  grid: "Find the 9 drivers that fit.",
  guess: "Clues and fun facts after each guess.",
};

const ACTION_COPY = {
  not_started: "Play",
  in_progress: "Continue",
  complete: "See result",
};

/* The pattern a hovered clue row resolves to: two on the money, two near
   misses and one cold. Decorative — today's real colours stay on the board. */
const CLUE_REVEAL = ["close", "exact", "miss", "exact", "close"] as const;

function progressCopy(game: DailyGameSummaryItem) {
  const number = game.puzzle_number ? `#${game.puzzle_number}` : "Today";
  if (game.state === "complete") return `${number} · Complete`;
  if (game.state === "not_started") return `${number} · Not started`;
  return game.game === "grid"
    ? `${number} · ${game.progress} of ${game.total} solved`
    : `${number} · ${game.progress} of ${game.total} guesses used`;
}

/** The 3×3 board at stamp size, with today's solved cells already in. */
function GridBoard({ game }: { game: DailyGameSummaryItem }) {
  return (
    <span
      aria-hidden="true"
      className="grid grid-cols-3 gap-[3px] rounded-[5px] bg-surface-page p-[5px]"
    >
      {Array.from({ length: game.total }, (_, index) => {
        const solved = index < game.progress;
        return (
          <i
            key={`cell-${index + 1}`}
            style={{ "--i": index } as CSSProperties}
            className={`game-tile__cell block h-[11px] w-[11px] rounded-[2px] border ${
              solved
                ? "border-success/50 bg-success/25"
                : "game-tile__cell--open border-dashed border-line-strong"
            }`}
          />
        );
      })}
    </span>
  );
}

/** The five-clue row at stamp size, and the light bank with today's guesses. */
function GuessBoard({ game }: { game: DailyGameSummaryItem }) {
  const complete = game.state === "complete";
  return (
    <span aria-hidden="true" className="flex flex-col items-center gap-[6px]">
      <span className="flex gap-[3px]">
        {CLUE_REVEAL.map((reveal, index) => (
          <i
            key={`clue-${index + 1}`}
            style={{ "--i": index } as CSSProperties}
            className={`game-tile__clue block h-[14px] w-[12px] rounded-[3px] ${
              complete
                ? "game-tile__clue--exact"
                : `game-tile__clue--reveal-${reveal}`
            }`}
          />
        ))}
      </span>
      <DailyGameLights spent={game.progress} total={game.total} />
    </span>
  );
}

function GameTile({ game }: { game: DailyGameSummaryItem }) {
  return (
    <Link
      href={game.href}
      className="game-tile group flex flex-1 items-center gap-3 rounded-sm border border-line-soft bg-surface-page px-3 py-2.5 transition-colors hover:border-accent-bright focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-bright"
    >
      <span className="flex w-[64px] flex-none justify-center">
        {game.game === "grid" ? (
          <GridBoard game={game} />
        ) : (
          <GuessBoard game={game} />
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <strong className="text-sm text-ink-strong">{game.name}</strong>
        <span className="text-[11px] text-ink-soft">
          {GAME_COPY[game.game]}
        </span>
        <span className="mt-1 flex items-center justify-between gap-2">
          <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-ink-faint tabular-nums">
            {progressCopy(game)}
          </span>
          <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-accent-bright transition-transform group-hover:translate-x-0.5">
            {ACTION_COPY[game.state]} →
          </span>
        </span>
      </span>
    </Link>
  );
}

export default function DailyGamesCard({
  className = "",
  state,
  summary,
}: {
  className?: string;
  state: PanelState;
  summary?: DailyGamesSummary;
}) {
  return (
    <ConsolePanel
      title="Daily Games"
      label={<PanelLabel>Today</PanelLabel>}
      className={className}
      bodyClassName="flex flex-col"
    >
      {state === "error" ? (
        <PanelFailure message="Today's games could not be loaded." />
      ) : (
        <div className="flex flex-1 flex-col gap-2 p-3">
          {(summary?.games ?? []).map((game) => (
            <GameTile key={game.game} game={game} />
          ))}
          {!summary && (
            <>
              <div className="flex-1 animate-pulse rounded-sm bg-surface-raised" />
              <div className="flex-1 animate-pulse rounded-sm bg-surface-raised" />
            </>
          )}
        </div>
      )}
    </ConsolePanel>
  );
}
