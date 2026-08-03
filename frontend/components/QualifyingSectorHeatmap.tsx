"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { CHART_TYPOGRAPHY } from "@/components/chart-primitives";
import { qualifyingSectorsQuery } from "@/lib/queries/entities";

interface QualifyingSectorHeatmapProps {
  season: number;
  round: number;
}

const fmtSector = (s: number | null) => (s == null ? "-" : s.toFixed(3));
const fmtTime = (s: number | null) => {
  if (s == null) return "-";
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem.toFixed(3).padStart(6, "0")}`;
};

function deltaColor(delta: number | null): string {
  if (delta == null) return "bg-bg-primary text-text-muted";
  if (delta <= 0.001) return "bg-purple-500/25 text-purple-300";
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

const Q_BADGE: Record<string, string> = {
  Q1: "bg-text-muted/10 text-text-muted",
  Q2: "bg-yellow-500/10 text-yellow-400",
  Q3: "bg-purple-500/10 text-purple-400",
};

export default function QualifyingSectorHeatmap({
  season,
  round,
}: QualifyingSectorHeatmapProps) {
  const { data, isLoading } = useQuery({
    ...qualifyingSectorsQuery(season, round),
    enabled: season >= 2018,
  });

  const { drivers, bestS1, bestS2, bestS3, bestLap } = useMemo(() => {
    if (!data?.sectors?.length)
      return {
        drivers: [],
        bestS1: null,
        bestS2: null,
        bestS3: null,
        bestLap: null,
      };

    let bestS1: number | null = null;
    let bestS2: number | null = null;
    let bestS3: number | null = null;
    let bestLap: number | null = null;

    for (const d of data.sectors) {
      if (d.best_sector1 != null && (bestS1 == null || d.best_sector1 < bestS1))
        bestS1 = d.best_sector1;
      if (d.best_sector2 != null && (bestS2 == null || d.best_sector2 < bestS2))
        bestS2 = d.best_sector2;
      if (d.best_sector3 != null && (bestS3 == null || d.best_sector3 < bestS3))
        bestS3 = d.best_sector3;
      if (
        d.best_lap_time != null &&
        (bestLap == null || d.best_lap_time < bestLap)
      )
        bestLap = d.best_lap_time;
    }

    // Sort by best lap time
    const drivers = [...data.sectors].sort((a, b) => {
      const aT = a.best_lap_time ?? Infinity;
      const bT = b.best_lap_time ?? Infinity;
      return aT - bT;
    });

    return { drivers, bestS1, bestS2, bestS3, bestLap };
  }, [data]);

  if (season < 2018) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-text-muted text-sm font-mono">
          Sector data available from 2018 onwards.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return <div className="h-48 bg-bg-elevated rounded animate-pulse" />;
  }

  if (!data || drivers.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-text-muted text-sm font-mono">
          No sector data available.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Legend */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-purple-500/25 border border-purple-500/40" />
          <span className={CHART_TYPOGRAPHY.keyClassName}>Session fastest</span>
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

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs font-mono">
          <thead>
            <tr className="border-b border-border-primary">
              <th className="py-2 px-2 text-text-muted font-bold uppercase tracking-widest text-[10px] w-12 text-center">
                POS
              </th>
              <th className="py-2 px-3 text-text-muted font-bold uppercase tracking-widest text-[10px]">
                Driver
              </th>
              <th className="py-2 px-2 text-text-muted font-bold uppercase tracking-widest text-[10px] text-center w-8">
                Q
              </th>
              <th className="py-2 px-2 text-text-muted font-bold uppercase tracking-widest text-[10px] text-center">
                S1
              </th>
              <th className="py-2 px-2 text-text-muted font-bold uppercase tracking-widest text-[10px] text-center">
                S2
              </th>
              <th className="py-2 px-2 text-text-muted font-bold uppercase tracking-widest text-[10px] text-center">
                S3
              </th>
              <th className="py-2 px-2 text-text-muted font-bold uppercase tracking-widest text-[10px] text-center">
                Best Lap
              </th>
            </tr>
            {/* Session best row */}
            <tr className="border-b border-border-primary/50 bg-bg-primary/30">
              <td className="py-1.5 px-2 text-center">
                <span className="text-purple-400 text-[9px] font-bold uppercase">
                  Best
                </span>
              </td>
              <td className="py-1.5 px-3 text-text-muted text-[10px]">
                Session Fastest
              </td>
              <td />
              <td className="py-1.5 px-2 text-center text-purple-300 font-bold">
                {fmtSector(bestS1)}
              </td>
              <td className="py-1.5 px-2 text-center text-purple-300 font-bold">
                {fmtSector(bestS2)}
              </td>
              <td className="py-1.5 px-2 text-center text-purple-300 font-bold">
                {fmtSector(bestS3)}
              </td>
              <td className="py-1.5 px-2 text-center text-purple-300 font-bold">
                {fmtTime(bestLap)}
              </td>
            </tr>
          </thead>
          <tbody>
            {drivers.map((driver, idx) => {
              const code = driver.driver_code ?? driver.full_name;
              const color = driver.team_color
                ? `#${driver.team_color}`
                : "var(--delta-neutral)";
              const d1 =
                driver.best_sector1 != null && bestS1 != null
                  ? driver.best_sector1 - bestS1
                  : null;
              const d2 =
                driver.best_sector2 != null && bestS2 != null
                  ? driver.best_sector2 - bestS2
                  : null;
              const d3 =
                driver.best_sector3 != null && bestS3 != null
                  ? driver.best_sector3 - bestS3
                  : null;
              const dL =
                driver.best_lap_time != null && bestLap != null
                  ? driver.best_lap_time - bestLap
                  : null;

              return (
                <tr
                  key={code}
                  className="border-b border-border-primary/40 last:border-0 hover:bg-bg-primary/20 transition-colors"
                >
                  <td className="py-2 px-2 text-center text-text-muted font-bold">
                    {idx + 1}
                  </td>
                  <td className="py-2 px-3">
                    <span className="font-bold text-xs" style={{ color }}>
                      {code}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-center">
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded-sm ${Q_BADGE[driver.q_session] ?? "text-text-muted"}`}
                    >
                      {driver.q_session}
                    </span>
                  </td>
                  <td
                    className={`py-2 px-1 text-center text-[11px] font-bold rounded-sm mx-0.5 ${deltaColor(d1)}`}
                  >
                    <div className="text-[9px] text-text-muted">
                      {fmtSector(driver.best_sector1)}
                    </div>
                    <div>{deltaLabel(d1)}</div>
                  </td>
                  <td
                    className={`py-2 px-1 text-center text-[11px] font-bold rounded-sm mx-0.5 ${deltaColor(d2)}`}
                  >
                    <div className="text-[9px] text-text-muted">
                      {fmtSector(driver.best_sector2)}
                    </div>
                    <div>{deltaLabel(d2)}</div>
                  </td>
                  <td
                    className={`py-2 px-1 text-center text-[11px] font-bold rounded-sm mx-0.5 ${deltaColor(d3)}`}
                  >
                    <div className="text-[9px] text-text-muted">
                      {fmtSector(driver.best_sector3)}
                    </div>
                    <div>{deltaLabel(d3)}</div>
                  </td>
                  <td
                    className={`py-2 px-1 text-center text-[11px] font-bold rounded-sm mx-0.5 ${deltaColor(dL)}`}
                  >
                    <div className="text-[9px] text-text-muted">
                      {fmtTime(driver.best_lap_time)}
                    </div>
                    <div>
                      {dL != null && dL > 0.001
                        ? `+${dL.toFixed(3)}`
                        : dL != null
                          ? "POLE"
                          : "-"}
                    </div>
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
