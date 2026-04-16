"use client";

import { useQuery } from "@tanstack/react-query";
import Skeleton from "@/components/ui/Skeleton";
import { apiHeaders, apiUrl } from "@/lib/api";
import type { CircuitWeatherProfileResponse } from "@/lib/types";

interface CircuitWeatherProfileProps {
  circuitId: string;
}

export default function CircuitWeatherProfile({
  circuitId,
}: CircuitWeatherProfileProps) {
  const { data, isLoading } = useQuery<CircuitWeatherProfileResponse | null>({
    queryKey: ["circuit-weather-profile", circuitId],
    queryFn: async () => {
      const res = await fetch(
        apiUrl(`/api/circuits/${circuitId}/weather-profile`),
        { headers: apiHeaders() },
      );
      if (!res.ok) return null;
      return res.json();
    },
  });

  if (isLoading) {
    return <Skeleton variant="rectangular" height="120px" />;
  }

  if (!data || data.races_with_weather === 0) return null;

  const wetPercent =
    data.total_races_checked > 0
      ? Math.round((data.wet_race_count / data.total_races_checked) * 100)
      : 0;

  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        {data.avg_air_temp != null && (
          <div>
            <div className="text-[10px] text-text-muted font-mono uppercase tracking-widest mb-0.5">
              Avg Air
            </div>
            <div className="text-lg font-bold text-orange-400 font-mono">
              {data.avg_air_temp}°C
            </div>
          </div>
        )}
        {data.avg_track_temp != null && (
          <div>
            <div className="text-[10px] text-text-muted font-mono uppercase tracking-widest mb-0.5">
              Avg Track
            </div>
            <div className="text-lg font-bold text-red-400 font-mono">
              {data.avg_track_temp}°C
            </div>
          </div>
        )}
        {data.avg_humidity != null && (
          <div>
            <div className="text-[10px] text-text-muted font-mono uppercase tracking-widest mb-0.5">
              Humidity
            </div>
            <div className="text-lg font-bold text-blue-400 font-mono">
              {data.avg_humidity}%
            </div>
          </div>
        )}
        {data.avg_wind_speed != null && (
          <div>
            <div className="text-[10px] text-text-muted font-mono uppercase tracking-widest mb-0.5">
              Wind
            </div>
            <div className="text-lg font-bold text-text-secondary font-mono">
              {data.avg_wind_speed} m/s
            </div>
          </div>
        )}
      </div>

      {/* Wet race indicator */}
      <div className="mt-3 pt-3 border-t border-border-primary">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-text-muted font-mono uppercase tracking-widest">
            Rain Probability
          </span>
          <span
            className={`text-sm font-bold font-mono ${
              wetPercent > 30 ? "text-blue-400" : "text-text-tertiary"
            }`}
          >
            {wetPercent}%
          </span>
        </div>
        <div className="mt-1.5 h-1.5 bg-bg-primary rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${wetPercent}%`,
              backgroundColor: wetPercent > 30 ? "#3b82f6" : "#666",
            }}
          />
        </div>
        <div className="text-[10px] text-text-muted mt-1">
          {data.wet_race_count} wet out of {data.total_races_checked} total
          races
        </div>
      </div>
    </div>
  );
}
