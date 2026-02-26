"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import ConstructorResultsTable from "@/components/ConstructorResultsTable";
import ConstructorSeasonHistoryGraph from "@/components/ConstructorSeasonHistoryGraph";
import ConstructorStatisticsPanel from "@/components/ConstructorStatisticsPanel";
import Skeleton from "@/components/ui/Skeleton";
import TabBar from "@/components/ui/TabBar";
import { apiHeaders, apiUrl } from "@/lib/api";
import type { ConstructorProfile } from "@/lib/types";

type ConstructorTab = "overview" | "results" | "statistics";

const TABS: { key: ConstructorTab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "results", label: "Results" },
  { key: "statistics", label: "Statistics" },
];

function getOrdinalSuffix(position: number): string {
  const j = position % 10;
  const k = position % 100;
  if (j === 1 && k !== 11) return `${position}st`;
  if (j === 2 && k !== 12) return `${position}nd`;
  if (j === 3 && k !== 13) return `${position}rd`;
  return `${position}th`;
}

async function fetchConstructorProfile(
  teamName: string,
): Promise<ConstructorProfile> {
  const res = await fetch(apiUrl(`/api/constructors/${teamName}`), {
    headers: apiHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch constructor profile");
  return res.json();
}

export default function ConstructorProfilePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const teamName = params.teamName as string;

  const urlTab = searchParams.get("tab") as ConstructorTab | null;
  const [activeTab, setActiveTab] = useState<ConstructorTab>(
    urlTab || "overview",
  );

  useEffect(() => {
    if (urlTab) setActiveTab(urlTab);
  }, [urlTab]);

  const switchTab = (tab: ConstructorTab) => {
    setActiveTab(tab);
    const url =
      tab === "overview"
        ? `/constructors/${teamName}`
        : `/constructors/${teamName}?tab=${tab}`;
    router.replace(url, { scroll: false });
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ["constructor-profile", teamName],
    queryFn: () => fetchConstructorProfile(teamName),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg-secondary p-8">
        <div className="max-w-5xl mx-auto space-y-6">
          <Skeleton variant="text" width="120px" />
          <div className="flex items-center gap-6">
            <Skeleton variant="circular" width="128px" height="128px" />
            <div className="space-y-3 flex-1">
              <Skeleton variant="text" width="300px" height="40px" />
              <Skeleton variant="text" width="200px" />
            </div>
          </div>
          <Skeleton variant="rectangular" height="40px" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton
                key={`skel-${
                  // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
                  i
                }`}
                variant="rectangular"
                height="100px"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-bg-secondary p-8">
        <div className="max-w-5xl mx-auto">
          <div className="bg-bg-tertiary rounded-lg p-8">
            <h1 className="text-2xl font-bold text-white mb-4">
              Constructor Not Found
            </h1>
            <p className="text-text-tertiary mb-6">
              Could not find constructor: {teamName.replace(/-/g, " ")}
            </p>
            <Link
              href="/constructors"
              className="text-red-500 hover:text-red-400 transition-colors"
            >
              &larr; Back to Constructors
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
    <div className="min-h-screen bg-bg-secondary">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-bg-secondary border-b border-border-primary">
        <div className="max-w-5xl mx-auto px-6">
          <div className="h-16 flex items-center gap-4">
            <Link
              href="/constructors"
              className="bg-bg-primary border border-border-primary text-text-primary font-mono text-xs font-bold px-4 py-2 rounded-sm hover:border-purple-500 hover:text-purple-300 transition-colors duration-150 flex items-center gap-2"
            >
              <span>&larr;</span>
              <span className="hidden sm:inline">CONSTRUCTORS</span>
            </Link>
            
            {data.logo_url ? (
              <div
                className="w-9 h-9 rounded-full overflow-hidden border-2 bg-bg-secondary"
                style={{
                  borderColor: data.team_color ? `#${data.team_color}` : "#888",
                }}
              >
                <Image
                  src={data.logo_url}
                  alt={data.team_name}
                  width={36}
                  height={36}
                  className="w-full h-full object-contain p-1"
                  unoptimized={data.logo_url.includes("wikimedia.org")}
                />
              </div>
            ) : (
              <div
                className="w-9 h-9 rounded-full border-2 flex items-center justify-center"
                style={{
                  backgroundColor: data.team_color
                    ? `#${data.team_color}`
                    : "#888",
                  borderColor: data.team_color ? `#${data.team_color}` : "#888",
                }}
              >
                <span className="text-white font-bold text-[10px]">
                  {data.team_name
                    .split(" ")
                    .map((w) => w[0])
                    .join("")}
                </span>
              </div>
            )}

            <div className="flex flex-col">
              <span className="text-text-primary font-mono text-sm font-bold leading-none">
                {data.team_name}
              </span>
              {data.latest_season && (
                <span className="text-text-muted text-[10px] tracking-widest uppercase font-bold hidden sm:inline">
                  Active in {data.latest_season}
                </span>
              )}
            </div>
          </div>

          <TabBar tabs={TABS} activeTab={activeTab} onTabChange={switchTab} />
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        {activeTab === "overview" && (
          <div className="space-y-8">
            {/* Full Header */}
            <div className="flex items-center gap-6">
              {data.logo_url ? (
                <div
                  className="w-32 h-32 rounded-full overflow-hidden border-4 bg-bg-secondary shadow-lg"
                  style={{
                    borderColor: data.team_color
                      ? `#${data.team_color}`
                      : "#888",
                  }}
                >
                  <Image
                    src={data.logo_url}
                    alt={data.team_name}
                    width={128}
                    height={128}
                    className="w-full h-full object-contain p-4"
                    unoptimized={data.logo_url.includes("wikimedia.org")}
                  />
                </div>
              ) : (
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
              )}
              <div>
                <h1 className="text-5xl font-bold text-white mb-2">
                  {data.team_name}
                </h1>
                <div className="flex items-center gap-4 text-text-tertiary text-lg">
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

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="bg-gradient-to-br from-bg-tertiary to-bg-elevated rounded-lg p-6 border border-border-primary"
                >
                  <p className="text-text-muted text-sm mb-2">{stat.label}</p>
                  <p className="text-white text-3xl font-bold">{stat.value}</p>
                </div>
              ))}
            </div>

            {/* Team Highlights */}
            <div className="bg-gradient-to-br from-bg-tertiary to-bg-elevated rounded-lg p-8 border border-border-primary">
              <h2 className="text-2xl font-bold text-white mb-6">
                Constructor Highlights
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-text-muted text-sm mb-2">Win Rate</p>
                  <p className="text-white text-2xl font-bold">
                    {data.total_races > 0
                      ? `${((data.total_wins / data.total_races) * 100).toFixed(1)}%`
                      : "0%"}
                  </p>
                </div>
                <div>
                  <p className="text-text-muted text-sm mb-2">Podium Rate</p>
                  <p className="text-white text-2xl font-bold">
                    {data.total_races > 0
                      ? `${((data.total_podiums / data.total_races) * 100).toFixed(1)}%`
                      : "0%"}
                  </p>
                </div>
                <div>
                  <p className="text-text-muted text-sm mb-2">
                    Points per Race
                  </p>
                  <p className="text-white text-2xl font-bold">
                    {data.total_races > 0
                      ? (data.total_points / data.total_races).toFixed(2)
                      : "0"}
                  </p>
                </div>
              </div>
            </div>

            {/* Championship History Graph */}
            <ConstructorSeasonHistoryGraph teamName={teamName} />
          </div>
        )}

        {activeTab === "results" && (
          <ConstructorResultsTable teamName={teamName} />
        )}

        {activeTab === "statistics" && (
          <ConstructorStatisticsPanel teamName={teamName} />
        )}
      </div>
    </div>
  );
}
