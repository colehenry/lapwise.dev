"use client";

import type { ReplayWeather } from "@/lib/types";

interface RaceInfoProps {
  currentLap: number;
  totalLaps: number;
  scState: number;
  weather: ReplayWeather | null;
}

const SC_LABELS: Record<
  number,
  { text: string; color: string; border: string }
> = {
  0: { text: "GREEN", color: "text-green-400", border: "border-green-500/30" },
  1: {
    text: "SAFETY CAR",
    color: "text-yellow-400",
    border: "border-yellow-500/30",
  },
  2: { text: "VSC", color: "text-yellow-300", border: "border-yellow-500/30" },
  3: { text: "RED FLAG", color: "text-red-400", border: "border-red-500/30" },
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
        className={`px-2.5 py-1 rounded-sm border font-bold text-[10px] tracking-widest ${sc.border} ${sc.color}`}
      >
        {sc.text}
      </div>

      {/* Weather */}
      {weather && (
        <div className="hidden sm:flex items-center gap-2 text-text-muted">
          <span>{weather.rainfall ? "\u{1F327}" : "\u2600\uFE0F"}</span>
          <span className="text-[10px]">{weather.track_temp}°C</span>
          <span
            className="text-[10px] text-text-muted/60"
            title="Air temperature"
          >
            Air {weather.air_temp}°C
          </span>
          <span className="text-[10px] text-text-muted/60" title="Humidity">
            {weather.humidity}%
          </span>
          {weather.wind_speed > 0 && (
            <span className="text-[10px] text-text-muted/60" title="Wind speed">
              {weather.wind_speed} km/h
            </span>
          )}
        </div>
      )}
    </div>
  );
}
