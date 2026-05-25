"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { isValidHeadshotUrl } from "@/lib/api";
import { circuitHref, constructorHref, driverHref } from "@/lib/entityLinks";
import {
  getCircuitFlagEmoji,
  getDriverFlagEmoji,
  getTeamFlagEmoji,
} from "@/lib/flags";
import type { SessionResultsResponse } from "@/lib/types";
import LapTimeByLapGraph from "./LapTimeByLapGraph";
import { GridPattern, TrianglePattern } from "./Patterns";
import QualifyingSpreadChart from "./QualifyingSpreadChart";
import type { SessionSummary } from "./SessionSummaryCard";
import SessionSummaryCard from "./SessionSummaryCard";
import { TrackMapFull } from "./TrackMapDisplay";
import TyreStintChart from "./TyreStintChart";

interface SessionDetailProps {
  data: SessionResultsResponse | null;
  qualifyingData?: SessionResultsResponse | null;
  season: string;
  isSprint?: boolean;
  sessionType?: "race" | "qualifying" | "practice";
  onSessionTypeChange?: (mode: "race" | "qualifying") => void;
  onBack: () => void;
  hideHeader?: boolean;
  summary?: SessionSummary | null;
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

function dedupeCommaSeparated(...parts: (string | null | undefined)[]): string {
  const seen = new Set<string>();
  const cleaned: string[] = [];

  for (const part of parts) {
    if (!part) continue;

    for (const token of part.split(",")) {
      const value = token.trim();
      if (!value) continue;

      const key = value.toLowerCase();
      if (seen.has(key)) continue;

      seen.add(key);
      cleaned.push(value);
    }
  }

  return cleaned.join(", ");
}

export default function SessionDetail({
  data,
  qualifyingData,
  season,
  isSprint = false,
  sessionType = "race",
  onSessionTypeChange,
  onBack,
  hideHeader = false,
  summary,
}: SessionDetailProps) {
  const [expandedResults, setExpandedResults] = useState<boolean>(false);
  const isQualifying = sessionType === "qualifying";
  const isPractice = sessionType === "practice";

  if (!data) return null;

  const { session, results } = data;
  const circuitSummary = dedupeCommaSeparated(
    session.circuit.name,
    session.circuit.location,
  );
  const compactLocation = dedupeCommaSeparated(session.circuit.location);
  const sessionCircuitHref = circuitHref(session.circuit.id);

  return (
    <main className={hideHeader ? "" : "min-h-screen bg-bg-secondary"}>
      {/* ── Sticky Header ── */}
      {!hideHeader && (
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
      )}

      <div className="max-w-7xl mx-auto p-3 md:p-6">
        {/* ── Session Header Card ── */}
        <div className="mb-4 md:mb-6 bg-bg-tertiary border border-border-primary rounded-sm shadow-sm overflow-hidden flex flex-col md:flex-row">
          <div className="flex-1 p-4 md:p-6 relative">
            <GridPattern id="session-grid" />
            <div className="relative z-10">
              {/* Title row */}
              <div className="flex items-start gap-2 mb-2">
                {session.circuit.country && (
                  <span className="text-xl mt-0.5 shrink-0" aria-hidden="true">
                    {getCircuitFlagEmoji(session.circuit.country)}
                  </span>
                )}
                <h1 className="text-xl md:text-3xl font-bold text-text-primary leading-tight">
                  {session.event_name}
                </h1>
                {isSprint && (
                  <span className="mt-1 shrink-0 bg-red-500/20 border border-red-500 text-red-400 text-[10px] tracking-widest uppercase font-bold font-mono px-2 py-0.5 rounded-sm">
                    Sprint
                  </span>
                )}
              </div>
              {/* Action buttons row — separate from title so they don't wrap into it */}
              {(session.highlights_video_id || session.year >= 2018) && (
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  {session.highlights_video_id && (
                    <a
                      href={`https://www.youtube.com/watch?v=${session.highlights_video_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] tracking-widest uppercase font-bold font-mono text-red-400 hover:text-red-300 transition-colors duration-150 px-2 py-1 border border-red-500/30 rounded-sm hover:border-red-500/60"
                    >
                      <svg
                        className="w-3 h-3"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <title>YouTube</title>
                        <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.546 12 3.546 12 3.546s-7.505 0-9.377.504A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.504 9.376.504 9.376.504s7.505 0 9.377-.504a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                      </svg>
                      Highlights
                    </a>
                  )}
                  {session.year >= 2018 && (
                    <Link
                      href={`/replay?season=${session.year}&round=${session.round}`}
                      className="inline-flex items-center gap-1 text-[10px] tracking-widest uppercase font-bold font-mono text-purple-400 hover:text-purple-300 transition-colors duration-150 px-2 py-1 border border-purple-500/30 rounded-sm hover:border-purple-500/60"
                    >
                      <svg
                        className="w-3 h-3"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <title>Race Replay</title>
                        <path d="M8 5.14v14.72a1 1 0 0 0 1.5.86l11-7.36a1 1 0 0 0 0-1.72l-11-7.36A1 1 0 0 0 8 5.14z" />
                      </svg>
                      Race Replay
                    </Link>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-1">
                {sessionCircuitHref ? (
                  <Link
                    href={sessionCircuitHref}
                    className="inline-flex text-text-secondary font-medium transition-colors hover:text-purple-300"
                  >
                    {circuitSummary}
                  </Link>
                ) : (
                  <p className="text-text-secondary font-medium">
                    {circuitSummary}
                  </p>
                )}
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
          <TrackMapFull
            circuitId={session.circuit.id}
            circuitName={session.circuit.name}
            location={compactLocation}
            trackLengthKm={session.circuit.track_length_km}
          />
        </div>

        {/* ── Results Table ── */}
        <div className="bg-bg-tertiary border border-border-primary rounded-sm shadow-sm flex flex-col">
          {/* Header band with Pattern */}
          <div className="relative h-10 bg-bg-primary border-b border-border-primary px-4 flex items-center overflow-hidden">
            <TrianglePattern id="results-triangles" />
            <span className="relative z-10 text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono">
              {isPractice
                ? "Practice Classification"
                : isQualifying
                  ? "Qualifying Order"
                  : "Finishing Order"}
            </span>
          </div>

          <div
            className="overflow-x-auto overflow-y-auto"
            style={{
              maxHeight: expandedResults ? "1260px" : "345px",
              transition: "max-height 0.3s ease-in-out",
            }}
          >
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-border-primary bg-bg-tertiary">
                  <th className="px-4 py-3 text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono w-16 text-center">
                    POS
                  </th>
                  {!isQualifying && !isPractice && (
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
                  {isPractice ? (
                    <>
                      <th className="px-4 py-3 text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono text-right">
                        BEST LAP
                      </th>
                      <th className="px-4 py-3 text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono text-right">
                        GAP
                      </th>
                    </>
                  ) : isQualifying ? (
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
                    {!isQualifying && !isPractice && (
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
                            href={driverHref(result.driver) ?? "/drivers"}
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
                          <Link
                            href={
                              constructorHref(result.team.name) ??
                              "/constructors"
                            }
                            className="text-[10px] font-mono text-text-muted md:hidden hover:text-purple-300 transition-colors duration-150"
                          >
                            {result.team.name}
                          </Link>
                        </div>
                      </div>
                    </td>

                    {/* Constructor */}
                    <td className="px-4 py-3 hidden md:table-cell">
                      <Link
                        href={
                          constructorHref(result.team.name) ?? "/constructors"
                        }
                        className="text-xs font-medium hover:text-purple-300 transition-colors duration-150 flex items-center gap-2"
                        style={{
                          color: result.team.team_color
                            ? `#${result.team.team_color}`
                            : "inherit",
                        }}
                      >
                        {isValidHeadshotUrl(result.team.logo_url) && (
                          <div className="w-9 h-9 rounded-sm overflow-hidden border border-border-secondary bg-bg-secondary flex-shrink-0">
                            <Image
                              src={result.team.logo_url}
                              alt={result.team.name}
                              width={36}
                              height={36}
                              className="w-full h-full object-contain p-1"
                              unoptimized={result.team.logo_url.includes(
                                "wikimedia.org",
                              )}
                            />
                          </div>
                        )}
                        <span className="text-xs" aria-hidden="true">
                          {getTeamFlagEmoji(result.team.name)}
                        </span>
                        {result.team.name}
                      </Link>
                    </td>

                    {/* Mode Specific Columns */}
                    {isPractice ? (
                      <>
                        <td className="px-4 py-3 text-right font-mono text-xs text-text-primary font-bold">
                          {result.time_seconds
                            ? formatTime(result.time_seconds, false, true)
                            : "-"}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-text-muted">
                          {result.position === 1
                            ? "P1"
                            : result.time_seconds && results[0]?.time_seconds
                              ? `+${(result.time_seconds - results[0].time_seconds).toFixed(3)}`
                              : "-"}
                        </td>
                      </>
                    ) : isQualifying ? (
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
        <div className={`mt-4 flex justify-center ${summary ? "" : "mb-8"}`}>
          <button
            type="button"
            onClick={() => setExpandedResults(!expandedResults)}
            className="border border-border-secondary rounded-sm text-text-secondary hover:border-purple-500 hover:text-purple-300 font-mono text-xs uppercase tracking-widest px-6 py-2 transition-colors duration-150 flex items-center gap-2"
          >
            {expandedResults ? "COLLAPSE" : "FULL RESULTS"}
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

        {summary && (
          <div className="mt-4 mb-8">
            <SessionSummaryCard summary={summary} />
          </div>
        )}

        {/* ── Lap Time Graph (Race) or Gap Chart (Qualifying) ── */}
        {!isPractice && (
          <div className="bg-bg-tertiary border border-border-primary rounded-sm shadow-sm overflow-visible">
            <div className="relative h-10 bg-bg-primary border-b border-border-primary px-4 flex items-center overflow-hidden rounded-t-sm">
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
                <QualifyingSpreadChart results={results} />
              )}
            </div>
          </div>
        )}

        {/* ── Tyre Strategy (Race only) ── */}
        {!isQualifying && !isPractice && (
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
