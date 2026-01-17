"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import DriverSeasonHistoryGraph from "@/components/DriverSeasonHistoryGraph";
import { getCountryName, getDriverFlagEmoji } from "@/lib/flags";

interface DriverProfile {
  driver_code: string;
  full_name: string;
  driver_number: number | null;
  country_code: string | null;
  headshot_url: string | null;
  total_seasons: number;
  total_races: number;
  total_championships: number;
  total_wins: number;
  total_podiums: number;
  total_points: number;
  best_finish: number | null;
  current_team: string | null;
  current_team_color: string | null;
  latest_season: number | null;
}

async function fetchDriverProfile(driverCode: string): Promise<DriverProfile> {
  const apiKey = process.env.NEXT_PUBLIC_API_KEY || "";
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/drivers/${driverCode}`,
    {
      headers: {
        "X-API-Key": apiKey,
      },
    },
  );

  if (!res.ok) {
    throw new Error("Failed to fetch driver profile");
  }

  return res.json();
}

function getOrdinalSuffix(position: number): string {
  const j = position % 10;
  const k = position % 100;
  if (j === 1 && k !== 11) {
    return `${position}st`;
  }
  if (j === 2 && k !== 12) {
    return `${position}nd`;
  }
  if (j === 3 && k !== 13) {
    return `${position}rd`;
  }
  return `${position}th`;
}

export default function DriverProfilePage() {
  const params = useParams();
  const driverCode = params.driverCode as string;

  const { data, isLoading, error } = useQuery({
    queryKey: ["driver-profile", driverCode],
    queryFn: () => fetchDriverProfile(driverCode),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#15151e] p-8">
        <div className="max-w-5xl mx-auto">
          <div className="animate-pulse space-y-8">
            <div className="h-12 bg-[#2a2a3e] rounded w-1/3" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-32 bg-[#2a2a3e] rounded" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#15151e] p-8">
        <div className="max-w-5xl mx-auto">
          <div className="bg-[#1e1e2e] rounded-lg p-8">
            <h1 className="text-2xl font-bold text-white mb-4">
              Driver Not Found
            </h1>
            <p className="text-gray-400 mb-6">
              Could not find driver with code: {driverCode.toUpperCase()}
            </p>
            <Link
              href="/"
              className="text-[#e10600] hover:text-[#ff0800] transition-colors"
            >
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const stats = [
    { label: "Seasons", value: data.total_seasons },
    { label: "Races", value: data.total_races },
    { label: "Championships", value: data.total_championships || 0 },
    { label: "Wins", value: data.total_wins },
    { label: "Podiums", value: data.total_podiums },
    { label: "Total Points", value: Math.round(data.total_points) },
  ];

  return (
    <div className="min-h-screen bg-[#15151e] p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/"
            className="text-gray-400 hover:text-white transition-colors mb-4 inline-block"
          >
            ← Back
          </Link>

          <div className="flex items-center gap-6 mb-4">
            {data.headshot_url && (
              <img
                src={data.headshot_url}
                alt={data.full_name}
                className="w-32 h-32 rounded-full object-cover border-4"
                style={{
                  borderColor: data.current_team_color
                    ? `#${data.current_team_color}`
                    : "#888",
                }}
              />
            )}
            {!data.headshot_url && (
              <div
                className="w-32 h-32 rounded-full flex items-center justify-center text-4xl font-bold text-gray-400 border-4 bg-[#1e1e2e]"
                style={{
                  borderColor: data.current_team_color
                    ? `#${data.current_team_color}`
                    : "#888",
                }}
              >
                {data.driver_code}
              </div>
            )}
            <div>
              <h1 className="text-5xl font-bold text-white mb-2">
                {data.full_name}
              </h1>
              <div className="flex items-center gap-4 text-gray-400 text-lg">
                <span className="text-2xl font-mono">{data.driver_code}</span>
                {data.driver_number && (
                  <>
                    <span>•</span>
                    <span>#{data.driver_number}</span>
                  </>
                )}
                {data.current_team && (
                  <>
                    <span>•</span>
                    <span>{data.current_team}</span>
                  </>
                )}
                {data.country_code && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1.5">
                      <span className="text-xl">
                        {getDriverFlagEmoji(data.country_code)}
                      </span>
                      {getCountryName(data.country_code)}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="bg-gradient-to-br from-[#1e1e2e] to-[#2a2a3e] rounded-lg p-6 border border-gray-800"
            >
              <p className="text-gray-500 text-sm mb-2">{stat.label}</p>
              <p className="text-white text-3xl font-bold">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Career Highlights */}
        <div className="bg-gradient-to-br from-[#1e1e2e] to-[#2a2a3e] rounded-lg p-8 border border-gray-800">
          <h2 className="text-2xl font-bold text-white mb-6">
            Career Highlights
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-gray-500 text-sm mb-2">Win Rate</p>
              <p className="text-white text-2xl font-bold">
                {data.total_races > 0
                  ? `${((data.total_wins / data.total_races) * 100).toFixed(1)}%`
                  : "0%"}
              </p>
            </div>
            <div>
              <p className="text-gray-500 text-sm mb-2">Podium Rate</p>
              <p className="text-white text-2xl font-bold">
                {data.total_races > 0
                  ? `${((data.total_podiums / data.total_races) * 100).toFixed(1)}%`
                  : "0%"}
              </p>
            </div>
            <div>
              <p className="text-gray-500 text-sm mb-2">Points per Race</p>
              <p className="text-white text-2xl font-bold">
                {data.total_races > 0
                  ? (data.total_points / data.total_races).toFixed(2)
                  : "0"}
              </p>
            </div>
          </div>
        </div>

        {/* Championship History Graph */}
        <div className="mt-8">
          <DriverSeasonHistoryGraph driverCode={driverCode} />
        </div>
      </div>
    </div>
  );
}
