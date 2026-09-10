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
      value: round ? `Rd ${round}` : null,
      heading: "Race Weekend Hub",
      body: "Every session of the weekend with the charts that explain it.",
      action: circuitName ? `Open ${circuitName}` : "Open the weekend",
    },
    {
      href: "/replay",
      value: data ? `2018–${season ?? data.first_season}` : null,
      heading: "Replay",
      body: "Watch any race back from the lap record, at any speed.",
      action: "Pick a race",
    },
    {
      href: "/results",
      value: data ? `${data.races.toLocaleString()} races` : null,
      heading: "Results",
      body: "Every classified result, qualifying session and grid.",
      action: "Browse results",
    },
    {
      href: "/drivers",
      value: data ? `${data.drivers} drivers` : null,
      heading: "Archive",
      body: data
        ? `${data.constructors} constructors and ${data.circuits} circuits, back to ${data.first_season}.`
        : "Constructors and circuits, back to the first season.",
      action: "Open the archive",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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
