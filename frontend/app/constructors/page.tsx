"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { useTheme } from "@/components/ThemeProvider";
import ExpandButton from "@/components/ui/ExpandButton";
import Skeleton from "@/components/ui/Skeleton";
import SortPills from "@/components/ui/SortPills";
import SprintToggle from "@/components/ui/SprintToggle";
import TiltCard from "@/components/ui/TiltCard";
import { apiHeaders, apiUrl, fetchSeasons } from "@/lib/api";
import {
  getConstructorLogoUrl,
  shouldInvertConstructorLogoOnLight,
} from "@/lib/entityImageOverrides";
import { constructorHref } from "@/lib/entityLinks";
import type { ConstructorListItem, ConstructorListResponse } from "@/lib/types";

type SortKey = "wins" | "races" | "points" | "alpha";

const CURRENT_YEAR = new Date().getFullYear();
const DEFAULT_VISIBLE_COUNT = 30;

async function fetchAllConstructors(
  includeSprint: boolean,
): Promise<ConstructorListResponse> {
  const params = new URLSearchParams();
  if (!includeSprint) params.set("include_sprint", "false");
  const url = params.toString()
    ? apiUrl(`/api/constructors/?${params}`)
    : apiUrl("/api/constructors/");
  const res = await fetch(url, { headers: apiHeaders() });
  if (!res.ok) throw new Error("Failed to fetch constructors");
  return res.json();
}

function ConstructorCard({ team }: { team: ConstructorListItem }) {
  const { theme } = useTheme();
  const teamUrl = constructorHref(team.team_name) ?? "/constructors";
  const isActive = team.latest_season === CURRENT_YEAR;
  const teamColor = team.team_color ? `#${team.team_color}` : "#888";
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

const CONSTRUCTOR_SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "wins", label: "Wins" },
  { key: "races", label: "Races" },
  { key: "points", label: "Points" },
  { key: "alpha", label: "A-Z" },
];

export default function ConstructorsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("wins");
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [includeSprint, setIncludeSprint] = useState(true);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["constructors-all", includeSprint],
    queryFn: () => fetchAllConstructors(includeSprint),
    placeholderData: keepPreviousData,
  });

  const { data: availableYears = [] } = useQuery<number[]>({
    queryKey: ["seasons"],
    queryFn: fetchSeasons,
    staleTime: 1000 * 60 * 60,
  });

  const filteredConstructors = useMemo(() => {
    if (!data) return [];

    let constructors = data.constructors;

    // Season filter
    if (selectedYear !== "all") {
      const yearNum = Number.parseInt(selectedYear, 10);
      constructors = constructors.filter((t) => {
        if (t.first_season === null || t.latest_season === null) return false;
        return (
          t.first_season <= yearNum &&
          (t.latest_season >= yearNum ||
            (t.latest_season === CURRENT_YEAR && yearNum === CURRENT_YEAR))
        );
      });
    }

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      constructors = constructors.filter((t) =>
        t.team_name.toLowerCase().includes(q),
      );
    }

    // Sort
    const sorted = [...constructors];
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
        sorted.sort((a, b) => a.team_name.localeCompare(b.team_name));
        break;
    }

    return sorted;
  }, [data, searchQuery, sortKey, selectedYear]);

  useEffect(() => {
    setIsExpanded(false);
  }, []);

  const visibleConstructors = isExpanded
    ? filteredConstructors
    : filteredConstructors.slice(0, DEFAULT_VISIBLE_COUNT);

  return (
    <div className="min-h-screen bg-bg-secondary">
      <PageHeader
        title="Constructors"
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
            placeholder="Search by team name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-3 py-2 bg-bg-primary text-text-primary border border-border-primary rounded-sm font-mono text-xs focus:outline-none focus:border-purple-500 transition-colors placeholder-text-muted"
          />
          <SortPills
            active={sortKey}
            onChange={setSortKey}
            options={CONSTRUCTOR_SORT_OPTIONS}
          />
        </div>

        {/* Stats bar */}
        {data && (
          <div className="flex items-center justify-between mb-6">
            <span className="text-[10px] text-text-muted font-mono tracking-widest uppercase">
              {filteredConstructors.length} total constructors
            </span>
            <SprintToggle
              checked={includeSprint}
              onChange={setIncludeSprint}
              isLoading={isFetching}
            />
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
                height="110px"
                className="rounded-sm"
              />
            ))}
          </div>
        )}

        {/* Grid */}
        {!isLoading && filteredConstructors.length > 0 && (
          <div
            className={`transition-opacity duration-150 ${isFetching ? "opacity-50" : ""}`}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {visibleConstructors.map((team) => (
                <ConstructorCard key={team.team_name} team={team} />
              ))}
            </div>
          </div>
        )}

        {!isLoading && filteredConstructors.length > DEFAULT_VISIBLE_COUNT && (
          <ExpandButton
            isExpanded={isExpanded}
            onToggle={() => setIsExpanded(!isExpanded)}
            remainingCount={filteredConstructors.length - DEFAULT_VISIBLE_COUNT}
          />
        )}

        {/* Empty */}
        {!isLoading && filteredConstructors.length === 0 && data && (
          <div className="border border-border-primary rounded-sm p-8 text-center">
            <p className="text-text-muted font-mono text-sm">
              No constructors found matching "{searchQuery}"
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
