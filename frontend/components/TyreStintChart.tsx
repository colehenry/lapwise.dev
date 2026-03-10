"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { apiHeaders, apiUrl } from "@/lib/api";
import { driverKey, type LapData, type LapTimesResponse } from "@/lib/types";

type Stint = {
  stintNumber: number;
  compound: string;
  startLap: number;
  endLap: number;
  lapCount: number;
};

interface TyreStintChartProps {
  season: number;
  round: number;
  isSprint?: boolean;
}

const COMPOUND_COLORS: Record<
  string,
  { bg: string; border: string; text: string }
> = {
  SOFT: { bg: "bg-red-500/20", border: "border-red-500", text: "text-red-400" },
  MEDIUM: {
    bg: "bg-yellow-500/20",
    border: "border-yellow-500",
    text: "text-yellow-400",
  },
  HARD: {
    bg: "bg-bg-elevated/20",
    border: "border-border-secondary",
    text: "text-text-secondary",
  },
  INTERMEDIATE: {
    bg: "bg-green-500/20",
    border: "border-green-500",
    text: "text-green-400",
  },
  WET: {
    bg: "bg-blue-500/20",
    border: "border-blue-500",
    text: "text-blue-400",
  },
};

const COMPOUND_BAR_COLORS: Record<string, string> = {
  SOFT: "#ef4444",
  MEDIUM: "#eab308",
  HARD: "#d1d5db",
  INTERMEDIATE: "#22c55e",
  WET: "#3b82f6",
};

function computeStints(laps: LapData[]): Stint[] {
  if (laps.length === 0) return [];

  const stints: Stint[] = [];
  let currentCompound = laps[0].compound || "UNKNOWN";
  let currentStint = laps[0].stint || 1;
  let startLap = laps[0].lap_number;

  for (let i = 1; i < laps.length; i++) {
    const lap = laps[i];
    const lapStint = lap.stint || currentStint;
    const lapCompound = lap.compound || currentCompound;

    if (lapStint !== currentStint || lapCompound !== currentCompound) {
      stints.push({
        stintNumber: currentStint,
        compound: currentCompound,
        startLap,
        endLap: laps[i - 1].lap_number,
        lapCount: laps[i - 1].lap_number - startLap + 1,
      });
      currentCompound = lapCompound;
      currentStint = lapStint;
      startLap = lap.lap_number;
    }
  }

  // Push the final stint
  stints.push({
    stintNumber: currentStint,
    compound: currentCompound,
    startLap,
    endLap: laps[laps.length - 1].lap_number,
    lapCount: laps[laps.length - 1].lap_number - startLap + 1,
  });

  return stints;
}

