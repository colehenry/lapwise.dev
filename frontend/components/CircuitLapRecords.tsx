"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import Skeleton from "@/components/ui/Skeleton";
import { apiHeaders, apiUrl } from "@/lib/api";
import type { CircuitLapRecordsResponse, LapRecordEntry } from "@/lib/types";

function formatLapTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toFixed(3).padStart(6, "0")}`;
}

function RecordRow({
  record,
  label,
}: {
  record: LapRecordEntry;
  label: string;
}) {
  const teamColor = record.team_color ? `#${record.team_color}` : "#a020f0";

  return (
    <div>
      <div className="text-xs text-text-muted uppercase tracking-wider mb-2 font-mono font-bold">
        {label}
      </div>
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-2xl font-bold text-white font-mono">
          {formatLapTime(record.time_seconds)}
        </span>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <span
          className="w-2 h-2 rounded-full inline-block shrink-0"
          style={{ backgroundColor: teamColor }}
        />
        {record.driver_slug ? (
          <Link
            href={`/drivers/${record.driver_slug}`}
            className="text-text-secondary hover:text-purple-300 transition-colors"
          >
            {record.driver_name}
          </Link>
        ) : (
          <span className="text-text-secondary">{record.driver_name}</span>
        )}
        <span className="text-text-muted">({record.year})</span>
      </div>
      <div className="text-xs text-text-muted mt-0.5">{record.team_name}</div>
    </div>
  );
}

interface CircuitLapRecordsProps {
  circuitId: string;
}

export default function CircuitLapRecords({
  circuitId,
}: CircuitLapRecordsProps) {
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
        <RecordRow record={data.fastest_race_lap} label="Fastest Race Lap" />
      )}
      {data.fastest_qualifying_lap && (
        <RecordRow
          record={data.fastest_qualifying_lap}
          label="Qualifying Record"
        />
      )}
    </div>
  );
}
