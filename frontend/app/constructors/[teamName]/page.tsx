"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import ConstructorResultsTable from "@/components/ConstructorResultsTable";
import ConstructorSeasonHistoryGraph from "@/components/ConstructorSeasonHistoryGraph";
import ConstructorStatisticsPanel from "@/components/ConstructorStatisticsPanel";
import PageHeader from "@/components/PageHeader";
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
            <h1 className="text-2xl font-bold text-text-primary mb-4">
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
      <PageHeader
        title={data.team_name}
        subtitle={`${data.latest_season ? `Active in ${data.latest_season}` : ""}${data.best_finish ? ` • Best Finish: ${getOrdinalSuffix(data.best_finish)}` : ""}`}
        onBack={() => router.push("/constructors")}
        backLabel="CONSTRUCTORS"
        bottomContent={
          <div className="flex justify-center">
            <TabBar tabs={TABS} activeTab={activeTab} onTabChange={switchTab} />
          </div>
        }
      />

      {/* Tab Content */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        {activeTab === "overview" && (
          <div className="space-y-8">
            {/* Header section - Centered */}
            <div className="flex flex-col items-center gap-8">
              {/* Constructor Logo */}
              {data.logo_url ? (
                <div className="relative group flex-shrink-0">
                  <div className="absolute -inset-1 bg-gradient-to-b from-purple-500/20 to-transparent rounded-sm blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200" />
                  <div
                    className="relative w-56 h-56 rounded-sm overflow-hidden border border-border-primary bg-bg-tertiary flex items-center justify-center p-8"
                    style={{
                      borderBottomColor: data.team_color
                        ? `#${data.team_color}`
                        : "transparent",
                      borderBottomWidth: data.team_color ? "4px" : "1px",
                    }}
                  >
                    <Image
                      src={data.logo_url}
                      alt={data.team_name}
                      width={180}
                      height={180}
                      className="w-full h-full object-contain"
                      unoptimized={data.logo_url.includes("wikimedia.org")}
                    />
                  </div>
                </div>
              ) : (
                <div
                  className="w-56 h-56 rounded-sm flex items-center justify-center border border-border-primary bg-bg-tertiary"
                  style={{
                    borderBottomColor: data.team_color
                      ? `#${data.team_color}`
                      : "transparent",
                    borderBottomWidth: data.team_color ? "4px" : "1px",
                  }}
                >
                  <span className="text-text-primary font-bold text-5xl text-center px-4">
                    {data.team_name
                      .split(" ")
                      .map((word) => word[0])
                      .join("")}
                  </span>
                </div>
              )}

              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 w-full">
                {stats.map((stat) => (
                  <div
                    key={stat.label}
                    className="bg-bg-tertiary rounded-sm border border-border-primary p-4 flex flex-col items-center text-center"
                  >
                    <p className="text-text-muted text-[10px] uppercase font-bold tracking-wider mb-1">
                      {stat.label}
                    </p>
                    <p className="text-text-primary text-2xl font-bold font-mono tabular-nums">
                      {stat.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Team Highlights - Restored to left-aligned */}
            <div className="bg-bg-tertiary rounded-sm border border-border-primary p-8">
              <h2 className="text-sm font-bold text-text-secondary font-mono mb-6">
                Constructor Highlights
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-text-muted text-sm mb-2">Win Rate</p>
                  <p className="text-text-primary text-2xl font-bold">
                    {data.total_races > 0
                      ? `${((data.total_wins / data.total_races) * 100).toFixed(1)}%`
                      : "0%"}
                  </p>
                </div>
                <div>
                  <p className="text-text-muted text-sm mb-2">Podium Rate</p>
                  <p className="text-text-primary text-2xl font-bold">
                    {data.total_races > 0
                      ? `${((data.total_podiums / data.total_races) * 100).toFixed(1)}%`
                      : "0%"}
                  </p>
                </div>
                <div>
                  <p className="text-text-muted text-sm mb-2">
                    Points per Race
                  </p>
                  <p className="text-text-primary text-2xl font-bold">
                    {data.total_races > 0
                      ? (data.total_points / data.total_races).toFixed(2)
                      : "0"}
                  </p>
                </div>
              </div>
            </div>

            {/* Championship History Graph - Restored */}
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
