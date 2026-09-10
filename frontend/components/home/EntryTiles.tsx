"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { archiveCountsQuery } from "@/lib/queries/archive";
import { ValueSkeleton } from "./ConsolePanel";

type Tile = {
  href: string;
  value: string | null;
  heading: string;
  body: string;
  action: string;
};

export default function EntryTiles({
  season,
  round,
  circuitName,
}: {
  season: number | null;
  round: number | null;
  circuitName: string | null;
}) {
  const { data } = useQuery(archiveCountsQuery());

  const tiles: Tile[] = [
    {
      href: season && round ? `/results/${season}/${round}` : "/results",
      value: round ? `Season Breakdown` : null,
      heading: "Race Weekend Hub",
      body: "Every session of the weekend with charts and data to dig into.",
      action: circuitName ? `Open ${circuitName}` : "Open the weekend",
    },
    {
      href: "/replay",
      value: data ? `2018–${season ?? data.first_season}` : null,
      heading: "Replay",
      body: "Watch any race back, exploring telemetry by lap and driver.",
      action: "Pick a race",
    },
    {
      href: "/drivers",
      value: data ? `Explore the history` : null,
      heading: "Archive",
      body: data
        ? `${data.drivers} drivers, ${data.constructors} constructors and ${data.circuits} circuits, since ${data.first_season}.`
        : "Constructors and circuits, back to the first season.",
      action: "Open the archive",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {tiles.map((tile) => (
        <Link
          key={tile.heading}
          href={tile.href}
          className="flex min-h-[116px] flex-col gap-1.5 rounded-sm border border-line-soft bg-surface-panel p-4 transition-colors hover:border-accent"
        >
          <span className="font-mono text-[22px] tracking-[-0.03em] tabular-nums text-ink-strong">
            {tile.value ?? <ValueSkeleton width={72} height={18} />}
          </span>
          <h4 className="m-0 text-[15px] font-bold tracking-[-0.01em] text-ink-strong">
            {tile.heading}
          </h4>
          <p className="m-0 text-[12px] leading-relaxed text-ink-soft">
            {tile.body}
          </p>
          <span className="mt-auto font-mono text-[9.5px] uppercase tracking-[0.14em] text-accent-bright">
            {tile.action} →
          </span>
        </Link>
      ))}
    </div>
  );
}
