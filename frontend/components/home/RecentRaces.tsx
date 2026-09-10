"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import DriverHeadshot from "@/components/entities/DriverHeadshot";
import { useTeamTint } from "@/hooks/useTeamTint";
import { gapLabel, utcDate } from "@/lib/consoleFormat";
import { seasonRoundsQuery, selectUniqueRounds } from "@/lib/queries/seasons";
import type { RoundSummary } from "@/lib/types";
import CircuitOutline from "./CircuitOutline";
import { PanelFailure, PanelLabel } from "./ConsolePanel";

/** Enough to show the shape of the season's recent form. */
const CARD_COUNT = 4;

/**
 * One card per round, sized to end level with the next-race card beside it.
 *
 * The gap column is real now: the season listing populates `time_seconds` on
 * the podium, so P2 and P3 carry their margin instead of an em dash, and the
 * winner's cell says what winning means.
 */
function RaceCard({
  round,
  season,
}: {
  round: RoundSummary;
  season: number | null;
}) {
  const tint = useTeamTint();
  const podium = (round.podium ?? []).slice(0, 3);

  return (
    <Link
      href={`/results/${season}/${round.round}`}
      className="group flex h-full flex-col rounded-sm border border-line-soft bg-surface-panel p-3.5 transition-colors hover:border-accent"
    >
      <p className="m-0 text-[16px] font-bold leading-[1.15] tracking-[-0.02em] text-ink-strong">
        {round.event_name}
      </p>
      <p className="m-0 mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
        Round {round.round} ·{" "}
        {utcDate(round.date, { day: "numeric", month: "short" })}
      </p>

      {/* A band of its own, so every circuit sits in the same place at the
          same vertical size however differently shaped it is. */}
      <div className="my-3 flex h-[78px] items-center justify-center overflow-hidden">
        <CircuitOutline
          circuitId={round.circuit_id}
          circuitName={round.circuit_name}
          className="h-full w-full transition-transform duration-300 ease-out group-hover:scale-110"
          stroke="var(--ink-soft)"
          strokeWidth={1.5}
        />
      </div>

      <div className="flex flex-col gap-2">
        {podium.map((driver, index) => (
          <span
            key={driver.driver_code ?? driver.full_name}
            className="grid grid-cols-[10px_auto_minmax(0,1fr)] items-center gap-2"
          >
            <span className="font-mono text-[10px] tabular-nums text-ink-faint">
              {index + 1}
            </span>
            <DriverHeadshot
              code={driver.driver_code}
              fullName={driver.full_name}
              src={driver.headshot_url}
              size={index === 0 ? 32 : 26}
              shape="circle"
              bordered={false}
              focalY={0.12}
            />
            <span className="min-w-0">
              <span
                className={`block truncate ${
                  index === 0
                    ? "text-[13.5px] font-bold tracking-[-0.01em]"
                    : "text-[12.5px] font-semibold"
                }`}
                style={{ color: tint(driver.team_color) }}
              >
                {driver.full_name}
              </span>
              <span className="mt-px block font-mono text-[9px] uppercase tracking-[0.1em] text-ink-faint">
                {index === 0 ? "Winner" : gapLabel(driver.time_seconds)}
              </span>
            </span>
          </span>
        ))}
      </div>

      <span className="mt-auto flex origin-left items-center gap-1.5 pt-3 font-mono text-[9.5px] uppercase tracking-[0.14em] text-accent-bright transition-transform duration-200 ease-out group-hover:scale-110">
        Race details
        <span
          aria-hidden="true"
          className="transition-transform duration-200 group-hover:translate-x-1"
        >
          →
        </span>
      </span>
    </Link>
  );
}

export default function RecentRaces({ season }: { season: number | null }) {
  const { data, isError, refetch } = useQuery({
    ...seasonRoundsQuery(season),
    select: selectUniqueRounds,
  });

  const rounds = [...(data ?? [])]
    .sort((a, b) => b.round - a.round)
    .slice(0, CARD_COUNT);

  return (
    <section className="flex h-full flex-col">
      <div className="mb-3 flex flex-none items-baseline justify-between gap-3">
        <h2 className="m-0 text-[14px] font-bold tracking-[-0.01em] text-ink-strong">
          Recent races
        </h2>
        <PanelLabel>{season ?? ""}</PanelLabel>
      </div>

      {isError ? (
        <div className="rounded-sm border border-line-soft bg-surface-panel">
          <PanelFailure
            message="Recent results could not be loaded."
            onRetry={() => void refetch()}
          />
        </div>
      ) : (
        <div className="grid h-full gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {rounds.map((round) => (
            <RaceCard key={round.round} round={round} season={season} />
          ))}
        </div>
      )}
    </section>
  );
}
