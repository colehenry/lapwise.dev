"use client";

import { useMemo } from "react";
import { CHART_TYPOGRAPHY } from "@/components/chart-primitives";
import DriverMultiSelect from "@/components/charts/DriverMultiSelect";
import {
  sortDriversByClassification,
  useDriverSelection,
} from "@/hooks/useDriverSelection";
import { usePracticeLapTimes } from "@/hooks/usePracticeLapTimes";
import { type DriverLapTimes, driverKey } from "@/lib/types";

interface PracticeSectorHeatmapProps {
  season: number;
  round: number;
  practiceSession: 1 | 2 | 3;
  initialDrivers?: string[];
}

type DriverSectors = {
  driverCode: string;
  teamColor: string;
  finalPosition: number | null;
  bestS1: number | null;
  bestS2: number | null;
  bestS3: number | null;
  compositeBest: number | null;
};

const fmtSector = (s: number | null) => (s == null ? "-" : s.toFixed(3));

const fmtTime = (s: number | null) => {
  if (s == null) return "-";
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem.toFixed(3).padStart(6, "0")}`;
};

function deltaColor(delta: number | null): string {
  if (delta == null) return "bg-bg-primary text-text-muted";
  if (delta <= 0.001) return "bg-purple-500/20 text-purple-300";
  if (delta <= 0.1) return "bg-green-500/15 text-green-400";
  if (delta <= 0.3) return "bg-yellow-500/10 text-yellow-400";
  if (delta <= 0.6) return "bg-orange-500/10 text-orange-400";
  return "bg-red-500/10 text-red-400";
}

function deltaLabel(delta: number | null): string {
  if (delta == null) return "-";
  if (delta <= 0.001) return "+0.000";
  return `+${delta.toFixed(3)}`;
}

function DeltaBar({
  delta,
  maxDelta,
}: {
  delta: number | null;
  maxDelta: number;
}) {
  if (delta == null || maxDelta <= 0) return null;
  const pct = Math.min((delta / maxDelta) * 100, 100);
  return (
    <div
      className="absolute bottom-0 left-0 h-[2px] rounded-full opacity-50"
      style={{ width: `${pct}%`, backgroundColor: "currentColor" }}
    />
  );
}

export default function PracticeSectorHeatmap({
  season,
  round,
  practiceSession,
  initialDrivers,
}: PracticeSectorHeatmapProps) {
  const { data, isLoading } = usePracticeLapTimes(
    season,
    round,
    practiceSession,
  );
  const { selectedDrivers, toggleDriver } = useDriverSelection(data?.drivers, {
    initialDrivers,
  });

  const {
    allDrivers,
    sessionBestS1,
    sessionBestS2,
    sessionBestS3,
    maxDeltaS1,
    maxDeltaS2,
    maxDeltaS3,
    dropdownDrivers,
  } = useMemo(() => {
    if (!data)
      return {
        allDrivers: [],
        sessionBestS1: null,
        sessionBestS2: null,
        sessionBestS3: null,
        maxDeltaS1: 0,
        maxDeltaS2: 0,
        maxDeltaS3: 0,
        dropdownDrivers: [] as DriverLapTimes[],
      };

    const driverSectors: DriverSectors[] = [];
    let sessS1: number | null = null;
    let sessS2: number | null = null;
    let sessS3: number | null = null;

    for (const driver of data.drivers) {
      let bestS1: number | null = null;
      let bestS2: number | null = null;
      let bestS3: number | null = null;

      for (const lap of driver.laps) {
        if (lap.deleted) continue;
        if (
          lap.sector1_time_seconds != null &&
          (bestS1 == null || lap.sector1_time_seconds < bestS1)
        )
          bestS1 = lap.sector1_time_seconds;
        if (
          lap.sector2_time_seconds != null &&
          (bestS2 == null || lap.sector2_time_seconds < bestS2)
        )
          bestS2 = lap.sector2_time_seconds;
        if (
          lap.sector3_time_seconds != null &&
          (bestS3 == null || lap.sector3_time_seconds < bestS3)
        )
          bestS3 = lap.sector3_time_seconds;
      }

      if (bestS1 != null && (sessS1 == null || bestS1 < sessS1))
        sessS1 = bestS1;
      if (bestS2 != null && (sessS2 == null || bestS2 < sessS2))
        sessS2 = bestS2;
      if (bestS3 != null && (sessS3 == null || bestS3 < sessS3))
        sessS3 = bestS3;

      const compositeBest =
        bestS1 != null && bestS2 != null && bestS3 != null
          ? bestS1 + bestS2 + bestS3
          : null;

      driverSectors.push({
        driverCode: driverKey(driver),
        teamColor: driver.team_color ? `#${driver.team_color}` : "#666",
        finalPosition: driver.final_position ?? null,
        bestS1,
        bestS2,
        bestS3,
        compositeBest,
      });
    }

    driverSectors.sort((a, b) => {
      const aT = a.compositeBest ?? Infinity;
      const bT = b.compositeBest ?? Infinity;
      return aT - bT;
    });

    let maxDeltaS1 = 0;
    let maxDeltaS2 = 0;
    let maxDeltaS3 = 0;
    for (const d of driverSectors) {
      if (d.bestS1 != null && sessS1 != null)
        maxDeltaS1 = Math.max(maxDeltaS1, d.bestS1 - sessS1);
      if (d.bestS2 != null && sessS2 != null)
        maxDeltaS2 = Math.max(maxDeltaS2, d.bestS2 - sessS2);
      if (d.bestS3 != null && sessS3 != null)
        maxDeltaS3 = Math.max(maxDeltaS3, d.bestS3 - sessS3);
    }

    const dropdownDrivers = sortDriversByClassification(data.drivers);

    return {
      allDrivers: driverSectors,
      sessionBestS1: sessS1,
      sessionBestS2: sessS2,
      sessionBestS3: sessS3,
      maxDeltaS1,
      maxDeltaS2,
      maxDeltaS3,
      dropdownDrivers,
    };
  }, [data]);

  const visibleDrivers = useMemo(
    () => allDrivers.filter((d) => selectedDrivers.includes(d.driverCode)),
    [allDrivers, selectedDrivers],
  );

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
    return <div className="h-48 bg-bg-elevated rounded animate-pulse" />;
  }

  if (!data || allDrivers.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-text-muted text-sm font-mono">
          No sector data available.
        </p>
      </div>
    );
  }

  const hasSectors = allDrivers.some(
    (d) => d.bestS1 != null || d.bestS2 != null || d.bestS3 != null,
  );
  if (!hasSectors) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-text-muted text-sm font-mono">
          No sector timing data in this session.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Legend + selector row */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-purple-500/20 border border-purple-500/40" />
            <span className={CHART_TYPOGRAPHY.keyClassName}>
              Session fastest
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-green-500/15 border border-green-500/30" />
            <span className={CHART_TYPOGRAPHY.keyClassName}>≤ +0.1s</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-yellow-500/10 border border-yellow-500/20" />
            <span className={CHART_TYPOGRAPHY.keyClassName}>≤ +0.3s</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-red-500/10 border border-red-500/20" />
            <span className={CHART_TYPOGRAPHY.keyClassName}>&gt; +0.6s</span>
          </div>
        </div>

        <DriverMultiSelect
          drivers={dropdownDrivers}
          selectedDrivers={selectedDrivers}
          onToggleDriver={toggleDriver}
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs font-mono">
          <thead>
            <tr className="border-b border-border-primary">
              <th className="py-2 px-3 text-text-muted font-bold uppercase tracking-widest text-[10px] w-16 text-center">
                POS
              </th>
              <th className="py-2 px-3 text-text-muted font-bold uppercase tracking-widest text-[10px]">
                Driver
              </th>
              <th className="py-2 px-3 text-text-muted font-bold uppercase tracking-widest text-[10px] text-center">
                S1
              </th>
              <th className="py-2 px-3 text-text-muted font-bold uppercase tracking-widest text-[10px] text-center">
                S2
              </th>
              <th className="py-2 px-3 text-text-muted font-bold uppercase tracking-widest text-[10px] text-center">
                S3
              </th>
              <th className="py-2 px-3 text-text-muted font-bold uppercase tracking-widest text-[10px] text-center">
                Composite Best
              </th>
            </tr>
            <tr className="border-b border-border-primary/50 bg-bg-primary/30">
              <td className="py-1.5 px-3 text-center">
                <span className="text-purple-400 text-[9px] font-bold uppercase">
                  Best
                </span>
              </td>
              <td className="py-1.5 px-3 text-text-muted text-[10px]">
                Session Fastest
              </td>
              <td className="py-1.5 px-3 text-center text-purple-300 font-bold">
                {fmtSector(sessionBestS1)}
              </td>
              <td className="py-1.5 px-3 text-center text-purple-300 font-bold">
                {fmtSector(sessionBestS2)}
              </td>
              <td className="py-1.5 px-3 text-center text-purple-300 font-bold">
                {fmtSector(sessionBestS3)}
              </td>
              <td className="py-1.5 px-3 text-center text-purple-300 font-bold">
                {sessionBestS1 != null &&
                sessionBestS2 != null &&
                sessionBestS3 != null
                  ? fmtTime(sessionBestS1 + sessionBestS2 + sessionBestS3)
                  : "-"}
              </td>
            </tr>
          </thead>
          <tbody>
            {visibleDrivers.map((driver, idx) => {
              const d1 =
                driver.bestS1 != null && sessionBestS1 != null
                  ? driver.bestS1 - sessionBestS1
                  : null;
              const d2 =
                driver.bestS2 != null && sessionBestS2 != null
                  ? driver.bestS2 - sessionBestS2
                  : null;
              const d3 =
                driver.bestS3 != null && sessionBestS3 != null
                  ? driver.bestS3 - sessionBestS3
                  : null;
              const dT =
                driver.compositeBest != null &&
                sessionBestS1 != null &&
                sessionBestS2 != null &&
                sessionBestS3 != null
                  ? driver.compositeBest -
                    (sessionBestS1 + sessionBestS2 + sessionBestS3)
                  : null;

              return (
                <tr
                  key={driver.driverCode}
                  className="border-b border-border-primary/40 last:border-0 hover:bg-bg-primary/20 transition-colors"
                >
                  <td className="py-2 px-3 text-center text-text-muted font-bold">
                    {idx + 1}
                  </td>
                  <td className="py-2 px-3">
                    <span
                      className="font-bold text-xs"
                      style={{ color: driver.teamColor }}
                    >
                      {driver.driverCode}
                    </span>
                  </td>
                  <td
                    className={`py-2 px-1 text-center text-[11px] font-bold rounded-sm mx-1 relative overflow-hidden ${deltaColor(d1)}`}
                  >
                    <div className="text-[9px] text-text-muted">
                      {fmtSector(driver.bestS1)}
                    </div>
                    <div>{deltaLabel(d1)}</div>
                    <DeltaBar delta={d1} maxDelta={maxDeltaS1} />
                  </td>
                  <td
                    className={`py-2 px-1 text-center text-[11px] font-bold rounded-sm mx-1 relative overflow-hidden ${deltaColor(d2)}`}
                  >
                    <div className="text-[9px] text-text-muted">
                      {fmtSector(driver.bestS2)}
                    </div>
                    <div>{deltaLabel(d2)}</div>
                    <DeltaBar delta={d2} maxDelta={maxDeltaS2} />
                  </td>
                  <td
                    className={`py-2 px-1 text-center text-[11px] font-bold rounded-sm mx-1 relative overflow-hidden ${deltaColor(d3)}`}
                  >
                    <div className="text-[9px] text-text-muted">
                      {fmtSector(driver.bestS3)}
                    </div>
                    <div>{deltaLabel(d3)}</div>
                    <DeltaBar delta={d3} maxDelta={maxDeltaS3} />
                  </td>
                  <td
                    className={`py-2 px-1 text-center text-[11px] font-bold rounded-sm mx-1 ${deltaColor(dT)}`}
                  >
                    <div className="text-[9px] text-text-muted">
                      {fmtTime(driver.compositeBest)}
                    </div>
                    <div>{deltaLabel(dT)}</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
