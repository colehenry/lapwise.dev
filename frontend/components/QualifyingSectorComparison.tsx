"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { CHART_TYPOGRAPHY } from "@/components/chart-primitives";
import { apiHeaders, apiUrl, isValidHeadshotUrl } from "@/lib/api";

// Types
type SectorData = {
  driver_code: string;
  full_name: string;
  team_color: string | null;
  headshot_url: string | null;
  best_sector1: number | null;
  best_sector2: number | null;
  best_sector3: number | null;
  best_lap_time: number | null;
  q_session: string;
};

type QualifyingSectorResponse = {
  year: number;
  round: number;
  event_name: string;
  sectors: SectorData[];
};

interface QualifyingSectorComparisonProps {
  season: number;
  round: number;
}

// F1 timing colors
const SECTOR_COLORS = {
  purple: "#a855f7", // Overall fastest in session
  green: "#22c55e", // Faster than opponent
  yellow: "#eab308", // Slower than opponent
  neutral: "#666666",
} as const;

// Format seconds to readable time
const formatSectorTime = (seconds: number | null): string => {
  if (seconds === null) return "-";
  return seconds.toFixed(3);
};

const formatLapTime = (seconds: number | null): string => {
  if (seconds === null) return "-";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toFixed(3).padStart(6, "0")}`;
};

const formatDelta = (delta: number): string => {
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(3)}`;
};

// Determine sector color based on F1 timing rules
function getSectorColor(
  driverTime: number | null,
  opponentTime: number | null,
  overallBest: number | null,
): string {
  if (driverTime === null) return SECTOR_COLORS.neutral;

  // Purple: matches overall fastest in the session
  if (overallBest !== null && Math.abs(driverTime - overallBest) < 0.0005) {
    return SECTOR_COLORS.purple;
  }

  // Green: faster than opponent
  if (opponentTime !== null && driverTime < opponentTime) {
    return SECTOR_COLORS.green;
  }

  // Yellow: slower than opponent (or no opponent data)
  if (opponentTime !== null && driverTime > opponentTime) {
    return SECTOR_COLORS.yellow;
  }

  return SECTOR_COLORS.neutral;
}

