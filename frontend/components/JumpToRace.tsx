"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type RoundOption = {
  round: number;
  event_name: string;
  session_type: string;
};

type JumpToRaceProps = {
  currentSeason: string;
  availableSeasons: number[];
};

export default function JumpToRace({
  currentSeason,
  availableSeasons,
}: JumpToRaceProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState<string>(currentSeason);
  const [selectedRound, setSelectedRound] = useState<string>("");
  const [sessionType, setSessionType] = useState<"race" | "qualifying">("race");
  const [rounds, setRounds] = useState<RoundOption[]>([]);
  const [loadingRounds, setLoadingRounds] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  // ... (handleClickOutside remains same)

  // Fetch rounds when season or sessionType changes
  useEffect(() => {
    if (!selectedSeason || !isOpen) return;

    const fetchRounds = async () => {
      setLoadingRounds(true);
      try {
        const apiUrl =
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const apiKey = process.env.NEXT_PUBLIC_API_KEY || "";

        const endpoint = sessionType === "qualifying" 
          ? `${apiUrl}/api/results/${selectedSeason}/qualifying`
          : `${apiUrl}/api/results/${selectedSeason}`;

        const response = await fetch(endpoint, {
            headers: { "X-API-Key": apiKey },
            cache: "no-store",
          },
        );

        if (response.ok) {
          const data = await response.json();
          const roundsData: RoundOption[] = data.rounds.map(
            (r: {
              round: number;
              event_name: string;
              session_type: string;
            }) => ({
              round: r.round,
              event_name: r.event_name,
              session_type: r.session_type,
            }),
          );
          setRounds(roundsData);
        }
      } catch (error) {
        console.error("Failed to fetch rounds:", error);
        setRounds([]);
      } finally {
        setLoadingRounds(false);
      }
    };

    fetchRounds();
  }, [selectedSeason, isOpen, sessionType]);

  // Reset round when season or sessionType changes
  useEffect(() => {
    setSelectedRound("");
  }, [selectedSeason, sessionType]);

  const handleJump = () => {
    if (!selectedSeason || !selectedRound) return;

    const round = rounds.find((r) => {
      const key = `${r.round}-${r.session_type}`;
      return key === selectedRound;
    });

    if (!round) return;

    const modeParam = sessionType === "qualifying" ? "?mode=qualifying" : "";
    
    // Navigate to the appropriate route
    if (round.session_type === "sprint_race" || round.session_type === "sprint_qualifying") {
      router.push(`/results/${selectedSeason}/${round.round}/sprint${modeParam}`);
    } else {
      router.push(`/results/${selectedSeason}/${round.round}${modeParam}`);
    }

    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="px-4 py-2 bg-[#1e1e28] border border-[#2a2a35] rounded-lg text-white text-sm font-semibold hover:border-[#a020f0] transition-all flex items-center gap-2"
      >
        <span>Jump to</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
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
        <div className="absolute right-0 mt-2 w-80 bg-[#1e1e28] border border-[#2a2a35] rounded-lg shadow-xl z-50 p-4">
          <div className="mb-4">
            <label htmlFor="jump-season" className="block text-xs font-semibold text-gray-400 mb-2">
              Season
            </label>
            <select
              id="jump-season"
              value={selectedSeason}
              onChange={(e) => setSelectedSeason(e.target.value)}
              className="w-full px-3 py-2 bg-[#15151e] border border-[#2a2a35] rounded-lg text-white text-sm focus:outline-none focus:border-[#a020f0] transition-all"
            >
              {availableSeasons.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-400 mb-2">
              Session Type
            </label>
            <div className="flex items-center gap-2 bg-[#15151e] rounded-lg p-1 border border-[#2a2a35]">
              <button
                type="button"
                onClick={() => setSessionType("race")}
                className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  sessionType === "race"
                    ? "bg-purple-500 text-white shadow-md"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Race
              </button>
              <button
                type="button"
                onClick={() => setSessionType("qualifying")}
                className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  sessionType === "qualifying"
                    ? "bg-purple-500 text-white shadow-md"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Qualifying
              </button>
            </div>
          </div>

          <div className="mb-4">
            <label htmlFor="jump-round" className="block text-xs font-semibold text-gray-400 mb-2">
              Round
            </label>
            {loadingRounds ? (
              <div className="flex items-center justify-center py-8 text-gray-400 text-sm italic">
                Loading rounds...
              </div>
            ) : rounds.length > 0 ? (
              <select
                id="jump-round"
                value={selectedRound}
                onChange={(e) => setSelectedRound(e.target.value)}
                className="w-full px-3 py-2 bg-[#15151e] border border-[#2a2a35] rounded-lg text-white text-sm focus:outline-none focus:border-[#a020f0] transition-all max-h-64 overflow-y-auto"
              >
                <option value="">Select a round...</option>
                {rounds.map((round) => {
                  const key = `${round.round}-${round.session_type}`;
                  const isSprintRace = round.session_type === "sprint_race";
                  const isSprintQuali = round.session_type === "sprint_qualifying";
                  const isRegularQuali = round.session_type === "qualifying";
                  
                  return (
                    <option key={key} value={key}>
                      Round {round.round}
                      {isSprintRace ? " - Sprint" : ""}
                      {isSprintQuali ? " - Sprint Quali" : ""}
                      {isRegularQuali ? " - Quali" : ""} • {round.event_name.replace("Grand Prix", "GP")}
                    </option>
                  );
                })}
              </select>
            ) : (
              <div className="text-gray-500 text-sm py-2 italic text-center">
                No rounds available
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleJump}
            disabled={!selectedRound}
            className="w-full px-4 py-2 bg-[#a020f0] text-white font-semibold rounded-lg hover:bg-[#8c1acc] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <span>Jump to {sessionType === "race" ? "Race" : "Quali"}</span>
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <title>Jump to session</title>
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
