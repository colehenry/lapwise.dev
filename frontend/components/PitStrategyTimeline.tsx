"use client";

import { useEffect, useMemo, useState } from "react";
import { apiHeaders, apiUrl } from "@/lib/api";

// Types (shared with LapTimeByLapGraph)
type LapData = {
  lap_number: number;
  lap_time_seconds: number | null;
  compound: string | null;
  tyre_life: number | null;
  stint: number | null;
  pit_duration_seconds: number | null;
  position: number | null;
};

type DriverLapTimes = {
  driver_code: string;
  full_name: string;
  team_color: string | null;
  final_position: number | null;
  laps: LapData[];
};

type LapTimesResponse = {
  year: number;
  round: number;
  event_name: string;
  total_laps: number | null;
  drivers: DriverLapTimes[];
};

interface PitStrategyTimelineProps {
  season: number;
  round: number;
  isSprint?: boolean;
}

// Tyre compound colors
const COMPOUND_COLORS: Record<string, string> = {
  SOFT: "#ef4444",
  MEDIUM: "#eab308",
  HARD: "#e5e7eb",
  INTERMEDIATE: "#22c55e",
  WET: "#3b82f6",
};

const COMPOUND_SHORT: Record<string, string> = {
  SOFT: "S",
  MEDIUM: "M",
  HARD: "H",
  INTERMEDIATE: "I",
  WET: "W",
};

type StintInfo = {
  stintNumber: number;
  startLap: number;
  endLap: number;
  compound: string;
  pitDuration: number | null; // pit stop at end of stint
};

function extractStints(laps: LapData[]): StintInfo[] {
  if (laps.length === 0) return [];

  const sorted = [...laps].sort((a, b) => a.lap_number - b.lap_number);
  const stints: StintInfo[] = [];
  let currentStint: StintInfo | null = null;

  for (const lap of sorted) {
    const stintNum = lap.stint ?? 1;
    const compound = lap.compound ?? "UNKNOWN";

    if (!currentStint || currentStint.stintNumber !== stintNum) {
      // Close previous stint
      if (currentStint) {
        stints.push(currentStint);
      }
      currentStint = {
        stintNumber: stintNum,
        startLap: lap.lap_number,
        endLap: lap.lap_number,
        compound,
        pitDuration: null,
      };
    } else {
      currentStint.endLap = lap.lap_number;
    }

    // Check for pit stop on this lap
    if (lap.pit_duration_seconds != null && lap.pit_duration_seconds > 0) {
      if (currentStint) {
        currentStint.pitDuration = lap.pit_duration_seconds;
      }
    }
  }

  if (currentStint) stints.push(currentStint);

  return stints;
}

