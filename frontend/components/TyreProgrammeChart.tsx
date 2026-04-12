"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiHeaders, apiUrl } from "@/lib/api";
import {
  type DriverLapTimes,
  driverKey,
  type LapTimesResponse,
} from "@/lib/types";

const COMPOUND_COLORS: Record<string, string> = {
  SOFT: "#e8002d",
  MEDIUM: "#ffd700",
  HARD: "#c8c8c8",
  INTERMEDIATE: "#39b54a",
  WET: "#0067ff",
};

const COMPOUND_ORDER = ["SOFT", "MEDIUM", "HARD", "INTERMEDIATE", "WET"];

interface TyreProgrammeChartProps {
  season: number;
  round: number;
  practiceSession: 1 | 2 | 3;
  initialDrivers?: string[];
}

type DriverProgramme = {
  driverCode: string;
  teamColor: string;
  compounds: { compound: string; laps: number }[];
  totalLaps: number;
};

type CompoundPace = {
  compound: string;
  median: number;
  delta: number;
};

export default function TyreProgrammeChart({
  season,
  round,
  practiceSession,
  initialDrivers,
}: TyreProgrammeChartProps) {
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const initialDriverKey = initialDrivers?.join(",") ?? "";

  const { data, isLoading } = useQuery<LapTimesResponse | null>({
    queryKey: ["lap-times", season, round, false, practiceSession],
    queryFn: async () => {
      const res = await fetch(
        apiUrl(
          `/api/results/${season}/${round}/practice/${practiceSession}/lap-times`,
        ),
        { cache: "no-store", headers: apiHeaders() },
      );
      if (!res.ok) return null;
      return res.json();
    },
    enabled: season >= 2018,
  });

  useEffect(() => {
    if (data?.drivers) {
      const sorted = [...data.drivers].sort(
        (a, b) => (a.final_position ?? 999) - (b.final_position ?? 999),
      );
      const available = new Set(sorted.map((d) => driverKey(d)));
      const requested = initialDriverKey
        .split(",")
        .filter((key) => available.has(key));
      setSelectedDrivers(
        requested.length > 0
          ? requested
          : sorted.slice(0, 10).map((d) => driverKey(d)),
      );
    }
  }, [data, initialDriverKey]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggleDriver = (key: string) => {
    setSelectedDrivers((prev) =>
      prev.includes(key) ? prev.filter((d) => d !== key) : [...prev, key],
    );
  };

  const { allProgrammes, activeCompounds, compoundPace, dropdownDrivers } =
    useMemo(() => {
      if (!data)
        return {
          allProgrammes: [],
          activeCompounds: [] as string[],
          compoundPace: [] as CompoundPace[],
          dropdownDrivers: [] as DriverLapTimes[],
        };

      const programmes: DriverProgramme[] = [];
      const compoundSet = new Set<string>();
      const compoundTimes: Record<string, number[]> = {};

      for (const driver of data.drivers) {
        const compoundLaps: Record<string, number> = {};

        const stintFirstLap: Record<number, number> = {};
        for (const lap of driver.laps) {
          if (lap.stint == null) continue;
          if (
            !(lap.stint in stintFirstLap) ||
            lap.lap_number < stintFirstLap[lap.stint]
          ) {
            stintFirstLap[lap.stint] = lap.lap_number;
          }
        }
        const outlaps = new Set(Object.values(stintFirstLap));

        for (const lap of driver.laps) {
          if (lap.lap_time_seconds == null || lap.deleted) continue;
          const c = lap.compound ?? "UNKNOWN";
          compoundLaps[c] = (compoundLaps[c] ?? 0) + 1;
          compoundSet.add(c);

          if (!outlaps.has(lap.lap_number)) {
            if (!compoundTimes[c]) compoundTimes[c] = [];
            compoundTimes[c].push(lap.lap_time_seconds);
          }
        }

        const totalLaps = Object.values(compoundLaps).reduce(
          (a, b) => a + b,
          0,
        );
        if (totalLaps === 0) continue;

        const orderedCompounds = [
          ...COMPOUND_ORDER.filter((c) => compoundLaps[c]),
          ...Object.keys(compoundLaps).filter(
            (c) => !COMPOUND_ORDER.includes(c) && compoundLaps[c],
          ),
        ].map((c) => ({ compound: c, laps: compoundLaps[c] }));

        programmes.push({
          driverCode: driverKey(driver),
          teamColor: driver.team_color ? `#${driver.team_color}` : "#666",
          compounds: orderedCompounds,
          totalLaps,
        });
      }

      const activeCompounds = COMPOUND_ORDER.filter((c) => compoundSet.has(c));

      const compoundMedians: { compound: string; median: number }[] = [];
      for (const compound of activeCompounds) {
        const times = compoundTimes[compound];
        if (!times || times.length < 3) continue;
        const sorted = [...times].sort((a, b) => a - b);
        compoundMedians.push({
          compound,
          median: sorted[Math.floor(sorted.length / 2)],
        });
      }

      let compoundPace: CompoundPace[] = [];
      if (compoundMedians.length >= 2) {
        const fastest = Math.min(...compoundMedians.map((c) => c.median));
        compoundPace = compoundMedians
          .sort((a, b) => a.median - b.median)
          .map((c) => ({ ...c, delta: c.median - fastest }));
      }

      const dropdownDrivers = [...data.drivers].sort(
        (a, b) => (a.final_position ?? 999) - (b.final_position ?? 999),
      );

      return {
        allProgrammes: programmes,
        activeCompounds,
        compoundPace,
        dropdownDrivers,
      };
    }, [data]);

  const visibleProgrammes = useMemo(() => {
    const filtered = allProgrammes.filter((p) =>
      selectedDrivers.includes(p.driverCode),
    );
    const maxLaps = filtered.reduce((m, p) => Math.max(m, p.totalLaps), 0);
    return { programmes: filtered, maxLaps };
  }, [allProgrammes, selectedDrivers]);

  if (season < 2018) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-text-muted text-sm font-mono">
          Telemetry data available from 2018 onwards.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {["a", "b", "c", "d", "e"].map((id) => (
          <div
            key={`skel-${id}`}
            className="h-8 bg-bg-elevated rounded animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (!data || allProgrammes.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-text-muted text-sm font-mono">
          No tyre data available.
        </p>
      </div>
    );
  }

  const { programmes, maxLaps } = visibleProgrammes;

  return (
    <div className="space-y-4">
      {/* Compound pace delta summary */}
      {compoundPace.length >= 2 && (
        <div className="flex items-center gap-2 flex-wrap border border-border-primary/50 rounded-sm px-3 py-2 bg-bg-primary/30">
          <span className="text-[10px] font-mono text-text-muted uppercase tracking-widest flex-shrink-0">
            Compound pace
          </span>
          <div className="w-px h-3 bg-border-primary flex-shrink-0" />
          {compoundPace.map((cp) => {
            const color = COMPOUND_COLORS[cp.compound] ?? "#888";
            return (
              <div key={cp.compound} className="flex items-center gap-1.5">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span
                  className="text-[11px] font-bold font-mono uppercase"
                  style={{ color }}
                >
                  {cp.compound.slice(0, 1)}
                </span>
                <span className="text-[11px] font-mono text-text-secondary">
                  {cp.delta === 0 ? "baseline" : `+${cp.delta.toFixed(3)}s`}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Legend + selector */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-4 flex-wrap">
          {activeCompounds.map((c) => (
            <div key={c} className="flex items-center gap-1.5">
              <div
                className="w-3 h-3 rounded-sm flex-shrink-0"
                style={{ backgroundColor: COMPOUND_COLORS[c] ?? "#888" }}
              />
              <span className="text-[10px] font-mono text-text-muted uppercase">
                {c}
              </span>
            </div>
          ))}
        </div>

        <div className="relative flex-shrink-0" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setShowDropdown((v) => !v)}
            className="px-3 py-1.5 rounded-sm text-xs font-bold font-mono uppercase tracking-widest border border-border-primary text-text-secondary hover:border-purple-500 hover:text-purple-300 transition-colors"
          >
            Drivers ({selectedDrivers.length})
          </button>
          {showDropdown && (
            <div className="absolute right-0 top-full mt-1 bg-bg-tertiary border border-border-primary rounded-sm shadow-xl z-10 min-w-[220px] max-h-[280px] overflow-y-auto">
              {dropdownDrivers.map((driver) => {
                const key = driverKey(driver);
                const isSelected = selectedDrivers.includes(key);
                const color = driver.team_color
                  ? `#${driver.team_color}`
                  : "#666";
                return (
                  <label
                    key={key}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-bg-elevated cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleDriver(key)}
                      className="w-4 h-4 accent-purple-500"
                    />
                    <span className="text-[10px] font-mono text-text-muted w-5">
                      {driver.final_position ?? "-"}
                    </span>
                    <span
                      className="text-xs font-bold font-mono"
                      style={{ color }}
                    >
                      {driver.driver_code ?? driver.full_name}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Usage bars */}
      <div className="space-y-1.5">
        {programmes.map((prog) => (
          <div key={prog.driverCode} className="flex items-center gap-3">
            <div className="w-10 text-right flex-shrink-0">
              <span
                className="text-xs font-bold font-mono"
                style={{ color: prog.teamColor }}
              >
                {prog.driverCode}
              </span>
            </div>
            <div className="flex-1 flex items-center h-7 rounded-sm overflow-hidden bg-bg-primary/40 border border-border-primary/40">
              {prog.compounds.map((seg) => {
                const pct = maxLaps > 0 ? (seg.laps / maxLaps) * 100 : 0;
                const color = COMPOUND_COLORS[seg.compound] ?? "#888";
                return (
                  <div
                    key={seg.compound}
                    className="h-full flex items-center justify-center relative group"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: `${color}99`,
                      borderRight: `1px solid ${color}44`,
                    }}
                    title={`${seg.compound}: ${seg.laps} laps`}
                  >
                    {seg.laps >= 3 && (
                      <span
                        className="text-[9px] font-bold font-mono select-none"
                        style={{ color }}
                      >
                        {seg.laps}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="w-12 text-left flex-shrink-0">
              <span className="text-[10px] font-mono text-text-muted">
                {prog.totalLaps}L
              </span>
            </div>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-text-muted font-mono uppercase tracking-widest">
        Bar width proportional to laps vs session leader · hover for exact
        counts
      </p>
    </div>
  );
}
