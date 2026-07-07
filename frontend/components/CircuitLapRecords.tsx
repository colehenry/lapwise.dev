"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useTheme } from "@/components/ThemeProvider";
import Skeleton from "@/components/ui/Skeleton";
import { apiHeaders, apiUrl } from "@/lib/api";
import { resolveReadableAccentColor } from "@/lib/color-utils";
import { constructorHref, driverHref } from "@/lib/entityLinks";
import type { CircuitLapRecordsResponse, LapRecordEntry } from "@/lib/types";

function formatLapTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toFixed(3).padStart(6, "0")}`;
}

function RecordRow({
  record,
  label,
  theme,
}: {
  record: LapRecordEntry;
  label: string;
  theme: "dark" | "light";
}) {
  const teamColor =
    resolveReadableAccentColor(
      record.team_color ? `#${record.team_color}` : "var(--purple-500)",
      theme,
      "var(--delta-neutral)",
    ) ?? "var(--delta-neutral)";
  const driverUrl = driverHref({
    driver_slug: record.driver_slug,
    driver_code: record.driver_code,
    full_name: record.driver_name,
  });

  return (
    <div>
      <div className="text-xs text-text-muted uppercase tracking-wider mb-2 font-mono font-bold">
        {label}
      </div>
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-2xl font-bold text-text-primary font-mono">
          {formatLapTime(record.time_seconds)}
        </span>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <span
          className="w-2 h-2 rounded-full inline-block shrink-0"
          style={{ backgroundColor: teamColor }}
        />
        {driverUrl ? (
          <Link
            href={driverUrl}
            className="text-text-secondary hover:text-purple-300 transition-colors"
          >
            {record.driver_name}
          </Link>
        ) : (
          <span className="text-text-secondary">{record.driver_name}</span>
        )}
        <span className="text-text-muted">({record.year})</span>
      </div>
      <Link
        href={constructorHref(record.team_name) ?? "/constructors"}
        className="mt-0.5 inline-flex text-xs text-text-muted hover:text-purple-300 transition-colors"
      >
        {record.team_name}
      </Link>
    </div>
  );
}

interface CircuitLapRecordsProps {
  circuitId: string;
}

export default function CircuitLapRecords({
  circuitId,
}: CircuitLapRecordsProps) {
  const { theme } = useTheme();
  const { data, isLoading } = useQuery<CircuitLapRecordsResponse | null>({
    queryKey: ["circuit-lap-records", circuitId],
    queryFn: async () => {
      const res = await fetch(
        apiUrl(`/api/circuits/${circuitId}/lap-records`),
        {
          headers: apiHeaders(),
        },
      );
      if (!res.ok) return null;
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton variant="rectangular" height="80px" />
        <Skeleton variant="rectangular" height="80px" />
      </div>
    );
  }

  if (!data || (!data.fastest_race_lap && !data.fastest_qualifying_lap)) {
    return null;
  }

  return (
    <div className="space-y-6">
      {data.fastest_race_lap && (
        <RecordRow
          record={data.fastest_race_lap}
          label="Fastest Race Lap"
          theme={theme}
        />
      )}
      {data.fastest_qualifying_lap && (
        <RecordRow
          record={data.fastest_qualifying_lap}
          label="Qualifying Record"
          theme={theme}
        />
      )}
    </div>
  );
}
