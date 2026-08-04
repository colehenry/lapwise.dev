"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import ArchiveListPage, {
  CURRENT_YEAR,
  type SeasonRange,
} from "@/components/archive/ArchiveListPage";
import { useTheme } from "@/components/providers/ThemeProvider";
import TiltCard from "@/components/ui/TiltCard";
import {
  getConstructorLogoUrl,
  shouldInvertConstructorLogoOnLight,
} from "@/lib/entityImageOverrides";
import { constructorHref } from "@/lib/entityLinks";
import { constructorsQuery } from "@/lib/queries/archive";
import { seasonsQuery } from "@/lib/queries/seasons";
import type { ConstructorListItem } from "@/lib/types";

type SortKey = "wins" | "races" | "points" | "alpha";

function ConstructorCard({ team }: { team: ConstructorListItem }) {
  const { theme } = useTheme();
  const teamUrl = constructorHref(team) ?? "/constructors";
  const isActive = team.latest_season === CURRENT_YEAR;
  const teamColor = team.team_color
    ? `#${team.team_color}`
    : "var(--delta-neutral)";
  const logoUrl = getConstructorLogoUrl(team);
  const invertLogo =
    theme === "light" && shouldInvertConstructorLogoOnLight(team);

  // Generate initials from team name
  const initials = team.team_name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();

  return (
    <TiltCard>
      <Link href={teamUrl} className="block h-full">
        <div className="relative border border-border-primary rounded-sm hover:border-purple-500 transition-all duration-200 bg-bg-tertiary h-full overflow-hidden">
          {/* Team color accent bar */}
          <div
            className="absolute left-0 top-0 bottom-0 w-1"
            style={{ backgroundColor: teamColor }}
          />

          <div className="flex items-center gap-3 p-4 pl-5">
            {/* Team logo or initials circle */}
            {logoUrl ? (
              <div
                className="w-14 h-14 rounded-sm overflow-hidden border-2 bg-bg-secondary flex-shrink-0"
                style={{ borderColor: teamColor }}
              >
                <Image
                  src={logoUrl}
                  alt={team.team_name}
                  width={56}
                  height={56}
                  className="w-full h-full object-contain p-1"
                  style={invertLogo ? { filter: "invert(1)" } : undefined}
                  unoptimized={logoUrl.includes("wikimedia.org")}
                />
              </div>
            ) : (
              <div
                className="w-14 h-14 rounded-sm flex items-center justify-center text-xs font-bold text-white flex-shrink-0 font-mono border-2"
                style={{ backgroundColor: teamColor, borderColor: teamColor }}
              >
                {initials}
              </div>
            )}

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-text-primary font-bold truncate">
                  {team.team_name}
                </h3>
                {isActive && (
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-500 flex-shrink-0" />
                )}
              </div>
              <div className="flex items-center gap-3 text-[10px] text-text-muted font-mono tracking-wider mt-0.5">
                <span>{team.total_races} races</span>
                <span className="text-border-secondary">/</span>
                <span>{team.total_podiums} podiums</span>
              </div>
            </div>

            {/* Wins */}
            <div className="flex-shrink-0 text-right">
              <div className="text-2xl font-bold text-text-primary tabular-nums">
                {team.total_wins}
              </div>
              <div className="text-[10px] text-text-muted font-mono tracking-widest uppercase">
                wins
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="flex items-center justify-between px-4 pl-5 pb-3">
            <span />
            <div className="flex items-center gap-3 text-[10px] text-text-muted font-mono tracking-wider">
              <span>{team.total_points.toLocaleString()} pts</span>
              {team.first_season && (
                <>
                  <span className="text-border-secondary">/</span>
                  <span>
                    {team.first_season}–{isActive ? "" : team.latest_season}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </Link>
    </TiltCard>
  );
}

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "wins", label: "Wins" },
  { key: "races", label: "Races" },
  { key: "points", label: "Points" },
  { key: "alpha", label: "A-Z" },
];

const COMPARATORS: Record<
  SortKey,
  (a: ConstructorListItem, b: ConstructorListItem) => number
> = {
  wins: (a, b) =>
    b.total_wins - a.total_wins || b.total_points - a.total_points,
  races: (a, b) => b.total_races - a.total_races || b.total_wins - a.total_wins,
  points: (a, b) =>
    b.total_points - a.total_points || b.total_wins - a.total_wins,
  alpha: (a, b) => a.team_name.localeCompare(b.team_name),
};

function seasonRange(team: ConstructorListItem): SeasonRange {
  return { first: team.first_season, last: team.latest_season };
}

function matchesSearch(team: ConstructorListItem, query: string): boolean {
  return team.team_name.toLowerCase().includes(query);
}

export default function ConstructorsArchive() {
  const [includeSprint, setIncludeSprint] = useState(true);

  const { data, isLoading, isFetching } = useQuery({
    ...constructorsQuery(includeSprint),
    placeholderData: keepPreviousData,
  });

  const { data: availableYears = [] } = useQuery(seasonsQuery());

  return (
    <ArchiveListPage
      title="Constructors"
      allTimeSubtitle="All-Time Career Statistics"
      seasonSubtitle={(year) => `${year} Season Entries`}
      searchPlaceholder="Search by team name..."
      noun="constructors"
      items={data?.constructors}
      isLoading={isLoading}
      isFetching={isFetching}
      availableYears={availableYears}
      sortOptions={SORT_OPTIONS}
      defaultSort="wins"
      comparators={COMPARATORS}
      matchesSearch={matchesSearch}
      seasonRange={seasonRange}
      itemKey={(team) => team.team_name}
      renderCard={(team) => <ConstructorCard team={team} />}
      gridClassName="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3"
      skeletonHeight="110px"
      sprintToggle={{ checked: includeSprint, onChange: setIncludeSprint }}
    />
  );
}