export default function TyreStintChart({
  season,
  round,
  isSprint = false,
}: TyreStintChartProps) {
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const { data, isLoading: loading } = useQuery<LapTimesResponse | null>({
    queryKey: ["tyre-stint", season, round, isSprint],
    queryFn: async () => {
      const endpoint = isSprint
        ? `/api/results/${season}/${round}/sprint/lap-times`
        : `/api/results/${season}/${round}/lap-times`;
      const response = await fetch(apiUrl(endpoint), {
        cache: "no-store",
        headers: apiHeaders(),
      });
      if (!response.ok) return null;
      return response.json();
    },
    enabled: season >= 2018,
  });

  // Auto-select top 10 drivers when data loads
  useEffect(() => {
    if (data?.drivers) {
      const sorted = [...data.drivers].sort(
        (a, b) => (a.final_position || 999) - (b.final_position || 999),
      );
      setSelectedDrivers(sorted.slice(0, 10).map((d) => driverKey(d)));
    }
  }, [data]);

  const getDrivers = () => {
    if (!data?.drivers) return [];
    return [...data.drivers].sort(
      (a, b) => (a.final_position || 999) - (b.final_position || 999),
    );
  };

  const toggleDriver = (driverCode: string) => {
    setSelectedDrivers((prev) =>
      prev.includes(driverCode)
        ? prev.filter((d) => d !== driverCode)
        : [...prev, driverCode],
    );
  };

  if (loading) {
    return (
      <div style={{ minHeight: "300px" }}>
        <div className="h-8 mb-4 flex items-center">
          <div className="h-6 bg-bg-elevated rounded w-96 animate-pulse" />
        </div>
        <div className="relative" style={{ height: "200px" }}>
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-center text-text-muted font-mono tracking-widest text-xs uppercase">
              Loading tyre data...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!data?.drivers) {
    if (season < 2018) return null;
    return (
      <div style={{ minHeight: "200px" }}>
        <div className="h-8 mb-4 flex items-center">
          <h3 className="text-sm font-bold text-text-secondary font-mono">
            Tyre Strategy
          </h3>
        </div>
        <div className="relative" style={{ height: "150px" }}>
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-text-muted font-mono tracking-widest text-xs uppercase">
              Tyre data not available for this session.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const drivers = getDrivers();
  const filteredDrivers = drivers.filter((d) =>
    selectedDrivers.includes(driverKey(d)),
  );

  // Find max lap count across all selected drivers
  const maxLap = filteredDrivers.reduce(
    (max, d) =>
      Math.max(
        max,
        d.laps.length > 0 ? d.laps[d.laps.length - 1].lap_number : 0,
      ),
    0,
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-text-secondary font-mono">
          Tyre Strategy
        </h3>

        <div className="flex gap-2 relative" ref={dropdownRef}>
          {/* Compound Legend */}
          <div className="hidden sm:flex items-center gap-3 mr-2">
            {Object.entries(COMPOUND_COLORS)
              .slice(0, 3)
              .map(([compound, colors]) => (
                <div key={compound} className="flex items-center gap-1.5">
                  <div
                    className={`w-2.5 h-2.5 rounded-full`}
                    style={{ backgroundColor: COMPOUND_BAR_COLORS[compound] }}
                  />
                  <span
                    className={`text-[10px] font-mono font-bold uppercase tracking-widest ${colors.text}`}
                  >
                    {compound.charAt(0)}
                  </span>
                </div>
              ))}
          </div>

          <button
            type="button"
            onClick={() => setShowDropdown(!showDropdown)}
            className="px-4 py-1.5 rounded-sm text-xs font-bold font-mono uppercase tracking-widest border border-border-secondary text-text-secondary hover:border-purple-500 hover:text-purple-300 transition-colors duration-150"
          >
            Select ({selectedDrivers.length})
          </button>

          {showDropdown && (
            <div className="absolute right-0 top-full mt-1 bg-bg-tertiary border border-border-primary rounded-sm shadow-xl z-10 min-w-[250px] max-h-[300px] overflow-y-auto">
              {drivers.map((driver) => {
                const dk = driverKey(driver);
                const isSelected = selectedDrivers.includes(dk);
                const teamColor = driver.team_color
                  ? `#${driver.team_color}`
                  : "#999";

                return (
                  <label
                    key={dk}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-bg-elevated cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleDriver(dk)}
                      className="w-4 h-4 accent-purple-500"
                    />
                    <span className="text-sm text-text-muted w-5 font-mono">
                      {driver.final_position || "-"}
                    </span>
                    <span
                      className="text-sm font-semibold"
                      style={{ color: teamColor }}
                    >
                      {driver.full_name}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Stint Bars */}
      {filteredDrivers.length > 0 ? (
        <div className="space-y-1.5">
          {filteredDrivers.map((driver) => {
            const stints = computeStints(driver.laps);
            const teamColor = driver.team_color
              ? `#${driver.team_color}`
              : "#999";

            return (
              <div key={driverKey(driver)} className="flex items-center gap-2">
                {/* Driver label */}
                <div className="w-12 shrink-0 text-right">
                  <span
                    className="text-xs font-bold font-mono"
                    style={{ color: teamColor }}
                  >
                    {driverKey(driver)}
                  </span>
                </div>

                {/* Stint bar */}
                <div className="flex-1 flex h-7 gap-px rounded-sm overflow-hidden bg-bg-primary/30 border border-border-primary/50">
                  {stints.map((stint) => {
                    const widthPercent =
                      maxLap > 0 ? (stint.lapCount / maxLap) * 100 : 0;
                    const barColor =
                      COMPOUND_BAR_COLORS[stint.compound] || "#666";

                    return (
                      <div
                        key={`${stint.stintNumber}-${stint.startLap}`}
                        className="relative h-full flex items-center justify-center group"
                        style={{
                          width: `${widthPercent}%`,
                          backgroundColor: `${barColor}22`,
                          borderRight: `2px solid ${barColor}`,
                        }}
                        title={`${stint.compound} | Laps ${stint.startLap}-${stint.endLap} (${stint.lapCount} laps)`}
                      >
                        {/* Label inside the bar */}
                        {widthPercent > 8 && (
                          <span
                            className="text-[10px] font-mono font-bold truncate px-1"
                            style={{ color: barColor }}
                          >
                            {stint.compound.charAt(0)}
                            {stint.lapCount}
                          </span>
                        )}

                        {/* Hover tooltip */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-bg-tertiary border border-border-primary rounded-sm p-2 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none z-20 whitespace-nowrap">
                          <div className="text-[10px] font-mono space-y-0.5">
                            <div>
                              <span className="text-text-muted">Compound:</span>{" "}
                              <span
                                className="font-bold"
                                style={{ color: barColor }}
                              >
                                {stint.compound}
                              </span>
                            </div>
                            <div>
                              <span className="text-text-muted">Laps:</span>{" "}
                              <span className="text-text-primary font-bold">
                                {stint.startLap}-{stint.endLap} (
                                {stint.lapCount})
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Total laps */}
                <div className="w-8 shrink-0 text-right">
                  <span className="text-[10px] text-text-muted font-mono">
                    {driver.laps.length > 0
                      ? driver.laps[driver.laps.length - 1].lap_number
                      : 0}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div
          className="flex items-center justify-center"
          style={{ minHeight: "150px" }}
        >
          <p className="text-text-muted font-mono tracking-widest text-xs uppercase">
            Select at least one driver to view tyre strategy.
          </p>
        </div>
      )}
    </div>
  );
}
