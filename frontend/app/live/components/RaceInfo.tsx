"use client";

import type { ReplayWeather } from "@/lib/types";

interface RaceInfoProps {
  currentLap: number;
  totalLaps: number;
  scState: number;
  weather: ReplayWeather | null;
}

const SC_LABELS: Record<number, { text: string; color: string }> = {
  0: { text: "GREEN", color: "text-green-400" },
  1: { text: "SAFETY CAR", color: "text-yellow-400" },
  2: { text: "VSC", color: "text-yellow-300" },
};

export default function RaceInfo({
  currentLap,
  totalLaps,
  scState,
  weather,
}: RaceInfoProps) {
  const sc = SC_LABELS[scState] ?? SC_LABELS[0];

  return (
    <div className="flex items-center gap-4 text-xs font-mono">
      {/* Lap counter */}
      <div className="flex items-center gap-1.5">
        <span className="text-text-muted">LAP</span>
        <span className="text-text-primary font-semibold">
          {currentLap}/{totalLaps}
        </span>
      </div>

      {/* Track status */}
      <span className={`font-bold ${sc.color}`}>{sc.text}</span>

      {/* Weather */}
      {weather && (
        <div className="flex items-center gap-2 text-text-muted">
          <span>{weather.rainfall ? "🌧" : "☀️"}</span>
          <span>{weather.track_temp}°C</span>
        </div>
      )}
    </div>
  );
}
