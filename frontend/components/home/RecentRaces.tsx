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
 * Cards rather than rows. As five identical rows the podium was crushed into an
 * invisible column on the right with a dead gutter down the middle; stacked, the
 * winner leads and the circuit fills the space that was empty.
 */
function RaceCard({
  round,
  season,
}: {
  round: RoundSummary;
  season: number | null;
}) {
  const tint = useTeamTint();
  const [winner, ...rest] = round.podium ?? [];

  return (
    <Link
      href={`/results/${season}/${round.round}`}
      className="group relative flex flex-col overflow-hidden rounded-sm border border-line-soft bg-surface-panel p-3.5 transition-colors hover:border-accent"
    >
      <CircuitOutline
        circuitId={round.circuit_id}
        circuitName={round.circuit_name}
        className="pointer-events-none absolute -right-4 top-2 h-[92px] w-[132px]"
        opacity={0.5}
      />

      <div className="relative flex items-center gap-2">
        <span className="font-mono text-[10px] tabular-nums text-ink-faint">
          R{String(round.round).padStart(2, "0")}
        </span>
        <span className="font-mono text-[10px] tabular-nums text-ink-faint">
          {utcDate(round.date, { day: "numeric", month: "short" })}
        </span>
      </div>

      <div className="relative mt-3 flex items-center gap-2.5">
        <DriverHeadshot
          code={winner?.driver_code}
          fullName={winner?.full_name ?? "—"}
          src={winner?.headshot_url}
          size={44}
          shape="circle"
          bordered={false}
          focalY={0.12}
        />
        <span className="min-w-0">
          <span
            className="block truncate text-[15px] font-bold tracking-[-0.015em]"
            style={{ color: tint(winner?.team_color) }}
          >
            {winner?.full_name ?? "—"}
          </span>
          <span className="mt-0.5 block truncate font-mono text-[9px] uppercase tracking-[0.12em] text-ink-faint">
            {round.circuit_name}
          </span>
        </span>
      </div>

      <div className="relative mt-3 flex flex-col gap-1.5 border-t border-line-soft/60 pt-2.5">
        {rest.slice(0, 2).map((driver, index) => (
          <span
            key={driver.driver_code ?? driver.full_name}
            className="grid grid-cols-[12px_20px_minmax(0,1fr)_auto] items-center gap-2"
          >
            <span className="font-mono text-[10px] tabular-nums text-ink-faint">
              {index + 2}
            </span>
            <DriverHeadshot
              code={driver.driver_code}
              fullName={driver.full_name}
              src={driver.headshot_url}
              size={20}
              shape="circle"
              bordered={false}
              focalY={0.12}
            />
            <span className="truncate text-[12px] text-ink-base">
              {driver.full_name}
            </span>
            <span className="font-mono text-[10px] tabular-nums text-ink-soft">
              {gapLabel(driver.time_seconds)}
            </span>
          </span>
        ))}
      </div>
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
    <section>
      <div className="mb-3 flex items-baseline justify-between gap-3">
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
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {rounds.map((round) => (
            <RaceCard key={round.round} round={round} season={season} />
          ))}
        </div>
      )}
    </section>
  );
}
