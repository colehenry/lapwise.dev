"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import ExpandButton from "@/components/ui/ExpandButton";
import Skeleton from "@/components/ui/Skeleton";
import SortPills from "@/components/ui/SortPills";
import TiltCard from "@/components/ui/TiltCard";
import {
  apiHeaders,
  apiUrl,
  fetchSeasons,
  isValidHeadshotUrl,
} from "@/lib/api";
import { getDriverHeadshotUrl } from "@/lib/entityImageOverrides";
import { getCountryName, getDriverFlagEmoji } from "@/lib/flags";
import type { DriverListItem, DriverListResponse } from "@/lib/types";

type SortKey = "wins" | "races" | "points" | "alpha";

const CURRENT_YEAR = new Date().getFullYear();
const DEFAULT_VISIBLE_COUNT = 30;

async function fetchAllDrivers(): Promise<DriverListResponse> {
  const res = await fetch(apiUrl("/api/drivers/"), {
    headers: apiHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch drivers");
  return res.json();
}

function DriverCard({ driver }: { driver: DriverListItem }) {
  const isActive = driver.latest_season === CURRENT_YEAR;
  const headshotUrl = getDriverHeadshotUrl(driver);
  const driverSlug =
    driver.driver_slug ||
    driver.driver_code ||
    driver.full_name.toLowerCase().replace(/\s+/g, "-");
  const constructorSlug = driver.current_team?.replace(/\s+/g, "-");

  return (
    <TiltCard>
      <div className="relative border border-border-primary rounded-sm p-4 hover:border-purple-500 transition-all duration-200 bg-bg-tertiary h-full">
        <Link href={`/drivers/${driverSlug}`} className="block">
          <div className="flex items-center gap-3">
            {/* Headshot */}
            {isValidHeadshotUrl(headshotUrl) ? (
              <div
                className="w-14 h-14 rounded-sm overflow-hidden border-2 flex-shrink-0 bg-bg-secondary"
                style={{
                  borderColor: driver.current_team_color
                    ? `#${driver.current_team_color}`
                    : "#888",
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
                    : "#888",
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
          {driver.current_team && constructorSlug ? (
            <Link
              href={`/constructors/${constructorSlug}`}
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

const DRIVER_SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "wins", label: "Wins" },
  { key: "races", label: "Races" },
  { key: "points", label: "Points" },
  { key: "alpha", label: "A-Z" },
];

export default function DriversPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("wins");
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedYear, setSelectedYear] = useState<string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["drivers-all"],
    queryFn: fetchAllDrivers,
  });

  const { data: availableYears = [] } = useQuery<number[]>({
    queryKey: ["seasons"],
    queryFn: fetchSeasons,
    staleTime: 1000 * 60 * 60,
  });

  const filteredDrivers = useMemo(() => {
    if (!data) return [];

    let drivers = data.drivers;

    // Season filter
    if (selectedYear !== "all") {
      const yearNum = Number.parseInt(selectedYear, 10);
      drivers = drivers.filter((d) => {
        if (d.first_season === null || d.latest_season === null) return false;
        return (
          d.first_season <= yearNum &&
          (d.latest_season >= yearNum ||
            (d.latest_season === CURRENT_YEAR && yearNum === CURRENT_YEAR))
        );
      });
    }

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      drivers = drivers.filter(
        (d) =>
          d.full_name.toLowerCase().includes(q) ||
          d.driver_code?.toLowerCase().includes(q) ||
          d.current_team?.toLowerCase().includes(q) ||
          (d.country_code &&
            getCountryName(d.country_code).toLowerCase().includes(q)),
      );
    }

    // Sort
    const sorted = [...drivers];
    switch (sortKey) {
      case "wins":
        sorted.sort(
          (a, b) =>
            b.total_wins - a.total_wins || b.total_points - a.total_points,
        );
        break;
      case "races":
        sorted.sort(
          (a, b) =>
            b.total_races - a.total_races || b.total_wins - a.total_wins,
        );
        break;
      case "points":
        sorted.sort(
          (a, b) =>
            b.total_points - a.total_points || b.total_wins - a.total_wins,
        );
        break;
      case "alpha":
        sorted.sort((a, b) => a.full_name.localeCompare(b.full_name));
        break;
    }

    return sorted;
  }, [data, searchQuery, sortKey, selectedYear]);

  useEffect(() => {
    setIsExpanded(false);
  }, []);

  const visibleDrivers = isExpanded
    ? filteredDrivers
    : filteredDrivers.slice(0, DEFAULT_VISIBLE_COUNT);

  return (
    <div className="min-h-screen bg-bg-secondary">
      <PageHeader
        title="Drivers"
        subtitle={
          selectedYear === "all"
            ? "All-Time Career Statistics"
            : `${selectedYear} Season Entries`
        }
        compactMobile
      >
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(e.target.value)}
          className="w-28 bg-bg-primary border border-border-primary text-text-primary font-mono text-xs font-bold px-3 py-2 md:py-1.5 rounded-sm focus:outline-none focus:border-purple-500 transition-colors duration-150 cursor-pointer uppercase tracking-widest"
        >
          <option value="all">ALL TIME</option>
          {availableYears.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </PageHeader>

      <div className="max-w-6xl mx-auto px-3 py-3 md:px-8 md:py-6">
        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <input
            type="text"
            placeholder="Search by name, code, team, or country..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-3 py-2 bg-bg-primary text-text-primary border border-border-primary rounded-sm font-mono text-xs focus:outline-none focus:border-purple-500 transition-colors placeholder-text-muted"
          />
          <SortPills
            active={sortKey}
            onChange={setSortKey}
            options={DRIVER_SORT_OPTIONS}
          />
        </div>

        {/* Stats bar */}
        {data && (
          <div className="text-[10px] text-text-muted font-mono tracking-widest uppercase mb-6">
            {filteredDrivers.length} total drivers
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 12 }, (_, i) => (
              <Skeleton
                key={`skel-${
                  // biome-ignore lint/suspicious/noArrayIndexKey: Static loading skeleton
                  i
                }`}
                variant="rectangular"
                height="120px"
                className="rounded-sm"
              />
            ))}
          </div>
        )}

        {/* Grid */}
        {!isLoading && filteredDrivers.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {visibleDrivers.map((driver) => (
              <DriverCard
                key={driver.driver_code || driver.full_name}
                driver={driver}
              />
            ))}
          </div>
        )}

        {!isLoading && filteredDrivers.length > DEFAULT_VISIBLE_COUNT && (
          <ExpandButton
            isExpanded={isExpanded}
            onToggle={() => setIsExpanded(!isExpanded)}
            remainingCount={filteredDrivers.length - DEFAULT_VISIBLE_COUNT}
          />
        )}

        {/* Empty */}
        {!isLoading && filteredDrivers.length === 0 && data && (
          <div className="border border-border-primary rounded-sm p-8 text-center">
            <p className="text-text-muted font-mono text-sm">
              No drivers found matching "{searchQuery}"
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
