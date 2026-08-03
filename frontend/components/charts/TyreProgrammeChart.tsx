"use client";

import { useMemo } from "react";
import {
  sortDriversByClassification,
  useDriverSelection,
} from "@/hooks/useDriverSelection";
import { usePracticeLapTimes } from "@/hooks/usePracticeLapTimes";
import { COMPOUND_COLORS } from "@/lib/chart-utils";
import { type DriverLapTimes, driverKey } from "@/lib/types";
import { CHART_TYPOGRAPHY } from "./chart-primitives";
import DriverMultiSelect from "./DriverMultiSelect";

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
  const { data, isLoading } = usePracticeLapTimes(
    season,
    round,
    practiceSession,
  );
  const { selectedDrivers, toggleDriver } = useDriverSelection(data?.drivers, {
    initialDrivers,
  });

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
          teamColor: driver.team_color
            ? `#${driver.team_color}`
            : "var(--delta-neutral)",
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

      const dropdownDrivers = sortDriversByClassification(data.drivers);

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
          <span className={`${CHART_TYPOGRAPHY.keyClassName} flex-shrink-0`}>
            Compound pace
          </span>
          <div className="w-px h-3 bg-border-primary flex-shrink-0" />
          {compoundPace.map((cp) => {
            const color =
              COMPOUND_COLORS[cp.compound] ?? "var(--delta-neutral)";
            return (
              <div key={cp.compound} className="flex items-center gap-1.5">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span
                  className={CHART_TYPOGRAPHY.keyClassName}
                  style={{ color }}
                >
                  {cp.compound.slice(0, 1)}
                </span>
                <span className={CHART_TYPOGRAPHY.keyClassName}>
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
                style={{
                  backgroundColor: COMPOUND_COLORS[c] ?? "var(--delta-neutral)",
                }}
              />
              <span className={CHART_TYPOGRAPHY.keyClassName}>{c}</span>
            </div>
          ))}
        </div>

        <DriverMultiSelect
          drivers={dropdownDrivers}
          selectedDrivers={selectedDrivers}
          onToggleDriver={toggleDriver}
        />
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
                const color =
                  COMPOUND_COLORS[seg.compound] ?? "var(--delta-neutral)";
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
