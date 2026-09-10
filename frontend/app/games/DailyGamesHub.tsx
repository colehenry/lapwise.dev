"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useDailyGamePlayer } from "@/hooks/useDailyGamePlayer";
import {
  type DailyGameSummaryItem,
  dailyGamesSummaryQuery,
} from "@/lib/queries/dailyGames";

const DESCRIPTION = {
  grid: "Find the driver who connects each pair of Formula 1 categories.",
  guess: "Identify a mystery driver from five career comparisons and facts.",
};

const STATE_LABEL = {
  not_started: "Not started",
  in_progress: "In progress",
  complete: "Complete",
};

function GameEntry({ game }: { game: DailyGameSummaryItem }) {
  const action = game.state === "not_started" ? "Play" : "Continue";
  return (
    <article className="flex min-h-56 flex-col rounded-lg border border-line-soft bg-surface-band p-6">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-xl font-bold text-ink-strong">{game.name}</h2>
        <span className="rounded-full border border-line-strong px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-ink-soft">
          {STATE_LABEL[game.state]}
        </span>
      </div>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink-soft">
        {DESCRIPTION[game.game]}
      </p>
      <Link
        href={game.href}
        className="mt-auto inline-flex w-fit items-center rounded-sm border border-accent-bright bg-accent px-4 py-2 text-sm font-semibold text-ink-strong hover:bg-accent-bright focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-bright"
      >
        {action} {game.name}
      </Link>
    </article>
  );
}

export default function DailyGamesHub() {
  const playerId = useDailyGamePlayer();
  const summary = useQuery(dailyGamesSummaryQuery(playerId));
  return (
    <div className="min-h-[calc(100vh-52px)] bg-surface-page">
      <div className="page-frame mx-auto max-w-5xl py-12 sm:py-16">
        <h1 className="text-3xl font-extrabold tracking-tight text-ink-strong">
          Daily Games
        </h1>
        {summary.isError ? (
          <p className="mt-8 text-sm text-danger-bright">
            Today&apos;s games could not be loaded.
          </p>
        ) : summary.data ? (
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {summary.data.games.map((game) => (
              <GameEntry key={game.game} game={game} />
            ))}
          </div>
        ) : (
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {["grid", "guess"].map((game) => (
              <div
                key={game}
                className="h-56 animate-pulse rounded-lg border border-line-soft bg-surface-band"
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
