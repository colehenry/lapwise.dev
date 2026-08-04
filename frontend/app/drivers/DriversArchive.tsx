"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import ArchiveListPage, {
  CURRENT_YEAR,
  type SeasonRange,
} from "@/components/archive/ArchiveListPage";
import TiltCard from "@/components/ui/TiltCard";
import { isValidHeadshotUrl } from "@/lib/api";
import { getDriverHeadshotUrl } from "@/lib/entityImageOverrides";
import { constructorHref, driverHref } from "@/lib/entityLinks";
import { getCountryName, getDriverFlagEmoji } from "@/lib/flags";
import { driversQuery } from "@/lib/queries/archive";
import { seasonsQuery } from "@/lib/queries/seasons";
import type { DriverListItem } from "@/lib/types";

type SortKey = "wins" | "races" | "points" | "alpha";

function DriverCard({ driver }: { driver: DriverListItem }) {
  const isActive = driver.latest_season === CURRENT_YEAR;
  const headshotUrl = getDriverHeadshotUrl(driver);
  const driverUrl = driverHref(driver);
  const constructorUrl = constructorHref(driver.current_team);

  return (
    <TiltCard>
      <div className="relative border border-border-primary rounded-sm p-4 hover:border-purple-500 transition-all duration-200 bg-bg-tertiary h-full">
        <Link href={driverUrl ?? "/drivers"} className="block">
          <div className="flex items-center gap-3">
            {/* Headshot */}
            {isValidHeadshotUrl(headshotUrl) ? (
              <div
                className="w-14 h-14 rounded-sm overflow-hidden border-2 flex-shrink-0 bg-bg-secondary"
                style={{
                  borderColor: driver.current_team_color
                    ? `#${driver.current_team_color}`
                    : "var(--delta-neutral)",
                }}
              >
                <Image
                  src={headshotUrl}
                  alt={driver.full_name}
                  width={56}
                  height={56}
                  unoptimized={headshotUrl?.includes("wikimedia.org")}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div
                className="w-14 h-14 rounded-sm flex items-center justify-center text-xs font-bold text-text-tertiary border-2 bg-bg-secondary flex-shrink-0 font-mono"
                style={{
                  borderColor: driver.current_team_color
                    ? `#${driver.current_team_color}`
                    : "var(--delta-neutral)",
                }}
              >
                {driver.driver_code || "---"}
              </div>
            )}

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-text-primary font-bold truncate">
                  {driver.full_name}
                </h3>
                {isActive && (
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-500 flex-shrink-0" />
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-text-muted font-mono tracking-wider uppercase mt-0.5">
                {driver.driver_code && <span>{driver.driver_code}</span>}
                {driver.country_code && (
                  <>
                    <span className="text-border-secondary">/</span>
                    <span className="flex items-center gap-1">
                      <span>{getDriverFlagEmoji(driver.country_code)}</span>
                      <span className="hidden sm:inline">
                        {getCountryName(driver.country_code)}
                      </span>
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Wins */}
            <div className="flex-shrink-0 text-right">
              <div className="text-2xl font-bold text-text-primary tabular-nums">
                {driver.total_wins}
              </div>
              <div className="text-[10px] text-text-muted font-mono tracking-widest uppercase">
                wins
              </div>
            </div>
          </div>
        </Link>

        {/* Bottom bar */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border-primary">
          {driver.current_team && constructorUrl ? (
            <Link
              href={constructorUrl}
              className="text-xs text-text-muted hover:text-purple-300 transition-colors truncate"
            >
              {driver.current_team}
            </Link>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-3 text-[10px] text-text-muted font-mono tracking-wider">
            <span>{driver.total_races} races</span>
            <span className="text-border-secondary">/</span>
            <span>{driver.total_podiums} podiums</span>
            {driver.first_season && (
              <>
                <span className="text-border-secondary">/</span>
                <span>
                  {driver.first_season}–{isActive ? "" : driver.latest_season}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
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
  (a: DriverListItem, b: DriverListItem) => number
> = {
  wins: (a, b) =>
    b.total_wins - a.total_wins || b.total_points - a.total_points,
  races: (a, b) => b.total_races - a.total_races || b.total_wins - a.total_wins,
  points: (a, b) =>
    b.total_points - a.total_points || b.total_wins - a.total_wins,
  alpha: (a, b) => a.full_name.localeCompare(b.full_name),
};

function seasonRange(driver: DriverListItem): SeasonRange {
  return { first: driver.first_season, last: driver.latest_season };
}

function matchesSearch(driver: DriverListItem, query: string): boolean {
  return Boolean(
    driver.full_name.toLowerCase().includes(query) ||
      driver.driver_code?.toLowerCase().includes(query) ||
      driver.current_team?.toLowerCase().includes(query) ||
      (driver.country_code &&
        getCountryName(driver.country_code).toLowerCase().includes(query)),
  );
}

export default function DriversArchive() {
  const [includeSprint, setIncludeSprint] = useState(true);

  const { data, isLoading, isFetching } = useQuery({
    ...driversQuery(includeSprint),
    placeholderData: keepPreviousData,
  });

  const { data: availableYears = [] } = useQuery(seasonsQuery());

  return (
    <ArchiveListPage
      title="Drivers"
      allTimeSubtitle="All-Time Career Statistics"
      seasonSubtitle={(year) => `${year} Season Entries`}
      searchPlaceholder="Search by name, code, team, or country..."
      noun="drivers"
      items={data?.drivers}
      isLoading={isLoading}
      isFetching={isFetching}
      availableYears={availableYears}
      sortOptions={SORT_OPTIONS}
      defaultSort="wins"
      comparators={COMPARATORS}
      matchesSearch={matchesSearch}
      seasonRange={seasonRange}
      // Codes repeat across eras — MSC and MAG each cover two drivers — so the
      // canonical slug is the only stable identity here.
      itemKey={(driver) => driver.driver_slug || driver.full_name}
      renderCard={(driver) => <DriverCard driver={driver} />}
      gridClassName="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3"
      skeletonHeight="120px"
      sprintToggle={{ checked: includeSprint, onChange: setIncludeSprint }}
    />
  );
}
