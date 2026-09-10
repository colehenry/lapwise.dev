"use client";

import Link from "next/link";
import DriverHeadshot from "@/components/entities/DriverHeadshot";
import { useTeamTint } from "@/hooks/useTeamTint";
import type { StandingsResponse } from "@/lib/championshipTypes";
import { constructorHref, driverHref } from "@/lib/entityLinks";
import ConsolePanel, { PanelLabel, ValueSkeleton } from "./ConsolePanel";

/** Deep enough to show the shape of a championship, short enough to scan. */
const DRIVER_ROWS = 8;
const CONSTRUCTOR_ROWS = 6;

function Points({ value }: { value: number }) {
  return (
    <span className="font-mono text-[12px] tabular-nums text-ink-strong">
      {Math.round(value)}
    </span>
  );
}

function Position({ value }: { value: number | null }) {
  return (
    <span className="text-right font-mono text-[10px] tabular-nums text-ink-faint">
      {value ?? "—"}
    </span>
  );
}

function LoadingRows({ count }: { count: number }) {
  const keys = Array.from({ length: count }, (_, index) => `row-${index}`);
  return (
    <>
      {keys.map((key) => (
        <div
          key={key}
          className="flex flex-1 items-center gap-2.5 border-b border-line-soft/50 px-3 last:border-b-0"
        >
          <ValueSkeleton width={10} height={10} />
          <ValueSkeleton width="60%" height={11} />
          <ValueSkeleton width={26} height={11} className="ml-auto" />
        </div>
      ))}
    </>
  );
}

export function DriverChampionship({
  standings,
  loading,
  className = "",
}: {
  standings: StandingsResponse | undefined;
  loading: boolean;
  className?: string;
}) {
  const tint = useTeamTint();
  const drivers = (standings?.drivers ?? []).slice(0, DRIVER_ROWS);

  return (
    <ConsolePanel
      title="Drivers' championship"
      label={<PanelLabel>{standings?.year ?? ""}</PanelLabel>}
      className={className}
      bodyClassName="flex flex-col"
    >
      {loading && drivers.length === 0 && <LoadingRows count={DRIVER_ROWS} />}
      {drivers.map((driver) => (
        <Link
          key={driver.driver_slug ?? driver.full_name}
          href={driverHref(driver) ?? "/drivers"}
          className="grid flex-1 grid-cols-[14px_24px_minmax(0,1fr)_auto] items-center gap-2.5 border-b border-line-soft/50 px-3 transition-colors last:border-b-0 hover:bg-surface-raised"
        >
          <Position value={driver.position} />
          <DriverHeadshot
            code={driver.driver_code}
            fullName={driver.full_name}
            src={driver.headshot_url}
            size={24}
            shape="circle"
            bordered={false}
            focalY={0.12}
          />
          <span
            className="truncate text-[12.5px] font-semibold"
            style={{ color: tint(driver.team_color) }}
          >
            {driver.full_name}
          </span>
          <Points value={driver.total_points} />
        </Link>
      ))}
    </ConsolePanel>
  );
}

export function ConstructorChampionship({
  standings,
  loading,
  className = "",
}: {
  standings: StandingsResponse | undefined;
  loading: boolean;
  className?: string;
}) {
  const tint = useTeamTint();
  const teams = (standings?.constructors ?? []).slice(0, CONSTRUCTOR_ROWS);

  return (
    <ConsolePanel
      title="Constructors"
      label={<PanelLabel>{standings?.year ?? ""}</PanelLabel>}
      className={className}
      bodyClassName="flex flex-col"
    >
      {loading && teams.length === 0 && (
        <LoadingRows count={CONSTRUCTOR_ROWS} />
      )}
      {teams.map((team) => (
        <Link
          key={team.constructor_slug ?? team.team_name}
          href={constructorHref(team) ?? "/constructors"}
          className="grid flex-1 grid-cols-[14px_3px_minmax(0,1fr)_auto] items-center gap-2.5 border-b border-line-soft/50 px-3 transition-colors last:border-b-0 hover:bg-surface-raised"
        >
          <Position value={team.position} />
          <span
            className="h-[18px] w-[3px] rounded-full"
            style={{ background: tint(team.team_color) }}
          />
          <span className="truncate text-[12.5px] font-semibold text-ink-base">
            {team.team_name}
          </span>
          <Points value={team.total_points} />
        </Link>
      ))}
    </ConsolePanel>
  );
}
