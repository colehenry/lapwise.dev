"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
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
    <div className="bg-bg-tertiary border border-border-primary rounded-lg p-6">
      <h3 className="text-lg font-bold text-white mb-4">{title}</h3>
      <div className="space-y-2">
        {items.map((item, idx) => (
          <div
            key={`${item.name}-${idx}`}
            className="flex items-center justify-between py-1.5"
          >
            <div className="flex items-center gap-3">
              <span
                className={`font-mono text-sm w-6 text-right ${idx === 0 ? "text-yellow-400 font-bold" : "text-text-muted"}`}
              >
                {idx + 1}
              </span>
              {item.color && (
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: `#${item.color}` }}
                />
              )}
              {linkPrefix && (item.code || slugFromName) ? (
                <Link
                  href={`${linkPrefix}${item.code || item.name.replace(/\s+/g, "-")}`}
                  className="text-text-primary hover:text-purple-300 transition-colors"
                >
                  {item.name}
                </Link>
              ) : (
                <span className="text-text-primary">{item.name}</span>
              )}
            </div>
            <span className="font-mono font-bold text-white">{item.count}</span>
          </div>
        ))}
      </div>
    </div>
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
