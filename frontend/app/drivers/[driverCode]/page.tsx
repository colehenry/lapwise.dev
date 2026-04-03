"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import DriverResultsTable from "@/components/DriverResultsTable";
import DriverSeasonHistoryGraph from "@/components/DriverSeasonHistoryGraph";
import DriverStatisticsPanel from "@/components/DriverStatisticsPanel";
import PageHeader from "@/components/PageHeader";
import ProfileSkeleton from "@/components/ui/ProfileSkeleton";
import TabBar from "@/components/ui/TabBar";
import { useTabSync } from "@/hooks/useTabSync";
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
  const router = useRouter();
  const driverCode = params.driverCode as string;
  const { activeTab, switchTab } = useTabSync<DriverTab>(
    `/drivers/${driverCode}`,
    "overview",
  );

  const { data, isLoading, error } = useQuery({
    queryKey: ["driver-profile", driverCode],
    queryFn: () => fetchDriverProfile(driverCode),
  });

  if (isLoading) {
    return <ProfileSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-bg-secondary p-8">
        <div className="max-w-5xl mx-auto">
          <div className="bg-bg-tertiary rounded-sm p-8">
            <h1 className="text-2xl font-bold text-text-primary mb-4">
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
      <PageHeader
        title={data.full_name}
        subtitle={`${data.country_code ? getCountryName(data.country_code) : ""}${data.driver_number ? ` • #${data.driver_number}` : ""}${data.current_team ? ` • ${data.current_team}` : ""}`}
        onBack={() => router.push("/drivers")}
        backLabel="DRIVERS"
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
              {/* Driver Photo & Nationality */}
              <div className="flex flex-col items-center gap-6 w-full">
                {data.headshot_url ? (
                  <div className="relative group flex-shrink-0">
                    <div className="absolute -inset-1 bg-gradient-to-b from-purple-500/20 to-transparent rounded-sm blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200" />
                    <div className="relative">
                      <Image
                        src={data.headshot_url}
                        alt={data.full_name}
                        width={240}
                        height={240}
                        className="w-56 h-56 rounded-sm object-cover border border-border-primary bg-bg-tertiary"
                        style={{
                          borderBottomColor: data.current_team_color
                            ? `#${data.current_team_color}`
                            : "transparent",
                          borderBottomWidth: data.current_team_color
                            ? "4px"
                            : "1px",
                        }}
                      />
                      <div className="absolute top-2 right-2 bg-bg-primary/80 backdrop-blur-sm border border-border-primary px-2 py-1 rounded-sm">
                        <span className="text-xl font-mono font-bold text-text-primary leading-none">
                          {data.driver_code}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="w-56 h-56 rounded-sm flex items-center justify-center text-5xl font-bold text-text-tertiary border border-border-primary bg-bg-tertiary">
                    {data.driver_code}
                  </div>
                )}

                {/* Country Info */}
                {data.country_code && (
                  <div className="flex items-center gap-3 bg-bg-tertiary border border-border-primary px-6 py-3 rounded-sm w-fit">
                    <span className="text-3xl">
                      {getDriverFlagEmoji(data.country_code)}
                    </span>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-text-muted uppercase font-bold tracking-widest leading-none mb-1">
                        Nationality
                      </span>
                      <span className="text-lg font-bold text-text-primary leading-none">
                        {getCountryName(data.country_code)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

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
                    <p className="text-text-primary text-2xl font-bold font-mono">
                      {stat.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Career Highlights - Restored to left-aligned */}
            <div className="bg-bg-tertiary rounded-sm p-8 border border-border-primary">
              <h2 className="text-sm font-bold text-text-secondary font-mono mb-6">
                Career Highlights
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
