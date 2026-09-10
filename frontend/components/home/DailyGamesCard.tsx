"use client";

import Link from "next/link";
import type { PanelState } from "@/hooks/useHomeConsole";
import type { DailyGamesSummary } from "@/lib/queries/dailyGames";
import ConsolePanel, { PanelFailure, PanelLabel } from "./ConsolePanel";

const GAME_COPY = {
  grid: "Connect the grid",
  guess: "Find the mystery driver",
};

const STATE_COPY = {
  not_started: "Ready",
  in_progress: "In progress",
  complete: "Complete",
};

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
            <Link
              key={game.game}
              href={game.href}
              className="group flex flex-1 items-center justify-between gap-3 rounded-sm border border-line-soft bg-surface-page px-3 py-3 transition-colors hover:border-accent-bright focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-bright"
            >
              <span>
                <strong className="block text-sm text-ink-strong">
                  {game.name}
                </strong>
                <span className="mt-0.5 block text-[11px] text-ink-soft">
                  {GAME_COPY[game.game]}
                </span>
              </span>
              <span className="font-mono text-[9px] uppercase tracking-wider text-ink-faint group-hover:text-accent-bright">
                {STATE_COPY[game.state]}
              </span>
            </Link>
          ))}
          {!summary && (
            <>
              <div className="flex-1 animate-pulse rounded-sm bg-surface-raised" />
              <div className="flex-1 animate-pulse rounded-sm bg-surface-raised" />
            </>
          )}
          <Link
            href="/games"
            className="mt-auto flex w-full items-center justify-center rounded-sm border border-accent-bright bg-accent px-4 py-2.5 text-[14px] font-semibold text-ink-strong hover:bg-accent-bright focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-bright"
          >
            Play Daily Games
          </Link>
        </div>
      )}
    </ConsolePanel>
  );
}