export default function PitStrategyTimeline({
  season,
  round,
  isSprint = false,
}: PitStrategyTimelineProps) {
  const [data, setData] = useState<LapTimesResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (season < 2018) {
      setLoading(false);
      setData(null);
      return;
    }

    (async () => {
      try {
        setLoading(true);
        const endpoint = isSprint
          ? `/api/results/${season}/${round}/sprint/lap-times`
          : `/api/results/${season}/${round}/lap-times`;
        const response = await fetch(apiUrl(endpoint), {
          cache: "no-store",
          headers: apiHeaders(),
        });

        if (!response.ok) {
          setData(null);
          return;
        }

        setData(await response.json());
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [season, round, isSprint]);

  const totalLaps = useMemo(() => {
    if (!data) return 0;
    return (
      data.total_laps ?? Math.max(...data.drivers.map((d) => d.laps.length), 0)
    );
  }, [data]);

  // Sort drivers by finishing position
  const sortedDrivers = useMemo(() => {
    if (!data) return [];
    return [...data.drivers].sort(
      (a, b) => (a.final_position || 999) - (b.final_position || 999),
    );
  }, [data]);

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-6 bg-bg-elevated rounded w-48 animate-pulse" />
        {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
          <div
            key={`skel-row-${n}`}
            className="h-6 bg-bg-elevated rounded animate-pulse"
            style={{ animationDelay: `${n * 50}ms` }}
          />
        ))}
      </div>
    );
  }

  if (!data || sortedDrivers.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-text-muted text-sm">
          {season < 2018
            ? "Pit strategy data is only available from 2018 onwards."
            : "No pit strategy data available for this session."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-text-secondary font-mono">
        {data.event_name.replace("Grand Prix", "GP")} - Pit Strategy
      </h3>

      {/* Lap number axis */}
      <div className="flex items-center gap-0">
        <div className="w-16 shrink-0" />
        <div className="flex-1 relative h-5">
          {totalLaps > 0 &&
            Array.from({ length: Math.ceil(totalLaps / 10) + 1 }).map(
              (_, i) => {
                const lapNum = i * 10 || 1;
                if (lapNum > totalLaps) return null;
                const pct = ((lapNum - 1) / (totalLaps - 1)) * 100;
                return (
                  <span
                    key={lapNum}
                    className="absolute text-[10px] font-mono text-text-muted"
                    style={{
                      left: `${pct}%`,
                      transform: "translateX(-50%)",
                    }}
                  >
                    {lapNum}
                  </span>
                );
              },
            )}
        </div>
      </div>

      {/* Driver rows */}
      <div className="space-y-1">
        {sortedDrivers.map((driver) => {
          const stints = extractStints(driver.laps);

          return (
            <div key={driver.driver_code} className="flex items-center gap-0">
              {/* Driver label */}
              <div className="w-16 shrink-0 flex items-center gap-1.5">
                <span className="text-[10px] font-mono text-text-muted w-4 text-right">
                  {driver.final_position ?? "-"}
                </span>
                <span
                  className="text-xs font-mono font-bold truncate"
                  style={{
                    color: driver.team_color ? `#${driver.team_color}` : "#999",
                  }}
                >
                  {driver.driver_code}
                </span>
              </div>

              {/* Timeline bar */}
              <div className="flex-1 relative h-6 bg-bg-tertiary/50 rounded-sm overflow-hidden">
                {stints.map((stint) => {
                  const startPct =
                    ((stint.startLap - 1) / Math.max(totalLaps - 1, 1)) * 100;
                  const endPct = (stint.endLap / Math.max(totalLaps, 1)) * 100;
                  const widthPct = endPct - startPct;
                  const color = COMPOUND_COLORS[stint.compound] || "#666";
                  const label = COMPOUND_SHORT[stint.compound] || "?";

                  return (
                    <div key={`stint-${stint.stintNumber}`}>
                      {/* Stint bar */}
                      <div
                        className="absolute top-0 h-full flex items-center justify-center transition-opacity hover:opacity-90"
                        style={{
                          left: `${startPct}%`,
                          width: `${widthPct}%`,
                          backgroundColor: color,
                          opacity: 0.7,
                          borderRight:
                            stint.pitDuration != null
                              ? "2px solid #f97316"
                              : "1px solid rgba(0,0,0,0.3)",
                        }}
                        title={`${stint.compound} | Laps ${stint.startLap}-${stint.endLap}${stint.pitDuration != null ? ` | Pit: ${stint.pitDuration.toFixed(1)}s` : ""}`}
                      >
                        {widthPct > 4 && (
                          <span
                            className="text-[10px] font-mono font-bold"
                            style={{
                              color:
                                stint.compound === "HARD" ? "#333" : "#fff",
                            }}
                          >
                            {label}
                          </span>
                        )}
                      </div>

                      {/* Pit stop marker */}
                      {stint.pitDuration != null && (
                        <div
                          className="absolute top-0 h-full flex items-center z-10"
                          style={{
                            left: `${endPct}%`,
                            transform: "translateX(-1px)",
                          }}
                          title={`Pit: ${stint.pitDuration.toFixed(1)}s`}
                        >
                          <div className="w-0.5 h-full bg-orange-500" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 pt-1">
        {Object.entries(COMPOUND_COLORS).map(([compound, color]) => (
          <div key={compound} className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: color, opacity: 0.7 }}
            />
            <span className="text-[10px] font-mono text-text-muted uppercase">
              {compound}
            </span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="w-0.5 h-3 bg-orange-500" />
          <span className="text-[10px] font-mono text-text-muted">
            PIT STOP
          </span>
        </div>
      </div>
    </div>
  );
}
