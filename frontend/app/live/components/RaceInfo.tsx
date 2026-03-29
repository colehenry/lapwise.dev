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
    <div className="flex items-center gap-3 text-xs font-mono">
      {/* Lap counter */}
      <div className="bg-bg-primary border border-border-primary rounded-sm px-2.5 py-1 flex items-center gap-1.5">
        <span className="text-text-muted text-[10px] tracking-widest font-bold">
          LAP
        </span>
        <span className="text-text-primary font-semibold">
          {currentLap}/{totalLaps}
        </span>
      </div>

      {/* Track status */}
      <div
        className={`px-2.5 py-1 rounded-sm border font-bold text-[10px] tracking-widest ${
          scState === 0
            ? "border-green-500/30 text-green-400"
            : "border-yellow-500/30 text-yellow-400"
        }`}
      >
        {sc.text}
      </div>

      {/* Weather */}
      {weather && (
        <div className="hidden sm:flex items-center gap-1.5 text-text-muted">
          <span>{weather.rainfall ? "🌧" : "☀️"}</span>
          <span className="text-[10px]">{weather.track_temp}°C</span>
        </div>
      )}
    </div>
  );
}
