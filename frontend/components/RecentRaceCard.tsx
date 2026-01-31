"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import Skeleton from "@/components/ui/Skeleton";
import { getDriverFlagEmoji } from "@/lib/flags";

interface PodiumDriver {
  full_name: string;
  driver_code: string;
  country_code: string | null;
  team_name: string;
  team_color: string | null;
  headshot_url: string | null;
  fastest_lap: boolean;
}

interface LatestRaceData {
  round: number;
  event_name: string;
  date: string;
  circuit_name: string;
  session_type: string;
  podium: PodiumDriver[];
}

async function fetchLatestRace(): Promise<LatestRaceData> {
  const apiKey = process.env.NEXT_PUBLIC_API_KEY || "";
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/results/latest`,
    {
      headers: {
        "X-API-Key": apiKey,
      },
    },
  );

  if (!res.ok) {
    throw new Error("Failed to fetch latest race");
  }

  return res.json();
}

export default function RecentRaceCard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["latest-race"],
    queryFn: fetchLatestRace,
  });

  if (isLoading) {
    return (
      <div className="bg-bg-tertiary rounded-lg p-8">
        <Skeleton
          variant="rectangular"
          height="2rem"
          width="75%"
          className="mb-4"
        />
        <Skeleton variant="text" width="50%" className="mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton variant="rectangular" height="8rem" />
          <Skeleton variant="rectangular" height="8rem" />
          <Skeleton variant="rectangular" height="8rem" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-bg-tertiary rounded-lg p-8">
        <p className="text-error">Failed to load latest race results</p>
      </div>
    );
  }

  const year = new Date(data.date).getFullYear();
  const formattedDate = new Date(data.date).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="bg-gradient-to-br from-bg-tertiary to-bg-elevated rounded-lg p-8 hover:from-bg-elevated hover:to-bg-tertiary transition-all duration-300 shadow-xl hover:shadow-2xl group">
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <Link
              href={`/results/${year}/${data.round}`}
              className="text-3xl font-bold text-white hover:text-red-500 transition-colors"
            >
              {data.event_name.replace("Grand Prix", "GP")}
            </Link>
            <p className="text-text-tertiary mt-1">{formattedDate}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-text-muted uppercase tracking-wide">
              Latest Result
            </p>
            <p className="text-text-tertiary">{data.circuit_name}</p>
          </div>
        </div>

        {/* Podium */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {data.podium.map((driver, index) => {
            const position = index + 1;
            const positionColor =
              position === 1
                ? "text-yellow-400"
                : position === 2
                  ? "text-text-secondary"
                  : "text-amber-600";

            return (
              <div
                key={driver.driver_code}
                className="relative bg-bg-primary rounded-lg p-4 border-2 border-transparent hover:border-white/20 transition-all"
                style={{
                  borderTopColor: driver.team_color
                    ? `#${driver.team_color}`
                    : undefined,
                  borderTopWidth: "4px",
                }}
              >
                {/* Position Badge */}
                <div
                  className={`absolute -top-3 -left-3 w-10 h-10 rounded-full ${positionColor} bg-bg-primary border-4 border-bg-primary flex items-center justify-center font-bold text-lg`}
                >
                  {position}
                </div>

                {/* Driver Info */}
                <div className="flex items-center gap-3 mt-2">
                  {driver.headshot_url ? (
                    <img
                      src={driver.headshot_url}
                      alt={driver.full_name}
                      className="w-16 h-16 rounded-full object-cover bg-bg-secondary"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-bg-secondary flex items-center justify-center text-text-muted font-bold">
                      {driver.driver_code}
                    </div>
                  )}

                  <div className="flex-1">
                    <Link
                      href={`/drivers/${driver.driver_code}`}
                      className="font-bold text-white text-lg hover:text-red-500 transition-colors inline-flex items-center gap-1.5"
                    >
                      {driver.country_code && (
                        <span className="text-base">
                          {getDriverFlagEmoji(driver.country_code)}
                        </span>
                      )}
                      {driver.driver_code}
                    </Link>
                    <p className="text-sm text-text-tertiary">
                      {driver.team_name}
                    </p>
                    {driver.fastest_lap && (
                      <p className="text-xs text-purple-400 mt-1 flex items-center gap-1">
                        <svg
                          className="w-3 h-3"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <title>Fastest Lap</title>
                          <path d="M10 2L13 8L19 9L14.5 13.5L15.5 19L10 16L4.5 19L5.5 13.5L1 9L7 8L10 2Z" />
                        </svg>
                        Fastest Lap
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div className="text-center pt-4 border-t border-border-primary">
          <Link
            href={`/results/${year}/${data.round}`}
            className="text-text-tertiary hover:text-white transition-colors"
          >
            View Full Results →
          </Link>
        </div>
      </div>
    </div>
  );
}
