"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fetchSeasons, fetchStandings, isValidHeadshotUrl } from "@/lib/api";
import { getCountryName, getDriverFlagEmoji } from "@/lib/flags";
import type { DriverStanding } from "@/lib/types";

function DriverCard({ driver }: { driver: DriverStanding }) {
  return (
    <div className="group bg-gradient-to-br from-bg-tertiary to-bg-elevated rounded-lg p-4 border border-border-primary hover:border-border-secondary transition-all">
      <Link
        href={`/drivers/${driver.driver_code}`}
        className="flex items-center gap-4"
      >
        {/* Position Badge */}
        <div className="flex-shrink-0 w-12 h-12 rounded-full bg-bg-secondary flex items-center justify-center">
          <span className="text-white font-bold text-lg">
            {driver.position}
          </span>
        </div>

        {/* Headshot */}
        {isValidHeadshotUrl(driver.headshot_url) ? (
          <Image
            src={driver.headshot_url}
            alt={driver.full_name}
            width={64}
            height={64}
            className="w-16 h-16 rounded-full object-cover border-2"
            style={{
              borderColor: driver.team_color ? `#${driver.team_color}` : "#888",
            }}
          />
        ) : (
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-sm font-bold text-text-tertiary border-2 bg-bg-secondary"
            style={{
              borderColor: driver.team_color ? `#${driver.team_color}` : "#888",
            }}
          >
            {driver.driver_code}
          </div>
        )}

        {/* Driver Info */}
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-bold text-lg truncate group-hover:text-red-500 transition-colors">
            {driver.full_name}
          </h3>
          <div className="flex items-center gap-2 text-sm text-text-tertiary">
            <span className="font-mono">{driver.driver_code}</span>
            {driver.country_code && (
              <>
                <span>•</span>
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

        {/* Points */}
        <div className="flex-shrink-0 text-right">
          <div className="text-2xl font-bold text-white">
            {driver.total_points}
          </div>
          <div className="text-xs text-text-muted">points</div>
        </div>
      </Link>

      {/* Team Link - Clickable separately */}
      <Link
        href={`/constructors/${driver.team_name.replace(/ /g, "-")}`}
        className="block text-sm text-text-muted hover:text-red-500 transition-colors mt-2 truncate"
        onClick={(e) => e.stopPropagation()}
      >
        {driver.team_name}
      </Link>
    </div>
  );
}

export default function DriversPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  const { data: seasons } = useQuery({
    queryKey: ["seasons"],
    queryFn: fetchSeasons,
  });

  // Set default year to most recent when seasons load
  useEffect(() => {
    if (seasons && seasons.length > 0 && selectedYear === null) {
      setSelectedYear(seasons[0]);
    }
  }, [seasons, selectedYear]);

  const { data: standings, isLoading } = useQuery({
    queryKey: ["standings", selectedYear],
    queryFn: () => {
      if (selectedYear === null) throw new Error("No year selected");
      return fetchStandings(selectedYear);
    },
    enabled: selectedYear !== null,
  });

  const filteredDrivers = useMemo(() => {
    if (!standings) return [];

    return standings.drivers.filter((driver) => {
      const query = searchQuery.toLowerCase();
      return (
        driver.full_name.toLowerCase().includes(query) ||
        driver.driver_code.toLowerCase().includes(query) ||
        driver.team_name.toLowerCase().includes(query) ||
        (driver.country_code &&
          getCountryName(driver.country_code).toLowerCase().includes(query))
      );
    });
  }, [standings, searchQuery]);

  return (
    <div className="min-h-screen bg-bg-secondary p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Drivers
          </h1>

          {/* Year Selector and Search */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            {/* Year Dropdown */}
            <div className="flex-shrink-0">
              <select
                value={selectedYear || ""}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="w-full sm:w-auto px-4 py-2 bg-bg-tertiary text-white border border-border-secondary rounded-lg focus:outline-none focus:border-red-500 transition-colors"
              >
                {seasons?.map((year) => (
                  <option key={year} value={year}>
                    {year} Season
                  </option>
                ))}
              </select>
            </div>

            {/* Search Bar */}
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search drivers, constructors, or countries..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 bg-bg-tertiary text-white border border-border-secondary rounded-lg focus:outline-none focus:border-red-500 transition-colors placeholder-text-muted"
              />
            </div>
          </div>

          {/* Quick Year Jump */}
          {seasons && seasons.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <span className="text-text-tertiary text-sm self-center mr-2">
                Quick jump:
              </span>
              {seasons.slice(0, 5).map((year) => (
                <button
                  type="button"
                  key={year}
                  onClick={() => setSelectedYear(year)}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                    selectedYear === year
                      ? "bg-red-500 text-white"
                      : "bg-bg-tertiary text-text-tertiary hover:text-white hover:bg-bg-elevated"
                  }`}
                >
                  {year}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 20 }, (_, i) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: Static loading skeleton items
                key={`skeleton-${i}`}
                className="h-24 bg-bg-elevated rounded-lg animate-pulse"
              />
            ))}
          </div>
        )}

        {/* Drivers Grid */}
        {!isLoading && filteredDrivers && filteredDrivers.length > 0 && (
          <div>
            <div className="mb-4 text-text-tertiary">
              {filteredDrivers.length} driver
              {filteredDrivers.length !== 1 ? "s" : ""} in {selectedYear}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredDrivers.map((driver) => (
                <DriverCard key={driver.driver_code} driver={driver} />
              ))}
            </div>
          </div>
        )}

        {/* No Results */}
        {!isLoading && filteredDrivers && filteredDrivers.length === 0 && (
          <div className="bg-bg-tertiary rounded-lg p-8 text-center">
            <p className="text-text-tertiary text-lg">
              No drivers found matching "{searchQuery}"
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
