"use client";

import { useQuery } from "@tanstack/react-query";
import type { RaceClockController } from "@/hooks/useRaceClock";
import type { ConsoleReplay } from "@/lib/queries/consoleReplay";
import { consoleTelemetryQuery } from "@/lib/queries/consoleTelemetry";
import type { RoundSummary } from "@/lib/types";
import ChannelStrip from "./ChannelStrip";
import ConsolePanel from "./ConsolePanel";

/**
 * The leader's channels as the lap is being driven, and nothing else.
 *
 * The final classification used to sit beside them. It is the same three names
 * the map's running order already carries, and it cost the traces half their
 * width to repeat them.
 */
export default function RacePanel({
  season,
  round,
  latest,
  replay,
  clock,
  className = "",
}: {
  season: number | null;
  round: number | null;
  latest: RoundSummary | undefined;
  replay: ConsoleReplay;
  clock: RaceClockController;
  className?: string;
}) {
  const leader = clock.frame?.leader;

  /* Only the leader's channels, and only once the console has drawn. A round
     with lap data but no replay blob answers 404 and the strip stays away. */
  const { data: telemetry } = useQuery(
    consoleTelemetryQuery(season, round, leader?.car.driver_code ?? null),
  );

  if (!leader) return null;

  return (
    <ConsolePanel
      title={latest?.event_name ?? replay.event_name}
      className={className}
      bodyClassName="flex min-h-0 flex-col px-3 py-2.5"
    >
      <ChannelStrip telemetry={telemetry} clock={clock} />
    </ConsolePanel>
  );
}
