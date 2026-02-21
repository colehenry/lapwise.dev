"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { apiHeaders, apiUrl } from "@/lib/api";
import { getCircuitFlagEmoji } from "@/lib/flags";
import type { CircuitInfo } from "@/lib/types";

interface CircuitsResponse {
  circuits: CircuitInfo[];
  total: number;
}

async function fetchCircuits(): Promise<CircuitsResponse> {
  const res = await fetch(apiUrl("/api/circuits"), {
    headers: apiHeaders(),
  });

  if (!res.ok) {
    throw new Error("Failed to fetch circuits");
  }

  return res.json();
}

function CircuitCard({ circuit }: { circuit: CircuitInfo }) {
  return (
    <Link href={`/circuits/${circuit.id}`} className="block h-full">
      <div className="group bg-gradient-to-br from-bg-tertiary to-bg-elevated rounded-lg p-4 border border-border-primary hover:border-border-secondary transition-all hover:scale-105 h-full">
        <div className="flex items-center gap-4">
          {/* Circuit Icon */}
          <div className="flex-shrink-0 w-24 h-24 rounded-xl bg-bg-secondary flex items-center justify-center border-4 border-border-secondary group-hover:border-red-500 transition-colors p-2">
            <Image
              src={`/track-maps/${circuit.id}.png`}
              alt={`${circuit.name} track map`}
              width={96}
              height={96}
              className="object-contain w-full h-full"
            />
          </div>

          {/* Circuit Info */}
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-bold text-lg truncate group-hover:text-red-500 transition-colors">
              {circuit.name}
            </h3>
            <div className="flex items-center gap-2 text-sm text-text-tertiary">
              <span>{circuit.location}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <span>{getCircuitFlagEmoji(circuit.country)}</span>
                <span>{circuit.country}</span>
              </span>
              <span>•</span>
              {circuit.track_length_km && (
                <span className="text-red-500 font-semibold">
                  {circuit.track_length_km.toFixed(3)} km
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-text-muted mt-1">
              <span>
                {circuit.first_year === circuit.most_recent_year
                  ? circuit.first_year
                  : `${circuit.first_year} - ${circuit.most_recent_year}`}
              </span>
            </div>
          </div>

          {/* Stats */}
          <div className="flex-shrink-0 text-right">
            <div className="text-2xl font-bold text-white">
              {circuit.total_races}
            </div>
            <div className="text-xs text-text-muted">races</div>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function TracksPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: circuitsData, isLoading } = useQuery({
    queryKey: ["circuits"],
    queryFn: fetchCircuits,
  });

  const filteredCircuits = useMemo(() => {
    if (!circuitsData) return [];

    return circuitsData.circuits.filter((circuit) => {
      const query = searchQuery.toLowerCase();
      return (
        circuit.name.toLowerCase().includes(query) ||
        circuit.location.toLowerCase().includes(query) ||
        circuit.country.toLowerCase().includes(query)
      );
    });
  }, [circuitsData, searchQuery]);

  return (
    <div className="min-h-screen bg-bg-secondary p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Circuits
          </h1>

          {/* Search Bar */}
          <div className="mb-6">
            <input
              type="text"
              placeholder="Search circuits, locations, or countries..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 bg-bg-tertiary text-white border border-border-secondary rounded-lg focus:outline-none focus:border-red-500 transition-colors placeholder-text-muted"
            />
          </div>

          {/* Stats */}
          {circuitsData && (
            <div className="text-text-tertiary text-sm">
              {filteredCircuits.length} circuit
              {filteredCircuits.length !== 1 ? "s" : ""} across F1 history
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

        {/* Circuits Grid */}
        {!isLoading && filteredCircuits && filteredCircuits.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredCircuits.map((circuit) => (
              <CircuitCard key={circuit.id} circuit={circuit} />
            ))}
          </div>
        )}

        {/* No Results */}
        {!isLoading && filteredCircuits && filteredCircuits.length === 0 && (
          <div className="bg-bg-tertiary rounded-lg p-8 text-center">
            <p className="text-text-tertiary text-lg">
              No circuits found matching "{searchQuery}"
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
