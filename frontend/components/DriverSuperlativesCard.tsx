"use client";

import { useQuery } from "@tanstack/react-query";
import ArchivePanel from "@/components/archive/ArchivePanel";
import MonoLabel from "@/components/ui/MonoLabel";
import { apiHeaders, apiUrl } from "@/lib/api";
import type {
  DriverSuperlative,
  DriverSuperlativesResponse,
} from "@/lib/types";

type Props = {
  driverCode: string;
  includeSprint?: boolean;
  variant?: "card" | "inline";
};

async function fetchSuperlatives(
  driverCode: string,
  includeSprint: boolean,
): Promise<DriverSuperlativesResponse> {
  const params = includeSprint ? "" : "?include_sprint=false";
  const res = await fetch(
    apiUrl(`/api/drivers/${driverCode}/superlatives${params}`),
    { headers: apiHeaders() },
  );
  if (!res.ok) throw new Error("Failed to fetch superlatives");
  return res.json();
}

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
    queryKey: ["driver-superlatives", driverCode, includeSprint],
    queryFn: () => fetchSuperlatives(driverCode, includeSprint),
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
        <MonoLabel className="block">Superlatives</MonoLabel>
        {list}
      </>
    );
  }

  return <ArchivePanel title="Superlatives">{list}</ArchivePanel>;
}
