"use client";

import { useQuery } from "@tanstack/react-query";
import DriverHeadshot from "@/components/entities/DriverHeadshot";
import type { RaceClockController } from "@/hooks/useRaceClock";
import { useTeamTint } from "@/hooks/useTeamTint";
import { gapLabel, sessionClock } from "@/lib/consoleFormat";
import type { ConsoleReplay } from "@/lib/queries/consoleReplay";
import { consoleTelemetryQuery } from "@/lib/queries/consoleTelemetry";
import type { RoundSummary, SessionResultsResponse } from "@/lib/types";
import ChannelStrip from "./ChannelStrip";
import ConsolePanel, { PanelLabel } from "./ConsolePanel";

/**
 * The event, both ways round: the leader's channels as the lap is being driven
 * on the left, and how the race actually finished on the right.
 *
 * The lap-time-by-lap trace used to sit above the channels. It broke into
 * disconnected segments wherever a lap ran off scale, floated markers over the
 * gaps, and cost the map most of its height to say something the ticker
 * already says.
 */
export default function RacePanel({
  replay,
  season,
  round,
  latest,
  classification,
  clock,
  className = "",
}: {
  replay: ConsoleReplay;
  season: number | null;
  round: number | null;
  latest: RoundSummary | undefined;
  classification: SessionResultsResponse | null | undefined;
  clock: RaceClockController;
  className?: string;
}) {
  const tint = useTeamTint();
  const leader = clock.frame?.leader;
  const podium = latest?.podium ?? [];
  const results = classification?.results ?? [];
  const winnerGrid = results.find((row) => row.position === 1)?.grid_position;

  /* Only the leader's channels, and only once the console has drawn. A round
     with lap data but no replay blob answers 404 and the strip stays away. */
  const { data: telemetry } = useQuery(
    consoleTelemetryQuery(season, round, leader?.car.driver_code ?? null),
  );

  if (!leader) return null;

  return (
    <ConsolePanel
      title={latest?.event_name ?? replay.event_name}
      label={
        <PanelLabel>
          Leader · {leader.car.driver_code ?? leader.car.full_name}
        </PanelLabel>
      }
      className={className}
      bodyClassName="grid grid-cols-1 gap-px bg-line-soft lg:grid-cols-[minmax(0,1fr)_300px]"
    >
      <div className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-surface-panel px-3 py-2.5">
        <ChannelStrip telemetry={telemetry} clock={clock} />
      </div>

      <div className="flex min-w-0 flex-col overflow-hidden bg-surface-panel px-3 py-2.5">
        <PanelLabel>Final result</PanelLabel>
        <div className="mt-2 flex flex-col gap-2">
          {podium.slice(0, 3).map((driver, index) => (
            <div
              key={driver.driver_code ?? driver.full_name}
              className="grid grid-cols-[12px_auto_minmax(0,1fr)_auto] items-center gap-2.5"
            >
              <span className="font-mono text-[11px] tabular-nums text-ink-faint">
                {index + 1}
              </span>
              <DriverHeadshot
                code={driver.driver_code}
                fullName={driver.full_name}
                src={driver.headshot_url}
                size={index === 0 ? 34 : 26}
                shape="circle"
                bordered={false}
                focalY={0.12}
              />
              <span className="min-w-0">
                <span
                  className={`block truncate font-semibold ${
                    index === 0
                      ? "text-[14px] tracking-[-0.015em]"
                      : "text-[12.5px]"
                  }`}
                  style={{ color: tint(driver.team_color) }}
                >
                  {driver.full_name}
                </span>
                {index === 0 && winnerGrid != null && (
                  <span className="mt-px block font-mono text-[9px] uppercase tracking-[0.12em] text-ink-faint">
                    Won from P{winnerGrid}
                  </span>
                )}
              </span>
              <span className="font-mono text-[11px] tabular-nums text-ink-soft">
                {index === 0
                  ? driver.time_seconds != null
                    ? sessionClock(driver.time_seconds)
                    : "—"
                  : gapLabel(driver.time_seconds)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </ConsolePanel>
  );
}
