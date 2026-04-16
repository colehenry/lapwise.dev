"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import ArchivePanel from "@/components/archive/ArchivePanel";
import MonoLabel from "@/components/ui/MonoLabel";
import Skeleton from "@/components/ui/Skeleton";
import { apiHeaders, apiUrl } from "@/lib/api";
import { constructorHref, driverHref } from "@/lib/entityLinks";
import type { CircuitStatDriver, CircuitStatisticsResponse } from "@/lib/types";

interface CircuitStatisticsPanelProps {
  circuitId: string;
}

function LeaderboardRow({
  item,
  rank,
  href,
}: {
  item: CircuitStatDriver;
  rank: number;
  href: string | null;
}) {
  return (
    <div className="grid grid-cols-[2rem_1fr_auto] items-center gap-4 border-b border-border-primary px-4 py-2.5 last:border-b-0">
      <span className="font-mono text-xs font-bold tabular-nums text-text-muted text-right">
        {String(rank).padStart(2, "0")}
      </span>

      <div className="flex items-center gap-2 min-w-0">
        {item.color && (
          <span
            className="block h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: `#${item.color}` }}
          />
        )}
        {href ? (
          <Link
            href={href}
            className="truncate text-sm font-semibold text-text-primary transition-colors hover:text-purple-300"
          >
            {item.name}
          </Link>
        ) : (
          <span className="truncate text-sm font-semibold text-text-primary">
            {item.name}
          </span>
        )}
      </div>

      <span className="font-mono text-sm font-bold tabular-nums text-text-secondary">
        {item.count.toLocaleString()}
      </span>
    </div>
  );
}

function LeaderboardPanel({
  title,
  headerId,
  items,
  linkPrefix,
  entityType,
}: {
  title: string;
  headerId: string;
  items: CircuitStatDriver[];
  linkPrefix?: string;
  entityType?: "driver" | "constructor";
}) {
  if (items.length === 0) return null;

  return (
    <ArchivePanel title={title} headerId={headerId} bodyClassName="p-0">
      <div>
        {items.map((item, idx) => {
          const href =
            entityType === "driver"
              ? driverHref({
                  driver_slug: item.slug,
                  driver_code: item.code,
                  full_name: item.name,
                })
              : entityType === "constructor"
                ? constructorHref(item.name)
                : linkPrefix && item.code
                  ? `${linkPrefix}${item.code}`
                  : null;

          return (
            <LeaderboardRow
              key={`${item.name}-${idx}`}
              item={item}
              rank={idx + 1}
              href={href}
            />
          );
        })}
      </div>
    </ArchivePanel>
  );
}

function SummaryCell({
  label,
  items,
  entityType,
}: {
  label: string;
  items: CircuitStatDriver[];
  entityType?: "driver" | "constructor";
}) {
  const leader = items[0];
  const leaderHref = leader
    ? entityType === "driver"
      ? driverHref({
          driver_slug: leader.slug,
          driver_code: leader.code,
          full_name: leader.name,
        })
      : entityType === "constructor"
        ? constructorHref(leader.name)
        : null
    : null;
  return (
    <div className="min-w-0 border border-border-primary bg-bg-primary/20 px-4 py-3">
      <MonoLabel className="block mb-1">{label}</MonoLabel>
      {leader ? (
        <div className="flex items-baseline justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {leader.color && (
              <span
                className="block h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: `#${leader.color}` }}
              />
            )}
            {leaderHref ? (
              <Link
                href={leaderHref}
                className="truncate text-sm font-semibold text-text-primary transition-colors hover:text-purple-300"
              >
                {leader.name}
              </Link>
            ) : (
              <span className="truncate text-sm font-semibold text-text-primary">
                {leader.name}
              </span>
            )}
          </div>
          <span className="font-mono text-xl font-bold tabular-nums text-text-primary shrink-0">
            {leader.count.toLocaleString()}
          </span>
        </div>
      ) : (
        <span className="text-sm text-text-muted">No data</span>
      )}
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
      <div className="space-y-6">
        <Skeleton variant="rectangular" height="80px" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton
              key={`skel-${
                // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
                i
              }`}
              variant="rectangular"
              height="260px"
            />
          ))}
        </div>
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
    <div className="space-y-6">
      <ArchivePanel title="Circuit Leaders" headerId="circuit-stat-leaders">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCell
            label="Wins"
            items={data.most_wins}
            entityType="driver"
          />
          <SummaryCell
            label="Poles"
            items={data.most_poles}
            entityType="driver"
          />
          <SummaryCell
            label="Fastest Laps"
            items={data.most_fastest_laps}
            entityType="driver"
          />
          <SummaryCell
            label="Constructor Wins"
            items={data.constructor_wins}
            entityType="constructor"
          />
        </div>
      </ArchivePanel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LeaderboardPanel
          title="Most Wins"
          headerId="circuit-stat-wins"
          items={data.most_wins}
          entityType="driver"
        />
        <LeaderboardPanel
          title="Most Pole Positions"
          headerId="circuit-stat-poles"
          items={data.most_poles}
          entityType="driver"
        />
        <LeaderboardPanel
          title="Most Fastest Laps"
          headerId="circuit-stat-fastest-laps"
          items={data.most_fastest_laps}
          entityType="driver"
        />
        <LeaderboardPanel
          title="Constructor Wins"
          headerId="circuit-stat-constructor-wins"
          items={data.constructor_wins}
          entityType="constructor"
        />
      </div>
    </div>
  );
}
