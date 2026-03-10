"use client";

import { useQuery } from "@tanstack/react-query";
import { apiHeaders, apiUrl } from "@/lib/api";
import type { CircuitTyreStatsResponse } from "@/lib/types";

const COMPOUND_COLORS: Record<string, { bar: string; text: string }> = {
  SOFT: { bar: "#ef4444", text: "text-red-400" },
  MEDIUM: { bar: "#eab308", text: "text-yellow-400" },
  HARD: { bar: "#d1d5db", text: "text-text-secondary" },
  INTERMEDIATE: { bar: "#22c55e", text: "text-green-400" },
  WET: { bar: "#3b82f6", text: "text-blue-400" },
};

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
        <div className="h-6 bg-bg-elevated rounded w-40 animate-pulse" />
        <div className="h-48 bg-bg-elevated rounded animate-pulse" />
      </div>
    );
  }

  if (!data || data.compounds.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-text-muted text-sm font-mono">
          Tyre data not available for this circuit.
        </p>
      </div>
    );
  }

  const maxPercent = Math.max(...data.compounds.map((c) => c.percentage));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-text-secondary font-mono">
          Usage by Tyre Compound
        </h3>
        <span className="text-[10px] text-text-muted font-mono uppercase tracking-widest">
          {data.races_with_data} total races
        </span>
      </div>

      <div className="space-y-3">
        {data.compounds.map((compound) => {
          const colors = COMPOUND_COLORS[compound.compound] || {
            bar: "#666",
            text: "text-text-muted",
          };
          const widthPercent =
            maxPercent > 0 ? (compound.percentage / maxPercent) * 100 : 0;

          return (
            <div key={compound.compound}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: colors.bar }}
                  />
                  <span
                    className={`text-xs font-bold font-mono uppercase tracking-widest ${colors.text}`}
                  >
                    {compound.compound}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {compound.avg_stint_length != null && (
                    <span className="text-[10px] text-text-muted font-mono">
                      ~{compound.avg_stint_length} laps/stint
                    </span>
                  )}
                  <span className="text-xs font-bold text-text-primary font-mono w-12 text-right">
                    {compound.percentage}%
                  </span>
                </div>
              </div>
              <div className="h-2 bg-bg-primary rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${widthPercent}%`,
                    backgroundColor: `${colors.bar}88`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Total laps summary */}
      <div className="mt-4 pt-3 border-t border-border-primary flex items-center justify-between">
        <span className="text-[10px] text-text-muted font-mono uppercase tracking-widest">
          Total Laps Analyzed
        </span>
        <span className="text-xs font-bold text-text-tertiary font-mono">
          {data.compounds
            .reduce((sum, c) => sum + c.total_laps, 0)
            .toLocaleString()}
        </span>
      </div>
    </div>
  );
}
