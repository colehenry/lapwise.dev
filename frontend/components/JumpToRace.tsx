"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { apiHeaders, apiUrl } from "@/lib/api";

type RoundOption = {
  round: number;
  event_name: string;
  session_type: string;
};

type JumpToRaceProps = {
  currentSeason: string;
  availableSeasons: number[];
  label?: string;
  excludeRound?: number;
};

export default function JumpToRace({
  currentSeason,
  availableSeasons,
  label = "Jump to Wknd",
  excludeRound,
}: JumpToRaceProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState<string>(currentSeason);
  const [selectedRound, setSelectedRound] = useState<string>("");
  const [sessionType, setSessionType] = useState<"race" | "qualifying">("race");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const { data: rounds = [], isLoading: loadingRounds } = useQuery({
    queryKey: ["jump-rounds", selectedSeason, sessionType],
    queryFn: async () => {
      const endpoint =
        sessionType === "qualifying"
          ? `/api/results/${selectedSeason}/qualifying`
          : `/api/results/${selectedSeason}`;

      const response = await fetch(apiUrl(endpoint), {
        headers: apiHeaders(),
        cache: "no-store",
      });

      if (!response.ok) return [];

      const data = await response.json();
      return data.rounds.map(
        (r: { round: number; event_name: string; session_type: string }) => ({
          round: r.round,
          event_name: r.event_name,
          session_type: r.session_type,
        }),
      ) as RoundOption[];
    },
    enabled: isOpen && !!selectedSeason,
  });

  // Reset round when season or sessionType changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional reset on season/sessionType change
  useEffect(() => {
    setSelectedRound("");
  }, [selectedSeason, sessionType]);

  const handleJump = () => {
    if (!selectedSeason || !selectedRound) return;

    const selectedRoundData = rounds.find((r) => {
      const key = `${r.round}-${r.session_type}`;
      return key === selectedRound;
    });

    if (!selectedRoundData) return;

    const modeParam = sessionType === "qualifying" ? "?tab=qualifying" : "";

    if (
      selectedRoundData.session_type === "sprint_race" ||
      selectedRoundData.session_type === "sprint_qualifying"
    ) {
      router.push(
        `/results/${selectedSeason}/${selectedRoundData.round}/sprint${modeParam}`,
      );
    } else {
      router.push(
        `/results/${selectedSeason}/${selectedRoundData.round}${modeParam}`,
      );
    }

    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="bg-bg-primary border border-border-primary text-text-primary font-mono text-xs font-bold px-4 py-2 rounded-sm hover:border-purple-500 hover:text-purple-300 transition-colors duration-150 cursor-pointer flex items-center gap-2 uppercase tracking-widest"
      >
        <span>{label}</span>
        <svg
          className={`w-3 h-3 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <title>Toggle dropdown</title>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-bg-tertiary border border-border-primary rounded-sm shadow-xl z-50 p-4">
          <div className="mb-4">
            <label
              htmlFor="jump-season"
              className="block text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono mb-2"
            >
              Season
            </label>
            <select
              id="jump-season"
              value={selectedSeason}
              onChange={(e) => setSelectedSeason(e.target.value)}
              className="w-full px-3 py-2 bg-bg-primary border border-border-primary rounded-sm text-text-primary font-mono text-sm focus:outline-none focus:border-purple-500 transition-colors duration-150"
            >
              {availableSeasons.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <span className="block text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono mb-2">
              Session Type
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setSessionType("race")}
                className={`flex-1 px-3 py-1.5 rounded-sm text-xs font-bold font-mono uppercase tracking-widest transition-colors duration-150 ${
                  sessionType === "race"
                    ? "bg-purple-500/20 border border-purple-500 text-purple-300"
                    : "border border-transparent text-text-muted hover:text-text-secondary"
                }`}
              >
                Race
              </button>
              <button
                type="button"
                onClick={() => setSessionType("qualifying")}
                className={`flex-1 px-3 py-1.5 rounded-sm text-xs font-bold font-mono uppercase tracking-widest transition-colors duration-150 ${
                  sessionType === "qualifying"
                    ? "bg-purple-500/20 border border-purple-500 text-purple-300"
                    : "border border-transparent text-text-muted hover:text-text-secondary"
                }`}
              >
                Qualifying
              </button>
            </div>
          </div>

          <div className="mb-4">
            <label
              htmlFor="jump-round"
              className="block text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono mb-2"
            >
              Round
            </label>
            {loadingRounds ? (
              <div className="flex items-center justify-center py-8 text-text-muted font-mono text-xs tracking-widest uppercase">
                Loading rounds...
              </div>
            ) : rounds.length > 0 ? (
              <select
                id="jump-round"
                value={selectedRound}
                onChange={(e) => setSelectedRound(e.target.value)}
                className="w-full px-3 py-2 bg-bg-primary border border-border-primary rounded-sm text-text-primary font-mono text-sm focus:outline-none focus:border-purple-500 transition-colors duration-150"
              >
                <option value="">Select a round...</option>
                {rounds.filter((r) => excludeRound == null || r.round !== excludeRound).map((r) => {
                  const key = `${r.round}-${r.session_type}`;
                  const isSprintRace = r.session_type === "sprint_race";
                  const isSprintQuali = r.session_type === "sprint_qualifying";
                  const isRegularQuali = r.session_type === "qualifying";

                  return (
                    <option key={key} value={key}>
                      R{String(r.round).padStart(2, "0")}
                      {isSprintRace ? " Sprint" : ""}
                      {isSprintQuali ? " Sprint Quali" : ""}
                      {isRegularQuali ? " Quali" : ""} &bull;{" "}
                      {r.event_name.replace("Grand Prix", "GP")}
                    </option>
                  );
                })}
              </select>
            ) : (
              <div className="text-text-muted font-mono text-xs py-2 text-center tracking-widest uppercase">
                No rounds available
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleJump}
            disabled={!selectedRound}
            className="w-full bg-purple-500/15 border border-purple-500 text-purple-300 font-mono text-xs font-bold tracking-widest uppercase px-4 py-2.5 rounded-sm hover:bg-purple-500/25 transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <span>Go</span>
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <title>Go to race weekend</title>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
