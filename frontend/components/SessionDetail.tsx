"use client";

import Image from "next/image";
import { useState } from "react";
import LapTimeByLapGraph from "./LapTimeByLapGraph";

// Type definitions matching our API responses
type CircuitInfo = {
  name: string;
  location: string;
  country: string;
  track_length_km: number | null;
};

type DriverInfo = {
  driver_number: number | null;
  driver_code: string;
  full_name: string;
};

type TeamInfo = {
  name: string;
  team_color: string | null;
};

type SessionResultDetail = {
  position: number | null;
  status: string;
  headshot_url: string | null;
  driver: DriverInfo;
  team: TeamInfo;
  grid_position: number | null;
  points: number | null;
  laps_completed: number | null;
  time_seconds: number | null;
  fastest_lap: boolean;
  q1_time_seconds: number | null;
  q2_time_seconds: number | null;
  q3_time_seconds: number | null;
};

type SessionInfo = {
  id: number;
  year: number;
  round: number;
  session_type: string;
  event_name: string;
  date: string;
  circuit: CircuitInfo;
};

type SessionResultsResponse = {
  session: SessionInfo;
  results: SessionResultDetail[];
};

interface SessionDetailProps {
  data: SessionResultsResponse;
  season: string;
  isSprint?: boolean;
  onBack: () => void;
}

// Helper to format time in seconds to "MM:SS.mmm" or "+SS.mmm"
const formatTime = (seconds: number | null, isLeader: boolean): string => {
  if (seconds === null) return "-";
  if (isLeader) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toFixed(3).padStart(6, "0")}`;
  }
  return `+${seconds.toFixed(3)}`;
};

export default function SessionDetail({
  data,
  season,
  isSprint = false,
  onBack,
}: SessionDetailProps) {
  const { session, results } = data;
  const [expandedResults, setExpandedResults] = useState<boolean>(false);

  return (
    <main className="min-h-screen bg-[#15151e] p-8">
      <div className="max-w-7xl mx-auto">
        {/* Back Button */}
        <button
          type="button"
          onClick={onBack}
          className="mb-4 text-[#a020f0] hover:text-[#c77dff] font-semibold transition-colors"
        >
          ← Back to {season} Results
        </button>

        {/* Session Header */}
        <div className="bg-[#1e1e28] border border-[#2a2a35] rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-white">
                  {session.event_name}
                </h1>
                {isSprint && (
                  <span className="bg-[#a020f0] text-white px-3 py-1 rounded-full text-sm font-semibold">
                    SPRINT RACE
                  </span>
                )}
              </div>
              <p className="text-lg text-gray-300">
                Round {session.round} • {session.circuit.name},{" "}
                {session.circuit.location}
              </p>
              <p className="text-sm text-gray-400">
                {new Date(session.date).toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>
            <div className="text-right">
              {session.circuit.track_length_km && (
                <div className="text-sm text-gray-400">
                  {session.circuit.track_length_km} km
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Results Table */}
        <div className="bg-[#1e1e28] border border-[#2a2a35] rounded-lg shadow-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-[#252530] border-b-2 border-[#2a2a35]">
              <tr>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Pos
                </th>
                <th className="pl-1 pr-4 py-3"></th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Driver
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Team
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Time
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Points
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
          </table>
          <div
            className="overflow-y-auto"
            style={{
              maxHeight: expandedResults ? '760px' : '380px',
              minHeight: expandedResults ? '760px' : '380px'
            }}
          >
            <table className="w-full">
              <tbody className="divide-y divide-[#2a2a35]">
                {results.map((result) => (
                  <tr
                    key={`${result.driver.driver_code}-${result.position}`}
                    className="hover:bg-[#252530] transition-colors"
                  >
                    {/* Position */}
                    <td className="px-4 py-4 text-center">
                      <div className="text-lg font-bold text-white">
                        {result.position || "-"}
                      </div>
                    </td>

                    {/* Position Change */}
                    <td className="pl-1 pr-4 py-4">
                      {result.position &&
                        result.grid_position &&
                        (() => {
                          const change = result.grid_position - result.position;
                          if (change === 0) {
                            return (
                              <span className="text-base font-bold text-blue-500">
                                -
                              </span>
                            );
                          }
                          return (
                            <span
                              className={`text-base font-bold ${
                                change > 0 ? "text-green-500" : "text-red-500"
                              }`}
                            >
                              {change > 0 ? `+${change}` : change}
                            </span>
                          );
                        })()}
                    </td>

                    {/* Driver */}
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        {result.headshot_url &&
                          result.headshot_url !== "None" && (
                            <Image
                              src={result.headshot_url}
                              alt={result.driver.full_name}
                              width={40}
                              height={40}
                              className="rounded-full object-cover border border-gray-700"
                            />
                          )}
                        <div>
                          <div className="font-semibold text-white">
                            {result.driver.full_name}
                          </div>
                          <div className="text-sm text-gray-400">
                            {result.driver.driver_code}
                            {result.driver.driver_number &&
                              ` #${result.driver.driver_number}`}
                          </div>
                        </div>
                        {result.fastest_lap && (
                          <span className="text-[#c77dff] font-semibold text-sm">
                            ⚡
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Team */}
                    <td className="px-4 py-4">
                      <div
                        className="font-semibold"
                        style={{
                          color: result.team.team_color
                            ? `#${result.team.team_color}`
                            : "#fff",
                        }}
                      >
                        {result.team.name}
                      </div>
                    </td>

                    {/* Time */}
                    <td className="px-4 py-4 text-right">
                      <div className="font-mono text-white">
                        {formatTime(result.time_seconds, result.position === 1)}
                      </div>
                    </td>

                    {/* Points */}
                    <td className="px-4 py-4 text-center">
                      <div className="font-bold text-white">
                        {result.points || "-"}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-4 text-center">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          result.status === "Finished"
                            ? "bg-green-900/50 text-green-300"
                            : result.status === "Lapped"
                              ? "bg-blue-900/50 text-blue-300"
                              : "bg-red-900/50 text-red-300"
                        }`}
                      >
                        {result.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Expand/Collapse Button */}
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => setExpandedResults(!expandedResults)}
            className="w-48 px-4 py-2 bg-[#1e1e28] border-2 border-[#2a2a35] rounded-lg text-white text-sm font-semibold hover:border-[#a020f0] transition-all flex items-center justify-center gap-2"
          >
            {expandedResults ? (
              <>
                <span>Collapse</span>
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <title>Collapse icon</title>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 15l7-7 7 7"
                  />
                </svg>
              </>
            ) : (
              <>
                <span>Expand</span>
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <title>Expand icon</title>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </>
            )}
          </button>
        </div>

        {/* Lap Time Graph */}
        <div className="mt-6">
          <LapTimeByLapGraph season={session.year} round={session.round} />
        </div>
      </div>
    </main>
  );
}
