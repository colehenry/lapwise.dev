"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import DriverHeadshot from "@/components/entities/DriverHeadshot";
import { teamTint, utcDate } from "@/lib/consoleFormat";
import { seasonRoundsQuery, selectUniqueRounds } from "@/lib/queries/seasons";
import ConsolePanel, { PanelFailure, PanelLabel } from "./ConsolePanel";

/** Enough to show the shape of the season's recent form. */
const ROW_COUNT = 5;

export default function RecentRaces({ season }: { season: number | null }) {
  const { data, isPending, isError, refetch } = useQuery({
    ...seasonRoundsQuery(season),
    select: selectUniqueRounds,
  });

  const rounds = [...(data ?? [])]
    .sort((a, b) => b.round - a.round)
    .slice(0, ROW_COUNT);

  return (
    <ConsolePanel
      title="Recent races"
      label={<PanelLabel>{season ?? ""}</PanelLabel>}
      bodyClassName="flex flex-col"
    >
      {isError && (
        <PanelFailure
          message="Recent results could not be loaded."
          onRetry={() => void refetch()}
        />
      )}
      {!isError && rounds.length === 0 && !isPending && (
        <p className="px-3 py-4 text-[12.5px] text-ink-soft">
          No races have been classified this season yet.
        </p>
      )}
      {rounds.map((round) => {
        const [winner, ...rest] = round.podium ?? [];
        return (
          <Link
            key={round.round}
            href={`/results/${season}/${round.round}`}
            className="grid grid-cols-[30px_40px_minmax(0,1fr)_auto_62px] items-center gap-3 border-b border-line-soft/50 px-3 py-2 transition-colors last:border-b-0 hover:bg-surface-raised"
          >
            <span className="font-mono text-[10px] tabular-nums text-ink-faint">
              R{String(round.round).padStart(2, "0")}
            </span>
            <DriverHeadshot
              code={winner?.driver_code}
              fullName={winner?.full_name ?? "—"}
              src={winner?.headshot_url}
              size={40}
              shape="circle"
              bordered={false}
              focalY={0.12}
            />
            <span className="min-w-0">
              <span
                className="block truncate text-[14px] font-bold tracking-[-0.01em]"
                style={{ color: teamTint(winner?.team_color) }}
              >
                {winner?.full_name ?? "—"}
              </span>
              <span className="mt-0.5 block truncate font-mono text-[9.5px] uppercase tracking-[0.1em] text-ink-faint">
                {round.event_name} · {round.circuit_name}
              </span>
            </span>
            <span className="hidden gap-2 sm:flex">
              {rest.slice(0, 2).map((driver, index) => (
                <span
                  key={driver.driver_code ?? driver.full_name}
                  className="flex items-center gap-1.5"
                >
                  <DriverHeadshot
                    code={driver.driver_code}
                    fullName={driver.full_name}
                    src={driver.headshot_url}
                    size={22}
                    shape="circle"
                    bordered={false}
                    focalY={0.12}
                    className="opacity-85"
                  />
                  <span className="font-mono text-[9.5px] text-ink-faint">
                    P{index + 2} {driver.driver_code ?? ""}
                  </span>
                </span>
              ))}
            </span>
            <span className="text-right font-mono text-[10.5px] tabular-nums text-ink-faint">
              {utcDate(round.date, { day: "numeric", month: "short" })}
            </span>
          </Link>
        );
      })}
    </ConsolePanel>
  );
}
