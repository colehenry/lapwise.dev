"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { GridPattern } from "@/components/Patterns";
import Skeleton from "@/components/ui/Skeleton";
import TiltCard from "@/components/ui/TiltCard";
import { apiHeaders, apiUrl } from "@/lib/api";
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
              <Image
                src={`/track-maps/${circuit.id}.png`}
                alt={`${circuit.name} track map`}
                width={80}
                height={80}
                className="object-contain w-full h-full"
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

function SortPills({
  active,
  onChange,
}: {
  active: SortKey;
  onChange: (key: SortKey) => void;
}) {
  const options: { key: SortKey; label: string }[] = [
    { key: "races", label: "Races" },
    { key: "recent", label: "Recent" },
    { key: "alpha", label: "A-Z" },
  ];

  return (
    <div className="flex items-center gap-1">
      {options.map((opt) => (
        <button
          key={opt.key}
          type="button"
          onClick={() => onChange(opt.key)}
          className={`px-3 py-1 rounded-sm text-xs font-mono tracking-wider uppercase transition-colors ${
            active === opt.key
              ? "bg-purple-500 text-white"
              : "bg-bg-primary text-text-muted hover:text-text-primary hover:bg-bg-elevated border border-border-primary"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export default function CircuitsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("races");
  const [isExpanded, setIsExpanded] = useState(false);

  const { data: circuitsData, isLoading } = useQuery({
    queryKey: ["circuits"],
    queryFn: fetchCircuits,
  });

  const filteredCircuits = useMemo(() => {
    if (!circuitsData) return [];

    let circuits = circuitsData.circuits;

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
  }, [circuitsData, searchQuery, sortKey]);

  useEffect(() => {
    setIsExpanded(false);
  }, [searchQuery, sortKey]);

  const visibleCircuits = isExpanded
    ? filteredCircuits
    : filteredCircuits.slice(0, DEFAULT_VISIBLE_COUNT);

  return (
    <div className="min-h-screen bg-bg-secondary">
      {/* Header */}
      <div className="relative overflow-hidden border-b border-border-primary">
        <GridPattern
          id="circuits-grid"
          className="absolute inset-0 w-full h-full text-purple-500 opacity-[0.06] pointer-events-none"
        />
        <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-8 py-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
            <span className="text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono">
              All-Time Statistics
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-text-primary tracking-tight">
            Circuits
          </h1>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-8 py-6">
        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <input
            type="text"
            placeholder="Search by circuit, location, or country..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-3 py-2 bg-bg-primary text-text-primary border border-border-primary rounded-sm font-mono text-xs focus:outline-none focus:border-purple-500 transition-colors placeholder-text-muted"
          />
          <SortPills active={sortKey} onChange={setSortKey} />
        </div>

        {/* Stats bar */}
        {circuitsData && (
          <div className="text-[10px] text-text-muted font-mono tracking-widest uppercase mb-6">
            {filteredCircuits.length} circuits across F1 history
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
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="border border-border-secondary rounded-sm text-text-secondary hover:border-purple-500 hover:text-purple-300 font-mono text-xs uppercase tracking-widest px-6 py-2 transition-colors duration-150 flex items-center gap-2"
            >
              {isExpanded
                ? "COLLAPSE"
                : `SHOW ALL (${filteredCircuits.length - DEFAULT_VISIBLE_COUNT} more)`}
              <svg
                className={`w-3 h-3 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
          </div>
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
