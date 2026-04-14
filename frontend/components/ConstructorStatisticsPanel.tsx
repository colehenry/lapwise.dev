"use client";

import { useQuery } from "@tanstack/react-query";
import ArchivePanel from "@/components/archive/ArchivePanel";
import MonoLabel from "@/components/ui/MonoLabel";
import Skeleton from "@/components/ui/Skeleton";
import { apiHeaders, apiUrl } from "@/lib/api";
import type { ConstructorRaceHistoryResponse } from "@/lib/types";

interface ConstructorStatisticsPanelProps {
  teamName: string;
  accentColor?: string | null;
}

type SeasonStat = {
  year: number;
  races: number;
  wins: number;
  podiums: number;
  points: number;
};

type DistributionStat = {
  label: string;
  count: number;
  color: string;
};

function formatNumber(value: number) {
  return Number.isInteger(value)
    ? value.toLocaleString()
    : value.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function SummaryCell({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="min-w-0 border border-border-primary bg-bg-primary/20 px-4 py-3">
      <MonoLabel className="block mb-1">{label}</MonoLabel>
      <div className="truncate font-mono text-2xl font-bold tabular-nums text-text-primary">
        {value}
      </div>
      <div className="mt-1 truncate text-xs text-text-muted">{detail}</div>
    </div>
  );
}

function BarTrack({
  value,
  max,
  color,
}: {
  value: number;
  max: number;
  color: string;
}) {
  const width = max > 0 ? Math.max((value / max) * 100, value > 0 ? 2 : 0) : 0;

  return (
    <div className="h-2 overflow-hidden rounded-sm bg-bg-primary">
      <div
        className="h-full rounded-sm transition-all duration-500"
        style={{ width: `${width}%`, backgroundColor: color }}
      />
    </div>
  );
}

function SeasonBarRow({
  season,
  maxWins,
  accentColor,
}: {
  season: SeasonStat;
  maxWins: number;
  accentColor: string;
}) {
  const winRate = season.races > 0 ? (season.wins / season.races) * 100 : 0;

  return (
    <div className="grid grid-cols-1 gap-3 border-b border-border-primary px-4 py-4 last:border-b-0 md:grid-cols-[5rem_1fr_auto] md:items-center">
      <div>
        <span className="font-mono text-lg font-bold tabular-nums text-text-primary">
          {season.year}
        </span>
        <div className="mt-1 text-xs text-text-muted">
          {season.races.toLocaleString()} races
        </div>
      </div>

      <div className="min-w-0">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <MonoLabel>Wins</MonoLabel>
          <span className="font-mono text-sm font-bold tabular-nums text-text-primary">
            {season.wins.toLocaleString()}
          </span>
        </div>
        <BarTrack value={season.wins} max={maxWins} color={accentColor} />
      </div>

      <div className="grid grid-cols-3 gap-4 md:min-w-72 md:text-right">
        <div>
          <MonoLabel>Win Rate</MonoLabel>
          <div className="mt-1 font-mono text-sm font-bold tabular-nums text-text-primary">
            {winRate.toFixed(0)}%
          </div>
        </div>
        <div>
          <MonoLabel>Podiums</MonoLabel>
          <div className="mt-1 font-mono text-sm font-bold tabular-nums text-text-primary">
            {season.podiums.toLocaleString()}
          </div>
        </div>
        <div>
          <MonoLabel>Pts/Race</MonoLabel>
          <div className="mt-1 font-mono text-sm font-bold tabular-nums text-text-primary">
            {season.races > 0 ? (season.points / season.races).toFixed(1) : "0"}
          </div>
        </div>
      </div>
    </div>
  );
}

function DistributionRow({
  stat,
  total,
}: {
  stat: DistributionStat;
  total: number;
}) {
  const pct = total > 0 ? (stat.count / total) * 100 : 0;

  return (
    <div className="grid grid-cols-[4rem_1fr_auto] items-center gap-4 border-b border-border-primary px-4 py-3 last:border-b-0">
      <span className="font-mono text-sm font-bold text-text-secondary">
        {stat.label}
      </span>
      <BarTrack value={stat.count} max={total} color={stat.color} />
      <div className="text-right">
        <div className="font-mono text-lg font-bold tabular-nums text-text-primary">
          {stat.count.toLocaleString()}
        </div>
        <MonoLabel>{pct.toFixed(0)}%</MonoLabel>
      </div>
    </div>
  );
}

export default function ConstructorStatisticsPanel({
  teamName,
  accentColor,
}: ConstructorStatisticsPanelProps) {
  const { data: raceData, isLoading: raceLoading } =
    useQuery<ConstructorRaceHistoryResponse>({
      queryKey: ["constructor-race-history", teamName, "all"],
      queryFn: async () => {
        const res = await fetch(
          apiUrl(`/api/constructors/${teamName}/race-history?all=true`),
          { headers: apiHeaders() },
        );
        if (!res.ok) throw new Error("Failed to fetch race history");
        return res.json();
      },
    });

  if (raceLoading) {
    return (
      <div className="space-y-6">
        <Skeleton variant="rectangular" height="200px" />
        <Skeleton variant="rectangular" height="260px" />
      </div>
    );
  }

  const races = raceData?.races ?? [];
  const barColor = accentColor ?? "#e10600";
  const seasonStats: Record<number, SeasonStat> = {};

  for (const race of races) {
    if (!seasonStats[race.year]) {
      seasonStats[race.year] = {
        year: race.year,
        races: 0,
        wins: 0,
        podiums: 0,
        points: 0,
      };
    }

    seasonStats[race.year].races += 1;
    seasonStats[race.year].points += race.total_points;
    if (race.best_position === 1) seasonStats[race.year].wins += 1;
    if (race.best_position && race.best_position <= 3) {
      seasonStats[race.year].podiums += 1;
    }
  }

  const seasons = Object.values(seasonStats).sort((a, b) => a.year - b.year);
  const peakSeasons = [...seasons]
    .sort(
      (a, b) => b.wins - a.wins || b.podiums - a.podiums || b.points - a.points,
    )
    .slice(0, 10);
  const maxWins = Math.max(...peakSeasons.map((season) => season.wins), 0);
  const bestWinSeason = peakSeasons[0] ?? null;
  const bestPointsSeason = [...seasons].sort((a, b) => b.points - a.points)[0];
  const totalWins = races.filter((race) => race.best_position === 1).length;
  const totalPodiums = races.filter(
    (race) => race.best_position && race.best_position <= 3,
  ).length;

  const distribution: DistributionStat[] = [
    { label: "P1", count: 0, color: "#facc15" },
    { label: "P2", count: 0, color: "#d1d5db" },
    { label: "P3", count: 0, color: "#d97706" },
    { label: "P4-10", count: 0, color: barColor },
    { label: "P11+", count: 0, color: "#6b7280" },
  ];

  for (const race of races) {
    const pos = race.best_position;
    if (!pos) continue;
    if (pos === 1) distribution[0].count += 1;
    else if (pos === 2) distribution[1].count += 1;
    else if (pos === 3) distribution[2].count += 1;
    else if (pos <= 10) distribution[3].count += 1;
    else distribution[4].count += 1;
  }

  return (
    <div className="space-y-6">
      <ArchivePanel title="Constructor Form" headerId="constructor-form">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCell
            label="Best Win Season"
            value={bestWinSeason?.year ?? "N/A"}
            detail={
              bestWinSeason
                ? `${bestWinSeason.wins.toLocaleString()} wins`
                : "No wins recorded"
            }
          />
          <SummaryCell
            label="Best Points Season"
            value={bestPointsSeason?.year ?? "N/A"}
            detail={
              bestPointsSeason
                ? `${formatNumber(bestPointsSeason.points)} points`
                : "No points recorded"
            }
          />
          <SummaryCell
            label="Win Rate"
            value={
              races.length > 0
                ? `${((totalWins / races.length) * 100).toFixed(1)}%`
                : "0%"
            }
            detail={`${totalWins.toLocaleString()} of ${races.length.toLocaleString()} races`}
          />
          <SummaryCell
            label="Podium Rate"
            value={
              races.length > 0
                ? `${((totalPodiums / races.length) * 100).toFixed(1)}%`
                : "0%"
            }
            detail={`${totalPodiums.toLocaleString()} of ${races.length.toLocaleString()} races`}
          />
        </div>
      </ArchivePanel>

      {peakSeasons.length > 0 && (
        <ArchivePanel
          title="Best Seasons by Wins"
          headerId="constructor-peak-seasons"
        >
          <div className="rounded-sm border border-border-primary bg-bg-primary/20">
            {peakSeasons.map((season) => (
              <SeasonBarRow
                key={season.year}
                season={season}
                maxWins={maxWins}
                accentColor={barColor}
              />
            ))}
          </div>
        </ArchivePanel>
      )}

      <ArchivePanel
        title="Finish Distribution"
        headerId="constructor-finish-dist"
      >
        <div className="rounded-sm border border-border-primary bg-bg-primary/20">
          {distribution.map((stat) => (
            <DistributionRow
              key={stat.label}
              stat={stat}
              total={races.length}
            />
          ))}
        </div>
      </ArchivePanel>
    </div>
  );
}
