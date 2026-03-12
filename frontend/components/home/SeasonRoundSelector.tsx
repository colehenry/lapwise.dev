"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiHeaders, apiUrl, fetchSeasons } from "@/lib/api";
import type { RoundSummary } from "@/lib/types";

export default function SeasonRoundSelector() {
  const router = useRouter();
  const [selectedSeason, setSelectedSeason] = useState<string>("");
  const [selectedRound, setSelectedRound] = useState<string>("");

  const { data: seasons = [] } = useQuery<number[]>({
    queryKey: ["seasons"],
    queryFn: fetchSeasons,
    staleTime: 1000 * 60 * 60,
  });

  useEffect(() => {
    if (seasons.length > 0 && !selectedSeason) {
      setSelectedSeason(String(Math.max(...seasons)));
    }
  }, [seasons, selectedSeason]);

  const { data: rounds = [] } = useQuery<RoundSummary[]>({
    queryKey: ["rounds-minimal", selectedSeason],
    queryFn: async () => {
      const res = await fetch(apiUrl(`/api/results/${selectedSeason}`), {
        headers: apiHeaders(),
      });
      if (!res.ok) return [];
      const data = await res.json();
      return data.rounds || [];
    },
    enabled: !!selectedSeason,
    staleTime: 1000 * 60 * 60,
  });

  const handleGo = () => {
    if (selectedSeason) {
      if (selectedRound) {
        router.push(`/results/${selectedSeason}/${selectedRound}`);
      } else {
        router.push(`/results/${selectedSeason}`);
      }
    }
  };

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 max-w-xl">
      <div className="flex-1 flex gap-2">
        {/* Season Selector */}
        <div className="relative flex-1">
          <select
            value={selectedSeason}
            onChange={(e) => {
              setSelectedSeason(e.target.value);
              setSelectedRound("");
            }}
            className="w-full bg-bg-tertiary border border-border-primary text-text-primary font-mono text-xs font-bold px-4 py-3 rounded-sm focus:outline-none focus:border-purple-500 transition-colors duration-150 cursor-pointer uppercase tracking-widest appearance-none"
          >
            <option value="" disabled>
              Season
            </option>
            {seasons.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <title>Select season</title>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </div>

        {/* Round Selector */}
        <div className="relative flex-1">
          <select
            value={selectedRound}
            onChange={(e) => setSelectedRound(e.target.value)}
            disabled={!selectedSeason || rounds.length === 0}
            className="w-full bg-bg-tertiary border border-border-primary text-text-primary font-mono text-xs font-bold px-4 py-3 rounded-sm focus:outline-none focus:border-purple-500 transition-colors duration-150 cursor-pointer uppercase tracking-widest appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">All Rounds</option>
            {rounds.map((round) => (
              <option key={round.round} value={round.round}>
                R{String(round.round).padStart(2, "0")} - {round.event_name}
              </option>
            ))}
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <title>Select round</title>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={handleGo}
        disabled={!selectedSeason}
        className="bg-purple-500 border border-purple-500 text-white font-mono text-xs font-bold tracking-widest uppercase px-6 py-3 rounded-sm hover:bg-purple-600 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        Go
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <title>Go to results</title>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 7l5 5m0 0l-5 5m5-5H6"
          />
        </svg>
      </button>
    </div>
  );
}
