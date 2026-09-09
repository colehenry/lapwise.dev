"use client";

import { useQuery } from "@tanstack/react-query";
import { CHART_TYPOGRAPHY } from "@/components/charts/chart-primitives";
import { apiHeaders, apiUrl } from "@/lib/api";
import { getCompoundColor } from "@/lib/palette";
import type { CircuitTyreStatsResponse } from "@/lib/types";

interface CircuitTyreStatsProps {
  circuitId: string;
}

export default function CircuitTyreStats({ circuitId }: CircuitTyreStatsProps) {
  const { data, isLoading } = useQuery<CircuitTyreStatsResponse | null>({
    queryKey: ["circuit-tyre-stats", circuitId],
    queryFn: async () => {
      const res = await fetch(apiUrl(`/api/circuits/${circuitId}/tyre-stats`), {
        headers: apiHeaders(),
      });
      if (!res.ok) return null;
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-6 bg-surface-raised rounded w-40 animate-pulse" />
        <div className="h-48 bg-surface-raised rounded animate-pulse" />
      </div>
    );
  }

  if (!data || data.compounds.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-ink-faint text-sm font-mono">
          Tyre data not available for this circuit.
        </p>
      </div>
    );
  }

  const maxPercent = Math.max(...data.compounds.map((c) => c.percentage));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className={CHART_TYPOGRAPHY.titleClassName}>
          Usage by Tyre Compound
        </h3>
        <span className={CHART_TYPOGRAPHY.keyClassName}>
          {data.races_with_data} total races
        </span>
      </div>

      <div className="space-y-3">
        {data.compounds.map((compound) => {
          const color = getCompoundColor(compound.compound);
          const widthPercent =
            maxPercent > 0 ? (compound.percentage / maxPercent) * 100 : 0;

          return (
            <div key={compound.compound}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span
                    className="text-xs font-bold font-mono uppercase tracking-widest"
                    style={{ color }}
                  >
                    {compound.compound}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {compound.avg_stint_length != null && (
                    <span className="text-[10px] text-ink-faint font-mono">
                      ~{compound.avg_stint_length} laps/stint
                    </span>
                  )}
                  <span className="text-xs font-bold text-ink-strong font-mono w-12 text-right">
                    {compound.percentage}%
                  </span>
                </div>
              </div>
              <div className="h-2 bg-surface-page rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${widthPercent}%`,
                    backgroundColor: color,
                    opacity: 0.72,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Total laps summary */}
      <div className="mt-4 pt-3 border-t border-line-soft flex items-center justify-between">
        <span className="text-[10px] text-ink-faint font-mono uppercase tracking-widest">
          Total Laps Analyzed
        </span>
        <span className="text-xs font-bold text-ink-soft font-mono">
          {data.compounds
            .reduce((sum, c) => sum + c.total_laps, 0)
            .toLocaleString()}
        </span>
      </div>
    </div>
  );
}