export default function QualifyingSectorComparison({
  season,
  round,
}: QualifyingSectorComparisonProps) {
  const [driver1Code, setDriver1Code] = useState<string>("");
  const [driver2Code, setDriver2Code] = useState<string>("");
  const [showDriver1Dropdown, setShowDriver1Dropdown] = useState(false);
  const [showDriver2Dropdown, setShowDriver2Dropdown] = useState(false);
  const dropdown1Ref = useRef<HTMLDivElement>(null);
  const dropdown2Ref = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        dropdown1Ref.current &&
        !dropdown1Ref.current.contains(e.target as Node)
      ) {
        setShowDriver1Dropdown(false);
      }
      if (
        dropdown2Ref.current &&
        !dropdown2Ref.current.contains(e.target as Node)
      ) {
        setShowDriver2Dropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const { data, isLoading: loading } =
    useQuery<QualifyingSectorResponse | null>({
      queryKey: ["qualifying-sectors", season, round],
      queryFn: async () => {
        const response = await fetch(
          apiUrl(`/api/results/${season}/${round}/qualifying/sectors`),
          { cache: "no-store", headers: apiHeaders() },
        );
        if (!response.ok) return null;
        return response.json();
      },
      enabled: season >= 2018,
    });

  // Auto-select top 2 drivers when data loads
  useEffect(() => {
    if (data?.sectors && data.sectors.length >= 2) {
      setDriver1Code(data.sectors[0].driver_code);
      setDriver2Code(data.sectors[1].driver_code);
    }
  }, [data]);

  // Selected driver data
  const driver1 = useMemo(
    () => data?.sectors.find((s) => s.driver_code === driver1Code) ?? null,
    [data, driver1Code],
  );
  const driver2 = useMemo(
    () => data?.sectors.find((s) => s.driver_code === driver2Code) ?? null,
    [data, driver2Code],
  );

  // Overall fastest sectors across ALL drivers in the session
  const overallBest = useMemo(() => {
    if (!data?.sectors) return { s1: null, s2: null, s3: null, total: null };

    let bestS1: number | null = null;
    let bestS2: number | null = null;
    let bestS3: number | null = null;
    let bestTotal: number | null = null;

    for (const s of data.sectors) {
      if (
        s.best_sector1 !== null &&
        (bestS1 === null || s.best_sector1 < bestS1)
      )
        bestS1 = s.best_sector1;
      if (
        s.best_sector2 !== null &&
        (bestS2 === null || s.best_sector2 < bestS2)
      )
        bestS2 = s.best_sector2;
      if (
        s.best_sector3 !== null &&
        (bestS3 === null || s.best_sector3 < bestS3)
      )
        bestS3 = s.best_sector3;
      if (
        s.best_lap_time !== null &&
        (bestTotal === null || s.best_lap_time < bestTotal)
      )
        bestTotal = s.best_lap_time;
    }

    return { s1: bestS1, s2: bestS2, s3: bestS3, total: bestTotal };
  }, [data]);

  // Sector deltas (driver2 - driver1, positive = driver1 faster)
  const deltas = useMemo(() => {
    if (!driver1 || !driver2) return null;
    return {
      s1:
        driver1.best_sector1 != null && driver2.best_sector1 != null
          ? driver2.best_sector1 - driver1.best_sector1
          : null,
      s2:
        driver1.best_sector2 != null && driver2.best_sector2 != null
          ? driver2.best_sector2 - driver1.best_sector2
          : null,
      s3:
        driver1.best_sector3 != null && driver2.best_sector3 != null
          ? driver2.best_sector3 - driver1.best_sector3
          : null,
      total:
        driver1.best_lap_time != null && driver2.best_lap_time != null
          ? driver2.best_lap_time - driver1.best_lap_time
          : null,
    };
  }, [driver1, driver2]);

  // Render the driver selector
  const renderDriverSelector = (
    selectedCode: string,
    onSelect: (code: string) => void,
    otherCode: string,
    showDropdown: boolean,
    setShowDropdown: (v: boolean) => void,
    dropdownRef: React.RefObject<HTMLDivElement | null>,
    label: string,
  ) => {
    const selectedDriver = data?.sectors.find(
      (s) => s.driver_code === selectedCode,
    );
    const teamColor = selectedDriver?.team_color
      ? `#${selectedDriver.team_color}`
      : "#666";

    return (
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-2 px-3 py-2 bg-bg-tertiary border border-border-primary rounded-sm hover:border-purple-500 transition-colors min-w-[180px]"
        >
          {isValidHeadshotUrl(selectedDriver?.headshot_url) ? (
            <Image
              src={selectedDriver.headshot_url}
              alt={selectedDriver.full_name}
              width={32}
              height={32}
              className="rounded-sm object-cover border border-border-secondary shrink-0"
            />
          ) : (
            <div
              className="w-8 h-8 rounded-sm shrink-0 flex items-center justify-center text-[10px] font-mono font-bold text-text-muted"
              style={{
                backgroundColor: `${teamColor}33`,
                borderLeft: `2px solid ${teamColor}`,
              }}
            >
              {selectedDriver?.driver_code?.slice(0, 3) ?? "?"}
            </div>
          )}
          <div className="flex flex-col items-start">
            <span className="text-[10px] text-text-muted font-mono uppercase tracking-widest">
              {label}
            </span>
            <span className="text-sm font-bold text-text-primary truncate">
              {selectedDriver?.full_name ?? "Select Driver"}
            </span>
          </div>
          <svg
            className="w-3 h-3 text-text-muted ml-auto shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
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

        {showDropdown && data && (
          <div className="absolute top-full mt-1 left-0 bg-bg-tertiary border border-border-primary rounded-sm shadow-xl z-20 min-w-[220px] max-h-[260px] overflow-y-auto">
            {data.sectors
              .filter((s) => s.driver_code !== otherCode)
              .map((driver) => {
                const color = driver.team_color
                  ? `#${driver.team_color}`
                  : "#666";
                return (
                  <button
                    key={driver.driver_code}
                    type="button"
                    onClick={() => {
                      onSelect(driver.driver_code);
                      setShowDropdown(false);
                    }}
                    className={`flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-bg-elevated transition-colors ${
                      driver.driver_code === selectedCode
                        ? "bg-bg-elevated"
                        : ""
                    }`}
                  >
                    {isValidHeadshotUrl(driver.headshot_url) ? (
                      <Image
                        src={driver.headshot_url}
                        alt={driver.full_name}
                        width={24}
                        height={24}
                        className="rounded-sm object-cover shrink-0"
                      />
                    ) : (
                      <div
                        className="w-6 h-6 rounded-sm shrink-0"
                        style={{ backgroundColor: color }}
                      />
                    )}
                    <span className="text-sm text-text-primary">
                      {driver.full_name}
                    </span>
                    {driver.best_lap_time != null && (
                      <span className="text-xs font-mono text-text-muted ml-auto">
                        {formatLapTime(driver.best_lap_time)}
                      </span>
                    )}
                  </button>
                );
              })}
          </div>
        )}
      </div>
    );
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 bg-bg-elevated rounded w-44 animate-pulse" />
          <div className="text-text-muted text-xs font-mono">VS</div>
          <div className="h-10 bg-bg-elevated rounded w-44 animate-pulse" />
        </div>
        <div className="h-48 bg-bg-elevated rounded animate-pulse" />
      </div>
    );
  }

  // No data
  if (!data || data.sectors.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-text-muted text-sm">
          {season < 2018
            ? "Qualifying sector data is only available from 2018 onwards."
            : "No qualifying sector data available for this session."}
        </p>
      </div>
    );
  }

  // Get sector times and colors for a driver
  const getDriverSectors = (
    driver: SectorData | null,
    opponent: SectorData | null,
  ) => {
    if (!driver) return [];

    const sectors = [
      {
        key: "S1",
        time: driver.best_sector1,
        opTime: opponent?.best_sector1 ?? null,
        best: overallBest.s1,
      },
      {
        key: "S2",
        time: driver.best_sector2,
        opTime: opponent?.best_sector2 ?? null,
        best: overallBest.s2,
      },
      {
        key: "S3",
        time: driver.best_sector3,
        opTime: opponent?.best_sector3 ?? null,
        best: overallBest.s3,
      },
    ];

    return sectors.map((s) => ({
      key: s.key,
      time: s.time,
      color: getSectorColor(s.time, s.opTime, s.best),
    }));
  };

  const driver1Sectors = getDriverSectors(driver1, driver2);
  const driver2Sectors = getDriverSectors(driver2, driver1);

  // Calculate bar widths proportional to sector times
  const getBarWidths = (driver: SectorData | null) => {
    if (!driver || driver.best_lap_time === null) return [33.3, 33.3, 33.3];
    const total =
      (driver.best_sector1 ?? 0) +
      (driver.best_sector2 ?? 0) +
      (driver.best_sector3 ?? 0);
    if (total === 0) return [33.3, 33.3, 33.3];
    return [
      ((driver.best_sector1 ?? 0) / total) * 100,
      ((driver.best_sector2 ?? 0) / total) * 100,
      ((driver.best_sector3 ?? 0) / total) * 100,
    ];
  };

  const d1Widths = getBarWidths(driver1);
  const d2Widths = getBarWidths(driver2);

  // Get lap time color
  const getLapColor = (
    driverTime: number | null,
    opponentTime: number | null,
  ): string => {
    if (driverTime === null) return SECTOR_COLORS.neutral;
    if (
      overallBest.total !== null &&
      Math.abs(driverTime - overallBest.total) < 0.0005
    ) {
      return SECTOR_COLORS.purple;
    }
    if (opponentTime !== null && driverTime < opponentTime)
      return SECTOR_COLORS.green;
    if (opponentTime !== null && driverTime > opponentTime)
      return SECTOR_COLORS.yellow;
    return SECTOR_COLORS.neutral;
  };

  return (
    <div className="space-y-5">
      {/* Header + Driver Selectors */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          {/* Legend */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div
                className="w-2.5 h-2.5 rounded-sm"
                style={{ backgroundColor: SECTOR_COLORS.purple }}
              />
              <span className={CHART_TYPOGRAPHY.keyClassName}>
                Overall Best
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div
                className="w-2.5 h-2.5 rounded-sm"
                style={{ backgroundColor: SECTOR_COLORS.green }}
              />
              <span className={CHART_TYPOGRAPHY.keyClassName}>Faster</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div
                className="w-2.5 h-2.5 rounded-sm"
                style={{ backgroundColor: SECTOR_COLORS.yellow }}
              />
              <span className={CHART_TYPOGRAPHY.keyClassName}>Slower</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {renderDriverSelector(
            driver1Code,
            setDriver1Code,
            driver2Code,
            showDriver1Dropdown,
            setShowDriver1Dropdown,
            dropdown1Ref,
            "Driver 1",
          )}
          <span className="text-text-muted text-xs font-mono font-bold tracking-widest">
            VS
          </span>
          {renderDriverSelector(
            driver2Code,
            setDriver2Code,
            driver1Code,
            showDriver2Dropdown,
            setShowDriver2Dropdown,
            dropdown2Ref,
            "Driver 2",
          )}
        </div>
      </div>

      {/* Comparison Content */}
      {driver1 && driver2 && deltas ? (
        <div className="space-y-4">
          {/* Sector Bars Visualization */}
          <div className="bg-bg-secondary/50 border border-border-primary rounded-sm p-4 space-y-3">
            {/* Driver 1 Bar */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 w-20 shrink-0 justify-end">
                {isValidHeadshotUrl(driver1.headshot_url) && (
                  <Image
                    src={driver1.headshot_url}
                    alt={driver1.full_name}
                    width={24}
                    height={24}
                    className="rounded-sm object-cover hidden sm:block"
                  />
                )}
                <span className="text-xs font-mono font-bold text-text-secondary">
                  {driver1.driver_code}
                </span>
              </div>
              <div className="flex-1 flex h-8 gap-px rounded-sm overflow-hidden">
                {driver1Sectors.map((sector, i) => (
                  <div
                    key={sector.key}
                    className="relative flex items-center justify-center transition-all duration-300"
                    style={{
                      width: `${d1Widths[i]}%`,
                      backgroundColor: `${sector.color}22`,
                      borderLeft:
                        i > 0 ? `1px solid ${sector.color}44` : "none",
                    }}
                  >
                    <div
                      className="absolute inset-0 opacity-30"
                      style={{ backgroundColor: sector.color }}
                    />
                    <span
                      className="relative z-10 text-[10px] font-mono font-bold"
                      style={{ color: sector.color }}
                    >
                      {sector.time !== null
                        ? formatSectorTime(sector.time)
                        : "-"}
                    </span>
                  </div>
                ))}
              </div>
              <span
                className="text-xs font-mono font-bold w-20 text-right shrink-0"
                style={{
                  color: getLapColor(
                    driver1.best_lap_time,
                    driver2.best_lap_time,
                  ),
                }}
              >
                {formatLapTime(driver1.best_lap_time)}
              </span>
            </div>

            {/* Driver 2 Bar */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 w-20 shrink-0 justify-end">
                {isValidHeadshotUrl(driver2.headshot_url) && (
                  <Image
                    src={driver2.headshot_url}
                    alt={driver2.full_name}
                    width={24}
                    height={24}
                    className="rounded-sm object-cover hidden sm:block"
                  />
                )}
                <span className="text-xs font-mono font-bold text-text-secondary">
                  {driver2.driver_code}
                </span>
              </div>
              <div className="flex-1 flex h-8 gap-px rounded-sm overflow-hidden">
                {driver2Sectors.map((sector, i) => (
                  <div
                    key={sector.key}
                    className="relative flex items-center justify-center transition-all duration-300"
                    style={{
                      width: `${d2Widths[i]}%`,
                      backgroundColor: `${sector.color}22`,
                      borderLeft:
                        i > 0 ? `1px solid ${sector.color}44` : "none",
                    }}
                  >
                    <div
                      className="absolute inset-0 opacity-30"
                      style={{ backgroundColor: sector.color }}
                    />
                    <span
                      className="relative z-10 text-[10px] font-mono font-bold"
                      style={{ color: sector.color }}
                    >
                      {sector.time !== null
                        ? formatSectorTime(sector.time)
                        : "-"}
                    </span>
                  </div>
                ))}
              </div>
              <span
                className="text-xs font-mono font-bold w-20 text-right shrink-0"
                style={{
                  color: getLapColor(
                    driver2.best_lap_time,
                    driver1.best_lap_time,
                  ),
                }}
              >
                {formatLapTime(driver2.best_lap_time)}
              </span>
            </div>
          </div>

          {/* Sector Breakdown Table */}
          <div className="bg-bg-secondary/50 border border-border-primary rounded-sm overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-5 gap-0 text-[10px] font-mono uppercase tracking-widest text-text-muted border-b border-border-primary">
              <div className="px-3 py-2">Sector</div>
              <div className="px-3 py-2 flex items-center gap-1.5 justify-end">
                {isValidHeadshotUrl(driver1.headshot_url) && (
                  <Image
                    src={driver1.headshot_url}
                    alt={driver1.full_name}
                    width={18}
                    height={18}
                    className="rounded-sm object-cover hidden sm:block"
                  />
                )}
                {driver1.driver_code}
              </div>
              <div className="px-3 py-2 text-center">Delta</div>
              <div className="px-3 py-2 flex items-center gap-1.5">
                {isValidHeadshotUrl(driver2.headshot_url) && (
                  <Image
                    src={driver2.headshot_url}
                    alt={driver2.full_name}
                    width={18}
                    height={18}
                    className="rounded-sm object-cover hidden sm:block"
                  />
                )}
                {driver2.driver_code}
              </div>
              <div className="px-3 py-2 text-right">Faster</div>
            </div>

            {/* Sector Rows */}
            {(["s1", "s2", "s3"] as const).map((sector, sIdx) => {
              const d1Time =
                sector === "s1"
                  ? driver1.best_sector1
                  : sector === "s2"
                    ? driver1.best_sector2
                    : driver1.best_sector3;
              const d2Time =
                sector === "s1"
                  ? driver2.best_sector1
                  : sector === "s2"
                    ? driver2.best_sector2
                    : driver2.best_sector3;
              const delta = deltas[sector];

              const d1Color =
                driver1Sectors[sIdx]?.color ?? SECTOR_COLORS.neutral;
              const d2Color =
                driver2Sectors[sIdx]?.color ?? SECTOR_COLORS.neutral;

              const d1Faster = delta != null && delta > 0;
              const d2Faster = delta != null && delta < 0;

              return (
                <div
                  key={sector}
                  className="grid grid-cols-5 gap-0 border-b border-border-primary/50 last:border-b-0"
                >
                  <div className="px-3 py-2.5 text-xs font-mono font-bold text-text-secondary">
                    S{sIdx + 1}
                  </div>
                  <div
                    className="px-3 py-2.5 text-right font-mono text-sm"
                    style={{ color: d1Color }}
                  >
                    {formatSectorTime(d1Time)}
                  </div>
                  <div className="px-3 py-2.5 text-center">
                    {delta != null && (
                      <span
                        className="font-mono text-xs font-bold px-1.5 py-0.5 rounded-sm"
                        style={{
                          color: d1Faster
                            ? SECTOR_COLORS.green
                            : SECTOR_COLORS.yellow,
                          backgroundColor: d1Faster
                            ? "rgba(34, 197, 94, 0.1)"
                            : "rgba(234, 179, 8, 0.1)",
                        }}
                      >
                        {formatDelta(d1Faster ? -delta : -delta)}
                      </span>
                    )}
                  </div>
                  <div
                    className="px-3 py-2.5 text-left font-mono text-sm"
                    style={{ color: d2Color }}
                  >
                    {formatSectorTime(d2Time)}
                  </div>
                  <div className="px-3 py-2.5 text-right text-xs font-mono font-bold">
                    {d1Faster && (
                      <span
                        style={{
                          color: driver1.team_color
                            ? `#${driver1.team_color}`
                            : "#ccc",
                        }}
                      >
                        {driver1.driver_code}
                      </span>
                    )}
                    {d2Faster && (
                      <span
                        style={{
                          color: driver2.team_color
                            ? `#${driver2.team_color}`
                            : "#ccc",
                        }}
                      >
                        {driver2.driver_code}
                      </span>
                    )}
                    {!d1Faster && !d2Faster && (
                      <span className="text-text-muted">-</span>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Total Lap Time */}
            <div className="grid grid-cols-5 gap-0 bg-bg-tertiary/50 border-t border-border-primary">
              <div className="px-3 py-3 text-xs font-mono font-bold text-text-primary uppercase tracking-widest">
                Total
              </div>
              <div
                className="px-3 py-3 text-right font-mono text-sm font-bold"
                style={{
                  color: getLapColor(
                    driver1.best_lap_time,
                    driver2.best_lap_time,
                  ),
                }}
              >
                {formatLapTime(driver1.best_lap_time)}
              </div>
              <div className="px-3 py-3 text-center">
                {deltas.total != null && (
                  <span
                    className="font-mono text-sm font-bold px-2 py-0.5 rounded-sm"
                    style={{
                      color:
                        deltas.total > 0
                          ? SECTOR_COLORS.green
                          : SECTOR_COLORS.yellow,
                      backgroundColor:
                        deltas.total > 0
                          ? "rgba(34, 197, 94, 0.15)"
                          : "rgba(234, 179, 8, 0.15)",
                    }}
                  >
                    {formatDelta(
                      deltas.total > 0 ? -deltas.total : -deltas.total,
                    )}
                  </span>
                )}
              </div>
              <div
                className="px-3 py-3 text-left font-mono text-sm font-bold"
                style={{
                  color: getLapColor(
                    driver2.best_lap_time,
                    driver1.best_lap_time,
                  ),
                }}
              >
                {formatLapTime(driver2.best_lap_time)}
              </div>
              <div className="px-3 py-3 text-right text-xs font-mono font-bold">
                {deltas.total != null && deltas.total > 0 && (
                  <span
                    style={{
                      color: driver1.team_color
                        ? `#${driver1.team_color}`
                        : "#ccc",
                    }}
                  >
                    {driver1.driver_code}
                  </span>
                )}
                {deltas.total != null && deltas.total < 0 && (
                  <span
                    style={{
                      color: driver2.team_color
                        ? `#${driver2.team_color}`
                        : "#ccc",
                    }}
                  >
                    {driver2.driver_code}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center py-8">
          <p className="text-text-muted text-sm">
            Select two drivers to compare qualifying sectors.
          </p>
        </div>
      )}
    </div>
  );
}
