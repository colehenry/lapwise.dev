"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import ArchivePanel from "@/components/archive/ArchivePanel";
import MonoLabel from "@/components/ui/MonoLabel";
import { driverSuperlativesQuery } from "@/lib/queries/entities";
import type { DriverSuperlative } from "@/lib/types";

type Props = {
  driverCode: string;
  includeSprint?: boolean;
  variant?: "card" | "inline";
};

function SuperlativeRow({ item }: { item: DriverSuperlative }) {
  return (
    <li className="py-1.5 border-b border-border-primary/40 last:border-0">
      <div className="flex items-baseline gap-1.5">
        <span className="font-mono font-bold text-text-primary text-sm tabular-nums shrink-0">
          {item.value}
        </span>
        <span className="text-sm text-text-secondary leading-snug">
          {item.label}
        </span>
      </div>
      {item.sublabel && (
        <span className="text-[9px] font-mono uppercase tracking-widest text-text-muted mt-0.5 block">
          {item.sublabel}
        </span>
      )}
    </li>
  );
}

export default function DriverSuperlativesCard({
  driverCode,
  includeSprint = true,
  variant = "card",
}: Props) {
  const { data } = useQuery({
    ...driverSuperlativesQuery(driverCode, includeSprint),
    placeholderData: keepPreviousData,
  });

  if (!data || data.superlatives.length === 0) return null;

  const list = (
    <ul className="divide-y-0">
      {data.superlatives.map((item) => (
        <SuperlativeRow key={item.id} item={item} />
      ))}
    </ul>
  );

  if (variant === "inline") {
    return (
      <>
        <MonoLabel className="block">Highlights</MonoLabel>
        {list}
      </>
    );
  }

  return <ArchivePanel title="Superlatives">{list}</ArchivePanel>;
}
