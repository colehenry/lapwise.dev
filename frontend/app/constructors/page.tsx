"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

interface ConstructorStanding {
  position: number;
  team_name: string;
  team_color: string | null;
  total_points: number;
}

interface StandingsResponse {
  year: number;
  constructors: ConstructorStanding[];
}

async function fetchSeasons(): Promise<number[]> {
  const apiKey = process.env.NEXT_PUBLIC_API_KEY || "";
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/results/seasons`,
    {
      headers: {
        "X-API-Key": apiKey,
      },
    },
  );

  if (!res.ok) {
    throw new Error("Failed to fetch seasons");
  }

  return res.json();
}

async function fetchStandings(season: number): Promise<StandingsResponse> {
  const apiKey = process.env.NEXT_PUBLIC_API_KEY || "";
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/results/${season}/standings`,
    {
      headers: {
        "X-API-Key": apiKey,
      },
    },
  );

  if (!res.ok) {
    throw new Error("Failed to fetch standings");
  }

  return res.json();
}

function ConstructorCard({ team }: { team: ConstructorStanding }) {
  // URL-encode the team name for the link
  const teamNameUrl = team.team_name.replace(/ /g, "-");

  return (
    <Link
      href={`/constructors/${teamNameUrl}`}
      className="group bg-gradient-to-br from-[#1e1e2e] to-[#2a2a3e] rounded-lg p-4 border border-gray-800 hover:border-gray-600 transition-all hover:scale-105"
    >
      <div className="flex items-center gap-4">
        {/* Position Badge */}
        <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#15151e] flex items-center justify-center">
          <span className="text-white font-bold text-lg">{team.position}</span>
        </div>

        {/* Team Color Badge */}
        <div
          className="w-16 h-16 rounded-full border-4"
          style={{
            backgroundColor: team.team_color ? `#${team.team_color}` : "#888",
            borderColor: team.team_color ? `#${team.team_color}` : "#888",
          }}
        />

        {/* Constructor Info */}
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-bold text-lg truncate group-hover:text-[#e10600] transition-colors">
            {team.team_name}
          </h3>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span className="font-mono">
              P{team.position} • {team.total_points} pts
            </span>
          </div>
        </div>

        {/* Points */}
        <div className="flex-shrink-0 text-right">
          <div className="text-2xl font-bold text-white">
            {team.total_points}
          </div>
          <div className="text-xs text-gray-500">points</div>
        </div>
      </div>
    </Link>
  );
}

export default function ConstructorsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  // Fetch available seasons
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

  // Fetch standings for selected year
  const { data: standings, isLoading } = useQuery({
    queryKey: ["standings", selectedYear],
    queryFn: () => {
      if (selectedYear === null) {
        throw new Error("No year selected");
      }
      return fetchStandings(selectedYear);
    },
    enabled: selectedYear !== null,
  });

  // Filter constructors based on search query
  const filteredConstructors = useMemo(() => {
    if (!standings) return [];

    return standings.constructors.filter((team) => {
      const query = searchQuery.toLowerCase();
      return team.team_name.toLowerCase().includes(query);
    });
  }, [standings, searchQuery]);

  return (
    <div className="min-h-screen bg-[#15151e] p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
            F1 Constructors
          </h1>

          {/* Year Selector and Search */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            {/* Year Dropdown */}
            <div className="flex-shrink-0">
              <select
                value={selectedYear || ""}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="w-full sm:w-auto px-4 py-2 bg-[#1e1e2e] text-white border border-gray-700 rounded-lg focus:outline-none focus:border-[#e10600] transition-colors"
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
                placeholder="Search constructors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 bg-[#1e1e2e] text-white border border-gray-700 rounded-lg focus:outline-none focus:border-[#e10600] transition-colors placeholder-gray-500"
              />
            </div>
          </div>

          {/* Quick Year Jump */}
          {seasons && seasons.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <span className="text-gray-400 text-sm self-center mr-2">
                Quick jump:
              </span>
              {seasons.slice(0, 5).map((year) => (
                <button
                  type="button"
                  key={year}
                  onClick={() => setSelectedYear(year)}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                    selectedYear === year
                      ? "bg-[#e10600] text-white"
                      : "bg-[#1e1e2e] text-gray-400 hover:text-white hover:bg-[#2a2a3e]"
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
            {Array.from({ length: 10 }, (_, i) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: Static loading skeleton items
                key={`skeleton-${i}`}
                className="h-24 bg-[#2a2a3e] rounded-lg animate-pulse"
              />
            ))}
          </div>
        )}

        {/* Constructors Grid */}
        {!isLoading &&
          filteredConstructors &&
          filteredConstructors.length > 0 && (
            <div>
              <div className="mb-4 text-gray-400">
                {filteredConstructors.length} constructor
                {filteredConstructors.length !== 1 ? "s" : ""} in {selectedYear}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredConstructors.map((team) => (
                  <ConstructorCard key={team.team_name} team={team} />
                ))}
              </div>
            </div>
          )}

        {/* No Results */}
        {!isLoading &&
          filteredConstructors &&
          filteredConstructors.length === 0 && (
            <div className="bg-[#1e1e2e] rounded-lg p-8 text-center">
              <p className="text-gray-400 text-lg">
                No constructors found matching "{searchQuery}"
              </p>
            </div>
          )}
      </div>
    </div>
  );
}
