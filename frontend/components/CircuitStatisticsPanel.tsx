"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import ArchivePanel from "@/components/archive/ArchivePanel";
import MonoLabel from "@/components/ui/MonoLabel";
import Skeleton from "@/components/ui/Skeleton";
import { apiHeaders, apiUrl } from "@/lib/api";
import type { CircuitStatDriver, CircuitStatisticsResponse } from "@/lib/types";

interface CircuitStatisticsPanelProps {
  circuitId: string;
}

function StatList({
  title,
  items,
  linkPrefix,
  slugFromName = false,
}: {
  title: string;
  items: CircuitStatDriver[];
  linkPrefix?: string;
  slugFromName?: boolean;
}) {
  if (items.length === 0) return null;

  return (
    <ArchivePanel
      title={title}
      headerId={`circuit-stat-${title.replace(/\s+/g, "-").toLowerCase()}`}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map((item, idx) => {
          return (
            <div
              key={`${item.name}-${idx}`}
              className="bg-bg-primary/60 border border-border-primary rounded-sm p-4 text-center min-w-0"
            >
              <MonoLabel className="block mb-2">Rank {idx + 1}</MonoLabel>
              {item.color && (
                <span
                  className="mx-auto mb-3 block h-2 w-2 rounded-full"
                  style={{ backgroundColor: `#${item.color}` }}
                />
              )}
              {linkPrefix && (item.code || slugFromName) ? (
                <Link
                  href={`${linkPrefix}${item.code || item.name.replace(/\s+/g, "-")}`}
                  className="block text-sm font-semibold text-text-primary hover:text-purple-300 transition-colors break-words"
                >
                  {item.name}
                </Link>
              ) : (
                <span className="block text-sm font-semibold text-text-primary break-words">
                  {item.name}
                </span>
              )}
              <div className="mt-3 text-2xl font-bold font-mono tabular-nums text-text-primary">
                {item.count}
              </div>
            </div>
          );
        })}
      </div>
    </ArchivePanel>
  );
}

export default function CircuitStatisticsPanel({
  circuitId,
}: CircuitStatisticsPanelProps) {
  const { data, isLoading } = useQuery<CircuitStatisticsResponse>({
    queryKey: ["circuit-statistics", circuitId],
    queryFn: async () => {
      const res = await fetch(apiUrl(`/api/circuits/${circuitId}/statistics`), {
        headers: apiHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch circuit statistics");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton
            key={`skel-${
              // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
              i
            }`}
            variant="rectangular"
            height="250px"
          />
        ))}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-text-muted">
        No statistics available for this circuit.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <StatList
        title="Most Wins"
        items={data.most_wins}
        linkPrefix="/drivers/"
      />
      <StatList
        title="Most Pole Positions"
        items={data.most_poles}
        linkPrefix="/drivers/"
      />
      <StatList
        title="Most Fastest Laps"
        items={data.most_fastest_laps}
        linkPrefix="/drivers/"
      />
      <StatList
        title="Constructor Wins"
        items={data.constructor_wins}
        linkPrefix="/constructors/"
        slugFromName
      />
    </div>
  );
}
