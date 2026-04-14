"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import TrackMapImage from "@/components/TrackMapImage";
import ExpandButton from "@/components/ui/ExpandButton";
import Skeleton from "@/components/ui/Skeleton";
import SortPills from "@/components/ui/SortPills";
import TiltCard from "@/components/ui/TiltCard";
import { apiHeaders, apiUrl, fetchSeasons } from "@/lib/api";
import { getCircuitFlagEmoji } from "@/lib/flags";
import type { CircuitInfo } from "@/lib/types";

type SortKey = "races" | "recent" | "alpha";
const CURRENT_YEAR = new Date().getFullYear();
const DEFAULT_VISIBLE_COUNT = 30;

interface CircuitsResponse {
  circuits: CircuitInfo[];
  total: number;
}

async function fetchCircuits(): Promise<CircuitsResponse> {
  const res = await fetch(apiUrl("/api/circuits/"), {
    headers: apiHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch circuits");
  return res.json();
}

function CircuitCard({ circuit }: { circuit: CircuitInfo }) {
  return (
    <TiltCard>
      <Link href={`/circuits/${circuit.id}`} className="block h-full">
        <div className="relative border border-border-primary rounded-sm p-4 hover:border-purple-500 transition-all duration-200 bg-bg-tertiary h-full">
          <div className="flex items-center gap-4">
            {/* Track map */}
            <div className="flex-shrink-0 w-20 h-20 rounded-sm bg-bg-secondary flex items-center justify-center border border-border-primary p-2">
              <TrackMapImage
                circuitId={circuit.id}
                circuitName={circuit.name}
                width={80}
                height={80}
                className="object-contain w-full h-full"
                fallbackClassName="h-full w-full px-2"
              />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h3 className="text-text-primary font-bold truncate">
                {circuit.name}
              </h3>
              <div className="flex items-center gap-2 text-xs text-text-muted mt-0.5">
                <span>{circuit.location}</span>
                <span className="text-border-secondary">/</span>
                <span className="flex items-center gap-1">
                  <span>{getCircuitFlagEmoji(circuit.country)}</span>
                  <span>{circuit.country}</span>
                </span>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-text-muted font-mono tracking-wider mt-2">
                {circuit.track_length_km && (
                  <>
                    <span className="text-purple-400">
                      {circuit.track_length_km.toFixed(3)} km
                    </span>
                    <span className="text-border-secondary">/</span>
                  </>
                )}
                <span>
                  {circuit.most_recent_year === CURRENT_YEAR
                    ? `${circuit.first_year}–`
                    : circuit.first_year === circuit.most_recent_year
                      ? circuit.first_year
                      : `${circuit.first_year}–${circuit.most_recent_year}`}
                </span>
              </div>
            </div>

            {/* Race count */}
            <div className="flex-shrink-0 text-right">
              <div className="text-2xl font-bold text-text-primary tabular-nums">
                {circuit.total_races}
              </div>
              <div className="text-[10px] text-text-muted font-mono tracking-widest uppercase">
                races
              </div>
            </div>
          </div>
        </div>
      </Link>
    </TiltCard>
  );
}

const CIRCUIT_SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "races", label: "Races" },
  { key: "recent", label: "Recent" },
  { key: "alpha", label: "A-Z" },
];

export default function CircuitsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("races");
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedYear, setSelectedYear] = useState<string>("all");

  const { data: circuitsData, isLoading } = useQuery({
    queryKey: ["circuits"],
    queryFn: fetchCircuits,
  });

  const { data: availableYears = [] } = useQuery<number[]>({
    queryKey: ["seasons"],
    queryFn: fetchSeasons,
    staleTime: 1000 * 60 * 60,
  });

  const filteredCircuits = useMemo(() => {
    if (!circuitsData) return [];

    let circuits = circuitsData.circuits;

    // Season filter
    if (selectedYear !== "all") {
      const yearNum = Number.parseInt(selectedYear, 10);
      circuits = circuits.filter(
        (c) =>
          c.first_year <= yearNum &&
          (c.most_recent_year >= yearNum ||
            (c.most_recent_year === CURRENT_YEAR && yearNum === CURRENT_YEAR)),
      );
    }

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      circuits = circuits.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.location.toLowerCase().includes(q) ||
          c.country.toLowerCase().includes(q),
      );
    }

    // Sort
    const sorted = [...circuits];
    switch (sortKey) {
      case "races":
        sorted.sort((a, b) => b.total_races - a.total_races);
        break;
      case "recent":
        sorted.sort((a, b) => b.most_recent_year - a.most_recent_year);
        break;
      case "alpha":
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }

    return sorted;
  }, [circuitsData, searchQuery, sortKey, selectedYear]);

  useEffect(() => {
    setIsExpanded(false);
  }, []);

  const visibleCircuits = isExpanded
    ? filteredCircuits
    : filteredCircuits.slice(0, DEFAULT_VISIBLE_COUNT);

  return (
    <div className="min-h-screen bg-bg-secondary">
      <PageHeader
        title="Circuits"
        subtitle={
          selectedYear === "all"
            ? "All-Time Track Statistics"
            : `${selectedYear} Season Calendar`
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
            placeholder="Search by circuit, location, or country..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-3 py-2 bg-bg-primary text-text-primary border border-border-primary rounded-sm font-mono text-xs focus:outline-none focus:border-purple-500 transition-colors placeholder-text-muted"
          />
          <SortPills
            active={sortKey}
            onChange={setSortKey}
            options={CIRCUIT_SORT_OPTIONS}
          />
        </div>

        {/* Stats bar */}
        {circuitsData && (
          <div className="text-[10px] text-text-muted font-mono tracking-widest uppercase mb-6">
            {filteredCircuits.length} total circuits
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Array.from({ length: 12 }, (_, i) => (
              <Skeleton
                key={`skel-${
                  // biome-ignore lint/suspicious/noArrayIndexKey: Static loading skeleton
                  i
                }`}
                variant="rectangular"
                height="100px"
                className="rounded-sm"
              />
            ))}
          </div>
        )}

        {/* Grid */}
        {!isLoading && filteredCircuits.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {visibleCircuits.map((circuit) => (
              <CircuitCard key={circuit.id} circuit={circuit} />
            ))}
          </div>
        )}

        {!isLoading && filteredCircuits.length > DEFAULT_VISIBLE_COUNT && (
          <ExpandButton
            isExpanded={isExpanded}
            onToggle={() => setIsExpanded(!isExpanded)}
            remainingCount={filteredCircuits.length - DEFAULT_VISIBLE_COUNT}
          />
        )}

        {/* Empty */}
        {!isLoading && filteredCircuits.length === 0 && circuitsData && (
          <div className="border border-border-primary rounded-sm p-8 text-center">
            <p className="text-text-muted font-mono text-sm">
              No circuits found matching "{searchQuery}"
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
