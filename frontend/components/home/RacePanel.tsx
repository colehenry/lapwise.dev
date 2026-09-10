"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useRef } from "react";
import DriverHeadshot from "@/components/entities/DriverHeadshot";
import type { RaceClockController } from "@/hooks/useRaceClock";
import { useTeamTint } from "@/hooks/useTeamTint";
import { driverHref } from "@/lib/entityLinks";
import { compoundFromInitial, getCompoundColor } from "@/lib/palette";
import {
  type ChannelReading,
  consoleTelemetryQuery,
  sampleAt,
} from "@/lib/queries/consoleTelemetry";
import ChannelStrip from "./ChannelStrip";
import ConsolePanel from "./ConsolePanel";

/** One live value, labelled. Written through a ref, never through state. */
function Readout({
  label,
  cell,
}: {
  label: string;
  cell: (node: HTMLSpanElement | null) => void;
}) {
  return (
    <span className="flex min-w-[52px] flex-col items-center">
      <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-ink-faint">
        {label}
      </span>
      <span
        ref={cell}
        className="mt-px font-mono text-[13px] tabular-nums text-ink-strong"
      />
    </span>
  );
}

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
  clock,
  className = "",
}: {
  season: number | null;
  round: number | null;
  clock: RaceClockController;
  className?: string;
}) {
  const tint = useTeamTint();
  const leader = clock.frame?.leader;
  const lap = clock.frame?.lap ?? 1;
  const { subscribe } = clock;

  /* Only the leader's channels, and only once the console has drawn. A round
     with lap data but no replay blob answers 404 and the strip stays away. */
  const { data: telemetry } = useQuery(
    consoleTelemetryQuery(season, round, leader?.car.driver_code ?? null),
  );

  const cells = useRef<Record<string, HTMLSpanElement | null>>({});
  const telemetryRef = useRef(telemetry);
  telemetryRef.current = telemetry;
  const lapRef = useRef(lap);
  lapRef.current = lap;

  useEffect(() => {
    const write = (key: string, value: string) => {
      const node = cells.current[key];
      if (node) node.textContent = value;
    };

    return subscribe((frame) => {
      const current = telemetryRef.current;
      if (!current) return;
      const through = frame.leader.progress - Math.floor(frame.leader.progress);
      const reading: ChannelReading | null = sampleAt(
        current,
        lapRef.current,
        through,
      );
      if (!reading) return;
      write("speed", `${reading.speed}`);
      write("gear", `${reading.gear}`);
      write("throttle", `${reading.throttle}%`);
      // Boolean at source: FastF1 records brake as on or off, never a
      // pressure, so a percentage would only ever read 0 or 100.
      write("brake", reading.brake ? "ON" : "OFF");
    });
  }, [subscribe]);

  if (!leader) return null;

  const running = leader.car.laps[leader.lapIndex];
  const compound = running ? compoundFromInitial(running.c) : null;

  return (
    <ConsolePanel
      title={
        /* Whose channels these are, rather than which race — the map above
           already names the race, and the leader is what changes. */
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="flex-none font-mono text-[8.5px] font-bold uppercase leading-[1.25] tracking-[0.16em] text-ink-faint">
            Leader
            <br />
            Telemetry
          </span>
          <DriverHeadshot
            code={leader.car.driver_code}
            fullName={leader.car.full_name}
            src={leader.car.headshot_url}
            size={28}
            shape="circle"
            bordered={false}
            focalY={0.12}
          />
          <span className="min-w-0">
            <Link
              href={driverHref(leader.car) ?? "/drivers"}
              className="block truncate text-[14px] font-bold tracking-[-0.01em] underline-offset-2 hover:underline"
              style={{ color: tint(leader.car.team_color) }}
            >
              {leader.car.full_name}
            </Link>
            <span className="mt-px block truncate font-mono text-[9px] uppercase tracking-[0.12em] text-ink-faint">
              {leader.car.team_name}
            </span>
          </span>
          {running && (
            <span className="flex flex-none flex-col items-center gap-0.5 pl-1">
              <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-ink-faint">
                Tyre
              </span>
              <span className="flex items-center gap-1">
                <span
                  className="grid h-[17px] w-[17px] place-items-center rounded-full border font-mono text-[9px] font-bold"
                  style={{
                    color: getCompoundColor(compound),
                    borderColor: getCompoundColor(compound),
                  }}
                >
                  {running.c}
                </span>
                <span className="font-mono text-[12px] tabular-nums text-ink-strong">
                  {running.age ?? "?"}
                </span>
              </span>
            </span>
          )}

          <span className="ml-auto flex flex-none items-start gap-4 border-l border-line-soft pl-4">
            {[
              { key: "speed", label: "km/h" },
              { key: "gear", label: "Gear" },
              { key: "throttle", label: "Throttle" },
              { key: "brake", label: "Brake" },
            ].map((channel) => (
              <Readout
                key={channel.key}
                label={channel.label}
                cell={(node) => {
                  cells.current[channel.key] = node;
                }}
              />
            ))}
          </span>
        </span>
      }
      className={className}
      bodyClassName="flex min-h-0 flex-col px-3 py-2.5"
    >
      <ChannelStrip telemetry={telemetry} clock={clock} />
    </ConsolePanel>
  );
}
