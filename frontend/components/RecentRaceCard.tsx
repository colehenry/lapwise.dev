"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
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
      <div className="bg-[#1e1e2e] rounded-lg p-8 animate-pulse">
        <div className="h-8 bg-[#2a2a3e] rounded w-3/4 mb-4" />
        <div className="h-4 bg-[#2a2a3e] rounded w-1/2 mb-8" />
        <div className="grid grid-cols-3 gap-4">
          <div className="h-32 bg-[#2a2a3e] rounded" />
          <div className="h-32 bg-[#2a2a3e] rounded" />
          <div className="h-32 bg-[#2a2a3e] rounded" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-[#1e1e2e] rounded-lg p-8">
        <p className="text-red-400">Failed to load latest race results</p>
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
    <div className="bg-gradient-to-br from-[#1e1e2e] to-[#2a2a3e] rounded-lg p-8 hover:from-[#252535] hover:to-[#30303e] transition-all duration-300 shadow-xl hover:shadow-2xl group">
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <Link
              href={`/results/${year}/${data.round}`}
              className="text-3xl font-bold text-white hover:text-[#e10600] transition-colors"
            >
              {data.event_name}
            </Link>
            <p className="text-gray-400 mt-1">{formattedDate}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500 uppercase tracking-wide">
              Latest Result
            </p>
            <p className="text-gray-400">{data.circuit_name}</p>
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
                  ? "text-gray-300"
                  : "text-amber-600";

            return (
              <div
                key={driver.driver_code}
                className="relative bg-[#15151e] rounded-lg p-4 border-2 border-transparent hover:border-white/20 transition-all"
                style={{
                  borderTopColor: driver.team_color
                    ? `#${driver.team_color}`
                    : undefined,
                  borderTopWidth: "4px",
                }}
              >
                {/* Position Badge */}
                <div
                  className={`absolute -top-3 -left-3 w-10 h-10 rounded-full ${positionColor} bg-[#15151e] border-4 border-[#15151e] flex items-center justify-center font-bold text-lg`}
                >
                  {position}
                </div>

                {/* Driver Info */}
                <div className="flex items-center gap-3 mt-2">
                  {driver.headshot_url ? (
                    <img
                      src={driver.headshot_url}
                      alt={driver.full_name}
                      className="w-16 h-16 rounded-full object-cover bg-gray-800"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center text-gray-500 font-bold">
                      {driver.driver_code}
                    </div>
                  )}

                  <div className="flex-1">
                    <Link
                      href={`/drivers/${driver.driver_code}`}
                      className="font-bold text-white text-lg hover:text-[#e10600] transition-colors inline-flex items-center gap-1.5"
                    >
                      {driver.country_code && (
                        <span className="text-base">
                          {getDriverFlagEmoji(driver.country_code)}
                        </span>
                      )}
                      {driver.driver_code}
                    </Link>
                    <p className="text-sm text-gray-400">{driver.team_name}</p>
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
        <div className="text-center pt-4 border-t border-gray-700">
          <Link
            href={`/results/${year}/${data.round}`}
            className="text-gray-400 hover:text-white transition-colors"
          >
            View Full Results →
          </Link>
        </div>
      </div>
    </div>
  );
}
