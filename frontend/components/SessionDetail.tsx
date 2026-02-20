"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { isValidHeadshotUrl } from "@/lib/api";
import {
  getCircuitFlagEmoji,
  getDriverFlagEmoji,
  getTeamFlagEmoji,
} from "@/lib/flags";
import type { DriverInfo, TeamInfo } from "@/lib/types";
import LapTimeByLapGraph from "./LapTimeByLapGraph";
import { ConcentricPattern, GridPattern, TrianglePattern } from "./Patterns";
import TyreStintChart from "./TyreStintChart";

type CircuitInfo = {
  id: number;
  name: string;
  location: string;
  country: string;
  track_length_km: number | null;
  track_map_url: string | null;
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
    <main className="min-h-screen bg-bg-secondary">
      {/* ── Sticky Header ── */}
      <div className="sticky top-0 z-40 bg-bg-secondary border-b border-border-primary h-16 flex items-center px-6">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onBack}
              className="bg-bg-primary border border-border-primary text-text-primary font-mono text-xs font-bold px-4 py-2 rounded-sm hover:border-purple-500 hover:text-purple-300 transition-colors duration-150 cursor-pointer flex items-center gap-2"
            >
              <span>←</span>
              <span className="hidden sm:inline">BACK TO {season}</span>
            </button>
            <div className="flex flex-col">
              <span className="text-text-primary font-mono text-sm font-bold leading-none">
                ROUND {String(session.round).padStart(2, "0")}
              </span>
              <span className="text-text-muted text-[10px] tracking-widest uppercase font-bold hidden sm:inline">
                {session.event_name.replace("Grand Prix", "GP")}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Session Type Toggle */}
            {onSessionTypeChange && qualifyingData && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onSessionTypeChange("race")}
                  className={`px-4 py-1.5 rounded-sm text-xs font-bold font-mono uppercase tracking-widest transition-colors duration-150 ${
                    sessionType === "race"
                      ? "bg-purple-500/20 border border-purple-500 text-purple-300"
                      : "border border-transparent text-text-muted hover:text-text-secondary"
                  }`}
                >
                  {isSprint ? "Sprint" : "Race"}
                </button>
                <button
                  type="button"
                  onClick={() => onSessionTypeChange("qualifying")}
                  className={`px-4 py-1.5 rounded-sm text-xs font-bold font-mono uppercase tracking-widest transition-colors duration-150 ${
                    sessionType === "qualifying"
                      ? "bg-purple-500/20 border border-purple-500 text-purple-300"
                      : "border border-transparent text-text-muted hover:text-text-secondary"
                  }`}
                >
                  Qualifying
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {/* ── Session Header Card ── */}
        <div className="mb-6 bg-bg-tertiary border border-border-primary rounded-sm shadow-sm overflow-hidden flex flex-col md:flex-row">
          <div className="flex-1 p-6 relative">
            <GridPattern id="session-grid" />
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl md:text-3xl font-bold text-text-primary inline-flex items-center gap-2">
                  {session.circuit.country && (
                    <span className="text-2xl" aria-hidden="true">
                      {getCircuitFlagEmoji(session.circuit.country)}
                    </span>
                  )}
                  {session.event_name}
                </h1>
                {isSprint && (
                  <span className="bg-red-500/20 border border-red-500 text-red-400 text-[10px] tracking-widest uppercase font-bold font-mono px-3 py-1 rounded-sm">
                    Sprint
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <p className="text-text-secondary font-medium">
                  {session.circuit.name}, {session.circuit.location}
                </p>
                <p className="text-xs text-text-muted font-mono uppercase tracking-widest">
                  {new Date(session.date).toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
                {session.circuit.track_length_km && (
                  <p className="text-xs text-text-muted font-mono uppercase tracking-widest mt-1">
                    Circuit Length: {session.circuit.track_length_km.toFixed(3)}{" "}
                    km
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Track Map Side */}
          <div className="w-full md:w-64 bg-bg-primary border-t md:border-t-0 md:border-l border-border-primary relative flex items-center justify-center p-4 overflow-hidden min-h-[160px]">
            <ConcentricPattern id="session-track-pattern" />
            {session.circuit.id && (
              <Image
                src={`/track-maps/${session.circuit.id}.png`}
                alt={`${session.circuit.name} track map`}
                width={200}
                height={120}
                className="object-contain relative z-10 opacity-80 mix-blend-lighten"
              />
            )}
          </div>
        </div>

        {/* ── Results Table ── */}
        <div className="bg-bg-tertiary border border-border-primary rounded-sm shadow-sm flex flex-col">
          {/* Header band with Pattern */}
          <div className="relative h-10 bg-bg-primary border-b border-border-primary px-4 flex items-center overflow-hidden">
            <TrianglePattern id="results-triangles" />
            <span className="relative z-10 text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono">
              {isQualifying
                ? "Classification - Qualifying"
                : "Classification - Race"}
            </span>
          </div>

          <div
            className="overflow-x-auto overflow-y-auto"
            style={{
              maxHeight: expandedResults ? "1260px" : "660px",
              transition: "max-height 0.3s ease-in-out",
            }}
          >
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-border-primary bg-bg-tertiary">
                  <th className="px-4 py-3 text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono w-16 text-center">
                    POS
                  </th>
                  {!isQualifying && (
                    <th className="px-2 py-3 text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono w-12 text-center hidden sm:table-cell">
                      +/-
                    </th>
                  )}
                  <th className="px-4 py-3 text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono">
                    DRIVER
                  </th>
                  <th className="px-4 py-3 text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono hidden md:table-cell">
                    CONSTRUCTOR
                  </th>
                  {isQualifying ? (
                    <>
                      <th className="px-4 py-3 text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono text-right">
                        Q1
                      </th>
                      <th className="px-4 py-3 text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono text-right">
                        Q2
                      </th>
                      <th className="px-4 py-3 text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono text-right">
                        Q3
                      </th>
                      <th className="px-4 py-3 text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono text-right">
                        GAP
                      </th>
                    </>
                  ) : (
                    <>
                      <th className="px-4 py-3 text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono text-right">
                        TIME/STATUS
                      </th>
                      <th className="px-4 py-3 text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono text-center">
                        PTS
                      </th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {results.map((result, idx) => (
                  <tr
                    key={`${result.driver.driver_code}-${idx}`}
                    className="border-b border-border-primary last:border-0 hover:bg-bg-primary/30 transition-colors duration-150"
                  >
                    {/* Position */}
                    <td className="px-4 py-3 w-16 text-center">
                      <span className="text-lg font-bold text-text-muted font-mono">
                        {result.position || "NC"}
                      </span>
                    </td>

                    {/* Position Change */}
                    {!isQualifying && (
                      <td className="px-2 py-3 w-12 text-center hidden sm:table-cell">
                        {(() => {
                          if (
                            result.grid_position == null ||
                            result.position == null
                          )
                            return (
                              <span className="text-text-muted font-mono text-xs">
                                -
                              </span>
                            );
                          const diff = result.grid_position - result.position;
                          if (diff > 0)
                            return (
                              <span className="text-green-400 font-mono text-xs font-bold">
                                +{diff}
                              </span>
                            );
                          if (diff < 0)
                            return (
                              <span className="text-red-400 font-mono text-xs font-bold">
                                {diff}
                              </span>
                            );
                          return (
                            <span className="text-blue-400 font-mono text-xs font-bold">
                              -
                            </span>
                          );
                        })()}
                      </td>
                    )}

                    {/* Driver */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {isValidHeadshotUrl(result.headshot_url) && (
                          <Image
                            src={result.headshot_url || ""}
                            alt={result.driver.full_name}
                            width={36}
                            height={36}
                            className="rounded-sm object-cover border border-border-secondary hidden sm:block"
                          />
                        )}
                        <div className="flex flex-col">
                          <Link
                            href={`/drivers/${result.driver.driver_code}`}
                            className="font-semibold text-text-primary text-sm hover:text-purple-300 transition-colors duration-150 flex items-center gap-1.5"
                          >
                            {result.driver.country_code && (
                              <span className="text-xs" aria-hidden="true">
                                {getDriverFlagEmoji(result.driver.country_code)}
                              </span>
                            )}
                            {result.driver.full_name}
                            {result.fastest_lap && (
                              <span
                                className="text-purple-300 text-[10px]"
                                title="Fastest Lap"
                              >
                                ⚡
                              </span>
                            )}
                          </Link>
                          <span className="text-[10px] font-mono text-text-muted md:hidden">
                            {result.team.name}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Constructor */}
                    <td className="px-4 py-3 hidden md:table-cell">
                      <Link
                        href={`/constructors/${result.team.name.replace(/ /g, "-")}`}
                        className="text-xs font-medium hover:text-purple-300 transition-colors duration-150 flex items-center gap-1.5"
                        style={{
                          color: result.team.team_color
                            ? `#${result.team.team_color}`
                            : "inherit",
                        }}
                      >
                        <span className="text-xs" aria-hidden="true">
                          {getTeamFlagEmoji(result.team.name)}
                        </span>
                        {result.team.name}
                      </Link>
                    </td>

                    {/* Mode Specific Columns */}
                    {isQualifying ? (
                      <>
                        <td className="px-4 py-3 text-right font-mono text-xs text-text-secondary">
                          {result.q1_time_seconds
                            ? formatTime(result.q1_time_seconds, false, true)
                            : "-"}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-text-secondary">
                          {result.q2_time_seconds
                            ? formatTime(result.q2_time_seconds, false, true)
                            : "-"}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-text-primary font-bold">
                          {result.q3_time_seconds
                            ? formatTime(result.q3_time_seconds, false, true)
                            : "-"}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-text-muted">
                          {result.position === 1
                            ? "POLE"
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
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 text-right font-mono text-xs text-text-primary">
                          {result.status === "Finished" ||
                          result.status === "Lapped"
                            ? formatTime(
                                result.time_seconds,
                                result.position === 1,
                              )
                            : result.status}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-sm font-bold text-text-primary font-mono">
                            {result.points || 0}
                          </span>
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
        <div className="mt-4 mb-8 flex justify-center">
          <button
            type="button"
            onClick={() => setExpandedResults(!expandedResults)}
            className="border border-border-secondary rounded-sm text-text-secondary hover:border-purple-500 hover:text-purple-300 font-mono text-xs uppercase tracking-widest px-6 py-2 transition-colors duration-150 flex items-center gap-2"
          >
            {expandedResults ? "COLLAPSE" : "EXPAND FULL CLASSIFICATION"}
            <svg
              className={`w-3 h-3 transition-transform duration-300 ${expandedResults ? "rotate-180" : ""}`}
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

        {/* ── Lap Time Graph (Race) or Gap Chart (Qualifying) ── */}
        <div className="bg-bg-tertiary border border-border-primary rounded-sm shadow-sm overflow-hidden">
          <div className="relative h-10 bg-bg-primary border-b border-border-primary px-4 flex items-center overflow-hidden">
            <TrianglePattern id="analysis-triangles" />
            <span className="relative z-10 text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono">
              {isQualifying ? "Qualifying Analysis" : "Race Performance"}
            </span>
          </div>

          <div className="p-6">
            {!isQualifying ? (
              <LapTimeByLapGraph
                season={session.year}
                round={session.round}
                isSprint={isSprint}
              />
            ) : (
              <div>
                <h3 className="text-sm font-bold text-text-primary mb-4 uppercase tracking-wider font-mono">
                  Gap to Pole Position (Top 10)
                </h3>
                <div className="space-y-3">
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
                        <div className="w-8 text-right text-text-muted text-xs font-bold font-mono">
                          {result.position}
                        </div>
                        <div className="w-16 text-right text-text-primary text-xs font-bold font-mono">
                          {result.driver.driver_code}
                        </div>
                        <div className="flex-1 bg-bg-primary/30 h-6 rounded-sm overflow-hidden border border-border-primary/50">
                          <div
                            className="h-full transition-all duration-500 flex items-center justify-end pr-2"
                            style={{
                              width: `${Math.max(widthPercent, 1)}%`,
                              backgroundColor: result.team.team_color
                                ? `#${result.team.team_color}33`
                                : "#a020f033",
                              borderRight: `2px solid ${result.team.team_color ? `#${result.team.team_color}` : "#a020f0"}`,
                            }}
                          >
                            {gap > 0 && (
                              <span className="text-text-primary text-[10px] font-mono font-bold">
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
            )}
          </div>
        </div>

        {/* ── Tyre Strategy (Race only) ── */}
        {!isQualifying && (
          <div className="mt-6 bg-bg-tertiary border border-border-primary rounded-sm shadow-sm overflow-hidden">
            <div className="relative h-10 bg-bg-primary border-b border-border-primary px-4 flex items-center overflow-hidden">
              <TrianglePattern id="tyre-triangles" />
              <span className="relative z-10 text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono">
                Tyre Strategy
              </span>
            </div>

            <div className="p-6">
              <TyreStintChart
                season={session.year}
                round={session.round}
                isSprint={isSprint}
              />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
