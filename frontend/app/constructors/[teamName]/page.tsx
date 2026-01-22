"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import ConstructorSeasonHistoryGraph from "@/components/ConstructorSeasonHistoryGraph";

interface ConstructorProfile {
  team_name: string;
  team_color: string | null;
  total_seasons: number;
  total_races: number;
  total_championships: number;
  total_wins: number;
  total_podiums: number;
  total_points: number;
  best_finish: number | null;
  latest_season: number | null;
}

async function fetchConstructorProfile(
  teamName: string,
): Promise<ConstructorProfile> {
  const apiKey = process.env.NEXT_PUBLIC_API_KEY || "";
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/constructors/${teamName}`,
    {
      headers: {
        "X-API-Key": apiKey,
      },
    },
  );

  if (!res.ok) {
    throw new Error("Failed to fetch constructor profile");
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

export default function ConstructorProfilePage() {
  const params = useParams();
  const teamName = params.teamName as string;

  const { data, isLoading, error } = useQuery({
    queryKey: ["constructor-profile", teamName],
    queryFn: () => fetchConstructorProfile(teamName),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#15151e] p-8">
        <div className="max-w-5xl mx-auto">
          <div className="animate-pulse space-y-8">
            <div className="h-12 bg-[#2a2a3e] rounded w-1/3" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: Static loading skeleton items
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
              Constructor Not Found
            </h1>
            <p className="text-gray-400 mb-6">
              Could not find constructor: {teamName.replace(/-/g, " ")}
            </p>
            <Link
              href="/constructors"
              className="text-[#e10600] hover:text-[#ff0800] transition-colors"
            >
              ← Back to Constructors
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
            href="/constructors"
            className="text-gray-400 hover:text-white transition-colors mb-4 inline-block"
          >
            ← Back
          </Link>

          <div className="flex items-center gap-6 mb-4">
            {/* Team Color Badge */}
            <div
              className="w-32 h-32 rounded-full border-4 flex items-center justify-center"
              style={{
                backgroundColor: data.team_color
                  ? `#${data.team_color}`
                  : "#888",
                borderColor: data.team_color ? `#${data.team_color}` : "#888",
              }}
            >
              <span className="text-white font-bold text-2xl text-center px-4">
                {data.team_name
                  .split(" ")
                  .map((word) => word[0])
                  .join("")}
              </span>
            </div>

            <div>
              <h1 className="text-5xl font-bold text-white mb-2">
                {data.team_name}
              </h1>
              <div className="flex items-center gap-4 text-gray-400 text-lg">
                {data.latest_season && (
                  <span>Active in {data.latest_season}</span>
                )}
                {data.best_finish && (
                  <>
                    <span>•</span>
                    <span>
                      Best Finish: {getOrdinalSuffix(data.best_finish)}
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

        {/* Team Highlights */}
        <div className="bg-gradient-to-br from-[#1e1e2e] to-[#2a2a3e] rounded-lg p-8 border border-gray-800">
          <h2 className="text-2xl font-bold text-white mb-6">
            Team Highlights
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
          <ConstructorSeasonHistoryGraph teamName={teamName} />
        </div>
      </div>
    </div>
  );
}
