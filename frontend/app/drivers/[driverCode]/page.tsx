"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import DriverResultsTable from "@/components/DriverResultsTable";
import DriverSeasonHistoryGraph from "@/components/DriverSeasonHistoryGraph";
import DriverStatisticsPanel from "@/components/DriverStatisticsPanel";
import Skeleton from "@/components/ui/Skeleton";
import TabBar from "@/components/ui/TabBar";
import { apiHeaders, apiUrl } from "@/lib/api";
import { getCountryName, getDriverFlagEmoji } from "@/lib/flags";
import type { DriverProfile } from "@/lib/types";

type DriverTab = "overview" | "results" | "statistics";

const TABS: { key: DriverTab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "results", label: "Results" },
  { key: "statistics", label: "Statistics" },
];

async function fetchDriverProfile(driverCode: string): Promise<DriverProfile> {
  const res = await fetch(apiUrl(`/api/drivers/${driverCode}`), {
    headers: apiHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch driver profile");
  return res.json();
}

export default function DriverProfilePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const driverCode = params.driverCode as string;

  const urlTab = searchParams.get("tab") as DriverTab | null;
  const [activeTab, setActiveTab] = useState<DriverTab>(urlTab || "overview");

  useEffect(() => {
    if (urlTab) setActiveTab(urlTab);
  }, [urlTab]);

  const switchTab = (tab: DriverTab) => {
    setActiveTab(tab);
    const url =
      tab === "overview"
        ? `/drivers/${driverCode}`
        : `/drivers/${driverCode}?tab=${tab}`;
    router.replace(url, { scroll: false });
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ["driver-profile", driverCode],
    queryFn: () => fetchDriverProfile(driverCode),
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
              Driver Not Found
            </h1>
            <p className="text-text-tertiary mb-6">
              Could not find driver with code: {driverCode.toUpperCase()}
            </p>
            <Link
              href="/drivers"
              className="text-red-500 hover:text-red-400 transition-colors"
            >
              &larr; Back to Drivers
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
              href="/drivers"
              className="bg-bg-primary border border-border-primary text-text-primary font-mono text-xs font-bold px-4 py-2 rounded-sm hover:border-purple-500 hover:text-purple-300 transition-colors duration-150 flex items-center gap-2"
            >
              <span>&larr;</span>
              <span className="hidden sm:inline">DRIVERS</span>
            </Link>
            {data.headshot_url ? (
              <Image
                src={data.headshot_url}
                alt={data.full_name}
                width={36}
                height={36}
                className="w-9 h-9 rounded-full object-cover border-2"
                style={{
                  borderColor: data.current_team_color
                    ? `#${data.current_team_color}`
                    : "#888",
                }}
              />
            ) : (
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-text-tertiary border-2 bg-bg-tertiary"
                style={{
                  borderColor: data.current_team_color
                    ? `#${data.current_team_color}`
                    : "#888",
                }}
              >
                {data.driver_code}
              </div>
            )}
            <div className="flex flex-col">
              <span className="text-text-primary font-mono text-sm font-bold leading-none">
                {data.driver_code}
              </span>
              <span className="text-text-muted text-[10px] tracking-widest uppercase font-bold hidden sm:inline">
                {data.full_name}
              </span>
            </div>
          </div>

          <TabBar tabs={TABS} activeTab={activeTab} onTabChange={switchTab} />
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        {activeTab === "overview" && (
          <div className="space-y-8">
            {/* Full Header (only on overview) */}
            <div className="flex items-center gap-6">
              {data.headshot_url ? (
                <Image
                  src={data.headshot_url}
                  alt={data.full_name}
                  width={128}
                  height={128}
                  className="w-32 h-32 rounded-full object-cover border-4"
                  style={{
                    borderColor: data.current_team_color
                      ? `#${data.current_team_color}`
                      : "#888",
                  }}
                />
              ) : (
                <div
                  className="w-32 h-32 rounded-full flex items-center justify-center text-4xl font-bold text-text-tertiary border-4 bg-bg-tertiary"
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
                <div className="flex items-center gap-4 text-text-tertiary text-lg">
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
                      <Link
                        href={`/constructors/${data.current_team.replace(/\s+/g, "-")}`}
                        className="hover:text-purple-300 transition-colors"
                      >
                        {data.current_team}
                      </Link>
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

            {/* Career Highlights */}
            <div className="bg-gradient-to-br from-bg-tertiary to-bg-elevated rounded-lg p-8 border border-border-primary">
              <h2 className="text-2xl font-bold text-white mb-6">
                Career Highlights
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
            <DriverSeasonHistoryGraph driverCode={driverCode} />
          </div>
        )}

        {activeTab === "results" && (
          <DriverResultsTable driverCode={driverCode} />
        )}

        {activeTab === "statistics" && (
          <DriverStatisticsPanel driverCode={driverCode} />
        )}
      </div>
    </div>
  );
}
