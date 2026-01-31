"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  getCircuitFlagEmoji,
  getDriverFlagEmoji,
  getTeamFlagEmoji,
} from "@/lib/flags";
import LapTimeByLapGraph from "./LapTimeByLapGraph";

// Type definitions matching our API responses
type CircuitInfo = {
  id: number;
  name: string;
  location: string;
  country: string;
  track_length_km: number | null;
  track_map_url: string | null;
};

type DriverInfo = {
  driver_number: number | null;
  driver_code: string;
  full_name: string;
  country_code: string | null;
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
  data: SessionResultsResponse | null;
  qualifyingData?: SessionResultsResponse | null;
  season: string;
  isSprint?: boolean;
  sessionType?: "race" | "qualifying";
  onSessionTypeChange?: (mode: "race" | "qualifying") => void;
  onBack: () => void;
}

// Helper to format time in seconds to "MM:SS.mmm" or "+SS.mmm"
const formatTime = (
  seconds: number | null,
  isLeader: boolean,
  forceFullTime = false,
): string => {
  if (seconds === null) return "-";
  if (isLeader || forceFullTime) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toFixed(3).padStart(6, "0")}`;
  }
  return `+${seconds.toFixed(3)}`;
};

export default function SessionDetail({
  data,
  qualifyingData,
  season,
  isSprint = false,
  sessionType = "race",
  onSessionTypeChange,
  onBack,
}: SessionDetailProps) {
  const [expandedResults, setExpandedResults] = useState<boolean>(false);
  const isQualifying = sessionType === "qualifying";

  if (!data) return null;

  const { session, results } = data;

  return (
    <main className="min-h-screen bg-[#15151e] p-8">
      <div className="max-w-7xl mx-auto">
        {/* Top Header: Back Button and Toggle */}
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={onBack}
            className="text-[#a020f0] hover:text-[#c77dff] font-semibold transition-colors"
          >
            ← Back to {season} Results
          </button>

          {/* Race/Qualifying Toggle */}
          {onSessionTypeChange && qualifyingData && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider ml-1">
                Session Type
              </span>
              <div className="flex items-center gap-2 bg-[#1e1e28] rounded-lg p-1 border border-[#2a2a35]">
                <button
                  type="button"
                  onClick={() => onSessionTypeChange("race")}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    sessionType === "race"
                      ? "bg-purple-500 text-white"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  {isSprint ? "Sprint" : "Race"}
                </button>
                <button
                  type="button"
                  onClick={() => onSessionTypeChange("qualifying")}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    sessionType === "qualifying"
                      ? "bg-purple-500 text-white"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  Qualifying
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Session Header */}
        <div className="bg-[#1e1e28] border border-[#2a2a35] rounded-lg shadow-lg p-6 mb-6">

          <div className="flex items-start justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-white inline-flex items-center gap-2">
                  {session.circuit.country && (
                    <span className="text-2xl">
                      {getCircuitFlagEmoji(session.circuit.country)}
                    </span>
                  )}
                  {session.event_name.replace("Grand Prix", "GP")}
                  {isQualifying && " Qualifying"}
                </h1>
                {isSprint && (
                  <span className="bg-[#a020f0] text-white px-3 py-1 rounded-full text-sm font-semibold">
                    {isQualifying ? "SPRINT QUALIFYING" : "SPRINT RACE"}
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
              {session.circuit.track_length_km && (
                <p className="text-sm text-gray-400 mt-1">
                  Circuit Length: {session.circuit.track_length_km} km
                </p>
              )}
            </div>
            {session.circuit.track_map_url && (
              <div className="flex-shrink-0">
                <Image
                  src={session.circuit.track_map_url}
                  alt={`${session.circuit.name} track map`}
                  width={200}
                  height={200}
                  className="object-contain"
                />
              </div>
            )}
          </div>
        </div>

        {/* Results Table */}
        <div className="bg-[#1e1e28] border border-[#2a2a35] rounded-lg shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed">
                <colgroup><col style={{ width: "60px" }} />{!isQualifying && <col style={{ width: "60px" }} />}<col style={{ width: "280px" }} /><col style={{ width: "200px" }} />{isQualifying ? (<><col style={{ width: "100px" }} /><col style={{ width: "100px" }} /><col style={{ width: "100px" }} /><col style={{ width: "100px" }} /></>) : (<><col style={{ width: "140px" }} /><col style={{ width: "80px" }} /><col style={{ width: "120px" }} /></>)}</colgroup>
                <thead className="bg-[#252530] border-b-2 border-[#2a2a35]">
                  <tr>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Pos
                    </th>
                    {!isQualifying && (
                      <th
                        className="pl-1 pr-4 py-3"
                        aria-label="Position change"
                      />
                    )}
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Driver
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Constructor
                    </th>
                    {isQualifying ? (
                      <>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                          Q1
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                          Q2
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                          Q3
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                          Gap
                        </th>
                      </>
                    ) : (
                      <>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                          Time
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                          Points
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                          Status
                        </th>
                      </>
                    )}
                  </tr>
                </thead>
              </table>
            </div>
            <div
              className="overflow-y-auto overflow-x-auto"
              style={{
                maxHeight: expandedResults ? "760px" : "380px",
                minHeight: expandedResults ? "760px" : "380px",
              }}
            >
              <table className="w-full table-fixed">
                <colgroup><col style={{ width: "60px" }} />{!isQualifying && <col style={{ width: "60px" }} />}<col style={{ width: "280px" }} /><col style={{ width: "200px" }} />{isQualifying ? (<><col style={{ width: "100px" }} /><col style={{ width: "100px" }} /><col style={{ width: "100px" }} /><col style={{ width: "100px" }} /></>) : (<><col style={{ width: "140px" }} /><col style={{ width: "80px" }} /><col style={{ width: "120px" }} /></>)}</colgroup>
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

                    {/* Position Change (Race only) */}
                    {!isQualifying && (
                      <td className="pl-1 pr-4 py-4 text-center">
                        {result.position &&
                          result.grid_position &&
                          (() => {
                            const change =
                              result.grid_position - result.position;
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
                    )}

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
                          <Link
                            href={`/drivers/${result.driver.driver_code}`}
                            className="font-semibold text-white hover:text-[#e10600] transition-colors inline-flex items-center gap-1.5"
                          >
                            {result.driver.country_code && (
                              <span className="text-sm">
                                {getDriverFlagEmoji(result.driver.country_code)}
                              </span>
                            )}
                            {result.driver.full_name}
                          </Link>
                          <div className="text-sm text-gray-400">
                            {result.driver.driver_code}
                            {result.driver.driver_number &&
                              ` #${result.driver.driver_number}`}
                          </div>
                        </div>
                        {result.fastest_lap && (
                          <span
                            className="text-[#c77dff] font-semibold text-sm"
                            title="Fastest Lap"
                          >
                            ⚡
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Team */}
                    <td className="px-4 py-4">
                      <div className="font-semibold inline-flex items-center gap-1.5">
                        <Link
                          href={`/constructors/${result.team.name.replace(/ /g, "-")}`}
                          className="hover:text-[#e10600] transition-colors flex items-center gap-1.5"
                          style={{
                            color: result.team.team_color
                              ? `#${result.team.team_color}`
                              : "#fff",
                          }}
                        >
                          <span className="text-sm">
                            {getTeamFlagEmoji(result.team.name)}
                          </span>
                          {result.team.name}
                        </Link>
                      </div>
                    </td>

                    {/* Race columns */}
                    {!isQualifying && (
                      <>
                        {/* Time */}
                        <td className="px-4 py-4 text-right">
                          <div className="font-mono text-white">
                            {formatTime(
                              result.time_seconds,
                              result.position === 1,
                            )}
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
                      </>
                    )}

                    {/* Qualifying columns */}
                    {isQualifying && (
                      <>
                        {/* Q1 Time */}
                        <td className="px-4 py-4 text-right">
                          <div className="font-mono text-white text-sm">
                            {result.q1_time_seconds
                              ? formatTime(result.q1_time_seconds, false, true)
                              : "-"}
                          </div>
                        </td>

                        {/* Q2 Time */}
                        <td className="px-4 py-4 text-right">
                          <div className="font-mono text-white text-sm">
                            {result.q2_time_seconds
                              ? formatTime(result.q2_time_seconds, false, true)
                              : "-"}
                          </div>
                        </td>

                        {/* Q3 Time */}
                        <td className="px-4 py-4 text-right">
                          <div className="font-mono text-white text-sm font-bold">
                            {result.q3_time_seconds
                              ? formatTime(result.q3_time_seconds, false, true)
                              : "-"}
                          </div>
                        </td>

                        {/* Gap to Pole */}
                        <td className="px-4 py-4 text-right">
                          <div className="font-mono text-gray-400 text-sm">
                            {result.position === 1
                              ? "-"
                              : result.q3_time_seconds &&
                                  results[0].q3_time_seconds
                                ? `+${(result.q3_time_seconds - results[0].q3_time_seconds).toFixed(3)}`
                                : result.q2_time_seconds &&
                                    results[0].q2_time_seconds
                                  ? `+${(result.q2_time_seconds - results[0].q2_time_seconds).toFixed(3)}`
                                  : result.q1_time_seconds &&
                                      results[0].q1_time_seconds
                                    ? `+${(result.q1_time_seconds - results[0].q1_time_seconds).toFixed(3)}`
                                    : "-"}
                          </div>
                        </td>
                      </>
                    )}
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

        {/* Lap Time Graph (Race) or Gap Chart (Qualifying) */}
        {!isQualifying ? (
          <div className="mt-6">
            <LapTimeByLapGraph
              season={session.year}
              round={session.round}
              isSprint={isSprint}
            />
          </div>
        ) : (
          <div className="mt-6">
            <div className="bg-[#1e1e28] border border-[#2a2a35] rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-bold text-white mb-4">
                Gap to Pole Position
              </h3>
              <div className="space-y-2">
                {results.slice(0, 10).map((result) => {
                  const bestTime =
                    result.q3_time_seconds ||
                    result.q2_time_seconds ||
                    result.q1_time_seconds;
                  const poleTime =
                    results[0].q3_time_seconds ||
                    results[0].q2_time_seconds ||
                    results[0].q1_time_seconds;
                  const gap = bestTime && poleTime ? bestTime - poleTime : 0;
                  const maxGap = Math.max(
                    ...results.slice(0, 10).map((r) => {
                      const rBest =
                        r.q3_time_seconds ||
                        r.q2_time_seconds ||
                        r.q1_time_seconds;
                      return rBest && poleTime ? rBest - poleTime : 0;
                    }),
                  );
                  const widthPercent = maxGap > 0 ? (gap / maxGap) * 100 : 0;

                  return (
                    <div
                      key={result.driver.driver_code}
                      className="flex items-center gap-3"
                    >
                      <div className="w-8 text-right text-gray-400 text-sm font-bold">
                        {result.position}
                      </div>
                      <div className="w-24 text-right text-white text-sm truncate">
                        {result.driver.driver_code}
                      </div>
                      <div className="flex-1">
                        <div
                          className="h-8 rounded transition-all flex items-center justify-end pr-2"
                          style={{
                            width: `${widthPercent}%`,
                            minWidth: gap === 0 ? "0%" : "10%",
                            backgroundColor: result.team.team_color
                              ? `#${result.team.team_color}`
                              : "#a020f0",
                          }}
                        >
                          {gap > 0 && (
                            <span className="text-white text-xs font-mono">
                              +{gap.toFixed(3)}s
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
