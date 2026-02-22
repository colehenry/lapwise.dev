"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { apiHeaders, apiUrl } from "@/lib/api";

// Types
type SectorData = {
  driver_code: string;
  full_name: string;
  team_color: string | null;
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

// Delta color: green = faster (negative delta), purple = slower (positive delta)
const FASTER_COLOR = "#22c55e";
const SLOWER_COLOR = "#a855f7";

interface SectorTooltipEntry {
  dataKey: string;
  value: number;
  name: string;
  payload: Record<string, unknown>;
}
interface SectorTooltipProps {
  active?: boolean;
  payload?: SectorTooltipEntry[];
}
// Custom tooltip for the bar chart
const SectorTooltip = ({ active, payload }: SectorTooltipProps) => {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0]?.payload;
  if (!data) return null;

  return (
    <div className="bg-bg-tertiary border border-border-primary rounded-lg p-3 shadow-xl">
      <p className="font-bold text-text-primary text-sm mb-1">
        {data.name as string}
      </p>
      <div className="space-y-1 text-xs">
        {payload.map((entry: SectorTooltipEntry) => (
          <div key={entry.dataKey} className="flex justify-between gap-4">
            <span className="text-text-muted">{entry.name}</span>
            <span className="font-mono text-text-primary">
              {entry.value?.toFixed(3)}s
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

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

  // Chart data for Recharts
  const chartData = useMemo(() => {
    if (!driver1 || !driver2) return [];
    return [
      {
        name: driver1.full_name,
        driver_code: driver1.driver_code,
        S1: driver1.best_sector1,
        S2: driver1.best_sector2,
        S3: driver1.best_sector3,
        team_color: driver1.team_color,
      },
      {
        name: driver2.full_name,
        driver_code: driver2.driver_code,
        S1: driver2.best_sector1,
        S2: driver2.best_sector2,
        S3: driver2.best_sector3,
        team_color: driver2.team_color,
      },
    ];
  }, [driver1, driver2]);

  // Sector bar colors based on who is faster
  const getSectorColor = (
    sectorKey: "S1" | "S2" | "S3",
    driverIndex: number,
  ): string => {
    if (!driver1 || !driver2) return "#555";

    const d1Val =
      sectorKey === "S1"
        ? driver1.best_sector1
        : sectorKey === "S2"
          ? driver1.best_sector2
          : driver1.best_sector3;
    const d2Val =
      sectorKey === "S1"
        ? driver2.best_sector1
        : sectorKey === "S2"
          ? driver2.best_sector2
          : driver2.best_sector3;

    if (d1Val == null || d2Val == null) return "#555";

    if (driverIndex === 0) {
      return d1Val <= d2Val ? FASTER_COLOR : SLOWER_COLOR;
    }
    return d2Val <= d1Val ? FASTER_COLOR : SLOWER_COLOR;
  };

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
          <div
            className="w-2 h-6 rounded-sm shrink-0"
            style={{ backgroundColor: teamColor }}
          />
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
                    <div
                      className="w-2 h-4 rounded-sm shrink-0"
                      style={{ backgroundColor: color }}
                    />
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

  return (
    <div className="space-y-5">
      {/* Header + Driver Selectors */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-sm font-bold text-text-secondary font-mono">
          Qualifying Sectors
        </h3>
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
          {/* Stacked Bar Chart */}
          <div className="bg-bg-secondary/50 border border-border-primary rounded-sm p-4">
            <ResponsiveContainer width="100%" height={120}>
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
                barSize={28}
                barGap={8}
              >
                <XAxis type="number" hide domain={[0, "dataMax"]} />
                <YAxis
                  type="category"
                  dataKey="driver_code"
                  width={50}
                  tick={{
                    fill: "#999",
                    fontSize: 12,
                    fontFamily: "monospace",
                    fontWeight: "bold",
                  }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<SectorTooltip />} />
                <Bar
                  dataKey="S1"
                  stackId="sectors"
                  name="Sector 1"
                  radius={[0, 0, 0, 0]}
                >
                  {chartData.map((_, idx) => (
                    <Cell
                      key={`s1-${chartData[idx]?.driver_code}`}
                      fill={getSectorColor("S1", idx)}
                      fillOpacity={0.8}
                    />
                  ))}
                </Bar>
                <Bar
                  dataKey="S2"
                  stackId="sectors"
                  name="Sector 2"
                  radius={[0, 0, 0, 0]}
                >
                  {chartData.map((_, idx) => (
                    <Cell
                      key={`s2-${chartData[idx]?.driver_code}`}
                      fill={getSectorColor("S2", idx)}
                      fillOpacity={0.6}
                    />
                  ))}
                </Bar>
                <Bar
                  dataKey="S3"
                  stackId="sectors"
                  name="Sector 3"
                  radius={[0, 4, 4, 0]}
                >
                  {chartData.map((_, idx) => (
                    <Cell
                      key={`s3-${chartData[idx]?.driver_code}`}
                      fill={getSectorColor("S3", idx)}
                      fillOpacity={0.4}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Sector Breakdown Table */}
          <div className="bg-bg-secondary/50 border border-border-primary rounded-sm overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-5 gap-0 text-[10px] font-mono uppercase tracking-widest text-text-muted border-b border-border-primary">
              <div className="px-3 py-2">Sector</div>
              <div className="px-3 py-2 text-right">{driver1.driver_code}</div>
              <div className="px-3 py-2 text-center">Delta</div>
              <div className="px-3 py-2 text-left">{driver2.driver_code}</div>
              <div className="px-3 py-2 text-right">Faster</div>
            </div>

            {/* Sector Rows */}
            {(["s1", "s2", "s3"] as const).map((sector) => {
              const sectorNum = sector === "s1" ? 1 : sector === "s2" ? 2 : 3;
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
              const d1Faster = delta != null && delta > 0;
              const d2Faster = delta != null && delta < 0;

              return (
                <div
                  key={sector}
                  className="grid grid-cols-5 gap-0 border-b border-border-primary/50 last:border-b-0 hover:bg-bg-elevated/30 transition-colors"
                >
                  <div className="px-3 py-2.5 text-xs font-mono font-bold text-text-secondary">
                    S{sectorNum}
                  </div>
                  <div
                    className="px-3 py-2.5 text-right font-mono text-sm"
                    style={{
                      color: d1Faster
                        ? FASTER_COLOR
                        : d2Faster
                          ? SLOWER_COLOR
                          : "#ccc",
                    }}
                  >
                    {formatSectorTime(d1Time)}
                  </div>
                  <div className="px-3 py-2.5 text-center">
                    {delta != null && (
                      <span
                        className="font-mono text-xs font-bold px-1.5 py-0.5 rounded-sm"
                        style={{
                          color: delta > 0 ? FASTER_COLOR : SLOWER_COLOR,
                          backgroundColor:
                            delta > 0
                              ? "rgba(34, 197, 94, 0.1)"
                              : "rgba(168, 85, 247, 0.1)",
                        }}
                      >
                        {formatDelta(delta > 0 ? -delta : -delta)}
                      </span>
                    )}
                  </div>
                  <div
                    className="px-3 py-2.5 text-left font-mono text-sm"
                    style={{
                      color: d2Faster
                        ? FASTER_COLOR
                        : d1Faster
                          ? SLOWER_COLOR
                          : "#ccc",
                    }}
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
                  color:
                    deltas.total != null && deltas.total > 0
                      ? FASTER_COLOR
                      : deltas.total != null && deltas.total < 0
                        ? SLOWER_COLOR
                        : "#ccc",
                }}
              >
                {formatLapTime(driver1.best_lap_time)}
              </div>
              <div className="px-3 py-3 text-center">
                {deltas.total != null && (
                  <span
                    className="font-mono text-sm font-bold px-2 py-0.5 rounded-sm"
                    style={{
                      color: deltas.total > 0 ? FASTER_COLOR : SLOWER_COLOR,
                      backgroundColor:
                        deltas.total > 0
                          ? "rgba(34, 197, 94, 0.15)"
                          : "rgba(168, 85, 247, 0.15)",
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
                  color:
                    deltas.total != null && deltas.total < 0
                      ? FASTER_COLOR
                      : deltas.total != null && deltas.total > 0
                        ? SLOWER_COLOR
                        : "#ccc",
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
