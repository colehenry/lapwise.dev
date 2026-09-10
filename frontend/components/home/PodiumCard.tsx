"use client";

import DriverHeadshot from "@/components/entities/DriverHeadshot";
import type { PanelState } from "@/hooks/useHomeConsole";
import { formatLapTime } from "@/lib/chart-utils";
import { gapLabel, integer, sessionClock, teamTint } from "@/lib/consoleFormat";
import type { ConsoleFastestLap } from "@/lib/queries/consoleReplay";
import type { RoundSummary, SessionResultsResponse } from "@/lib/types";
import ConsolePanel, {
  PanelFailure,
  PanelLabel,
  ValueSkeleton,
} from "./ConsolePanel";

/** Everything else is a finish, however far back. */
const CLASSIFIED = new Set(["Finished", "Lapped"]);

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border-r border-line-soft px-2.5 py-2 last:border-r-0">
      <PanelLabel>{label}</PanelLabel>
      <div className="mt-0.5 truncate font-mono text-[12.5px] tabular-nums text-ink-strong">
        {value}
      </div>
    </div>
  );
}

export default function PodiumCard({
  latest,
  state,
  classification,
  fastestLap,
  className = "",
}: {
  latest: RoundSummary | undefined;
  state: PanelState;
  classification: SessionResultsResponse | null | undefined;
  fastestLap: ConsoleFastestLap | null | undefined;
  className?: string;
}) {
  const podium = latest?.podium ?? [];
  const winner = podium[0];
  const results = classification?.results ?? [];
  const winnerGrid = results.find((row) => row.position === 1)?.grid_position;
  const margin = results.find((row) => row.position === 2)?.time_seconds;
  const retirements = results.filter(
    (row) => !CLASSIFIED.has(row.status),
  ).length;

  return (
    <ConsolePanel
      title={latest?.event_name ?? "Latest race"}
      label={
        latest ? (
          <PanelLabel>
            Rd {latest.round} · {latest.circuit_name}
          </PanelLabel>
        ) : (
          <ValueSkeleton width={90} height={10} />
        )
      }
      className={className}
      bodyClassName="flex flex-col"
    >
      {state === "error" && (
        <PanelFailure message="The latest result could not be loaded." />
      )}

      {state !== "error" && !winner && (
        <p className="flex flex-1 items-center px-3 text-[12.5px] text-ink-soft">
          No classified result has published yet.
        </p>
      )}

      {winner && (
        <>
          <div className="grid grid-cols-[46px_minmax(0,1fr)_auto] items-center gap-[11px] border-b border-line-soft px-3 py-[11px]">
            <DriverHeadshot
              code={winner.driver_code}
              fullName={winner.full_name}
              src={winner.headshot_url}
              size={46}
              shape="circle"
              bordered={false}
              focalY={0.12}
            />
            <span className="min-w-0">
              <span
                className="block truncate text-[16px] font-bold leading-tight tracking-[-0.015em]"
                style={{ color: teamTint(winner.team_color) }}
              >
                {winner.full_name}
              </span>
              <span className="mt-[3px] block truncate font-mono text-[9px] uppercase tracking-[0.12em] text-ink-faint">
                {winner.team_name}
                {winnerGrid != null && ` · won from P${winnerGrid}`}
              </span>
            </span>
            <span className="font-mono text-[12px] tabular-nums text-ink-base">
              {winner.time_seconds != null
                ? sessionClock(winner.time_seconds)
                : "—"}
            </span>
          </div>

          {podium.slice(1, 3).map((driver, index) => (
            <div
              key={driver.driver_code ?? driver.full_name}
              className="grid grid-cols-[14px_28px_minmax(0,1fr)_auto] items-center gap-2.5 border-b border-line-soft/50 px-3 py-1.5"
            >
              <span className="font-mono text-[10px] tabular-nums text-ink-faint">
                {index + 2}
              </span>
              <DriverHeadshot
                code={driver.driver_code}
                fullName={driver.full_name}
                src={driver.headshot_url}
                size={28}
                shape="circle"
                bordered={false}
                focalY={0.12}
              />
              <span
                className="truncate text-[13px] font-semibold"
                style={{ color: teamTint(driver.team_color) }}
              >
                {driver.full_name}
              </span>
              <span className="font-mono text-[11px] tabular-nums text-ink-soft">
                {gapLabel(driver.time_seconds)}
              </span>
            </div>
          ))}

          <div className="mt-auto grid grid-cols-3 border-t border-line-soft">
            <StatCell label="Winning margin" value={gapLabel(margin)} />
            <StatCell
              label="Fastest lap"
              value={
                fastestLap
                  ? `${formatLapTime(fastestLap.seconds)} ${fastestLap.driver_code ?? ""}`.trim()
                  : "—"
              }
            />
            <StatCell
              label="Retirements"
              value={results.length > 0 ? integer(retirements) : "—"}
            />
          </div>
        </>
      )}
    </ConsolePanel>
  );
}
