"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import DriverHeadshot from "@/components/entities/DriverHeadshot";
import { useTeamTint } from "@/hooks/useTeamTint";
import { utcDate } from "@/lib/consoleFormat";
import { seasonRoundsQuery, selectUniqueRounds } from "@/lib/queries/seasons";
import type { RoundSummary } from "@/lib/types";
import CircuitOutline from "./CircuitOutline";
import { PanelFailure, PanelLabel } from "./ConsolePanel";

/** Enough to show the shape of the season's recent form. */
const CARD_COUNT = 4;

/**
 * Cards rather than rows, and built only from fields the season listing
 * actually fills.
 *
 * The podium's `time_seconds` is null on every entry here — it is only
 * populated on the round detail — so the gap column those cards carried had
 * never shown anything but an em dash three times over. Teams and the circuit
 * are real, so they take its place, and the circuit outline gets a box of its
 * own instead of bleeding out of the corner.
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
  const where = [round.circuit_location, round.circuit_country]
    .filter(Boolean)
    .join(", ");

  return (
    <Link
      href={`/results/${season}/${round.round}`}
      className="flex flex-col gap-3 rounded-sm border border-line-soft bg-surface-panel p-3.5 transition-colors hover:border-accent"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-[11px] tabular-nums text-ink-base">
              R{String(round.round).padStart(2, "0")}
            </span>
            <span className="font-mono text-[10px] tabular-nums text-ink-faint">
              {utcDate(round.date, { day: "numeric", month: "short" })}
            </span>
          </div>
          <p className="m-0 mt-1 truncate font-mono text-[9px] uppercase tracking-[0.12em] text-ink-faint">
            {round.circuit_name}
          </p>
        </div>
        <CircuitOutline
          circuitId={round.circuit_id}
          circuitName={round.circuit_name}
          className="h-[46px] w-[74px] flex-none"
          opacity={0.75}
        />
      </div>

      <div className="flex items-center gap-2.5">
        <DriverHeadshot
          code={winner?.driver_code}
          fullName={winner?.full_name ?? "—"}
          src={winner?.headshot_url}
          size={38}
          shape="circle"
          bordered={false}
          focalY={0.12}
        />
        <span className="min-w-0">
          <span
            className="block truncate text-[14px] font-bold tracking-[-0.015em]"
            style={{ color: tint(winner?.team_color) }}
          >
            {winner?.full_name ?? "—"}
          </span>
          <span className="mt-0.5 block truncate font-mono text-[9px] uppercase tracking-[0.12em] text-ink-faint">
            {winner?.team_name}
            {winner?.fastest_lap && " · Fastest lap"}
          </span>
        </span>
      </div>

      <div className="flex flex-col gap-1.5 border-t border-line-soft/60 pt-2.5">
        {rest.slice(0, 2).map((driver, index) => (
          <span
            key={driver.driver_code ?? driver.full_name}
            className="grid grid-cols-[10px_18px_minmax(0,1fr)] items-center gap-2"
          >
            <span className="font-mono text-[10px] tabular-nums text-ink-faint">
              {index + 2}
            </span>
            <DriverHeadshot
              code={driver.driver_code}
              fullName={driver.full_name}
              src={driver.headshot_url}
              size={18}
              shape="circle"
              bordered={false}
              focalY={0.12}
            />
            <span className="truncate text-[12px] text-ink-base">
              {driver.full_name}
              <span className="ml-1.5 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-faint">
                {driver.team_name}
              </span>
            </span>
          </span>
        ))}
      </div>

      {where && (
        <p className="m-0 mt-auto truncate font-mono text-[9px] uppercase tracking-[0.12em] text-ink-faint">
          {where}
          {round.track_length_km ? ` · ${round.track_length_km} km` : ""}
        </p>
      )}
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
