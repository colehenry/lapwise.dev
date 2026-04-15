"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import ArchiveDataHeader from "@/components/archive/ArchiveDataHeader";
import ArchiveMetricBar from "@/components/archive/ArchiveMetricBar";
import ArchivePanel from "@/components/archive/ArchivePanel";
import DriverResultsTable from "@/components/DriverResultsTable";
import DriverSeasonHistoryGraph from "@/components/DriverSeasonHistoryGraph";
import DriverStatisticsPanel from "@/components/DriverStatisticsPanel";
import PageHeader from "@/components/PageHeader";
import ProfileSkeleton from "@/components/ui/ProfileSkeleton";
import SprintToggle from "@/components/ui/SprintToggle";
import TabBar from "@/components/ui/TabBar";
import { useTabSync } from "@/hooks/useTabSync";
import { apiHeaders, apiUrl } from "@/lib/api";
import {
  getDriverBannerUrl,
  getDriverPortraitUrl,
} from "@/lib/entityImageOverrides";
import { getCountryName, getDriverFlagEmoji } from "@/lib/flags";
import type { DriverProfile } from "@/lib/types";

type DriverTab = "overview" | "results";

const TABS: { key: DriverTab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "results", label: "Results" },
];

async function fetchDriverProfile(
  driverCode: string,
  includeSprint: boolean,
): Promise<DriverProfile> {
  const params = new URLSearchParams();
  if (!includeSprint) params.set("include_sprint", "false");
  const url = params.toString()
    ? apiUrl(`/api/drivers/${driverCode}?${params}`)
    : apiUrl(`/api/drivers/${driverCode}`);
  const res = await fetch(url, { headers: apiHeaders() });
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
  const [includeSprint, setIncludeSprint] = useState(true);

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["driver-profile", driverCode, includeSprint],
    queryFn: () => fetchDriverProfile(driverCode, includeSprint),
    placeholderData: keepPreviousData,
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

  const headlineStats = [
    { label: "Championships", value: data.total_championships || 0 },
    { label: "Wins", value: data.total_wins },
    { label: "Podiums", value: data.total_podiums },
  ];
  const stats = [
    { label: "Seasons", value: data.total_seasons },
    { label: "Races", value: data.total_races },
    { label: "Total Points", value: Math.round(data.total_points) },
  ];
  const teamColor = data.current_team_color
    ? `#${data.current_team_color}`
    : null;
  const portraitUrl = getDriverPortraitUrl(data);
  const bannerUrl = getDriverBannerUrl(data);
  const winRate =
    data.total_races > 0 ? (data.total_wins / data.total_races) * 100 : 0;
  const podiumRate =
    data.total_races > 0 ? (data.total_podiums / data.total_races) * 100 : 0;
  const highlights = [
    {
      label: "Win Rate",
      value: `${winRate.toFixed(1)}%`,
      progress: winRate,
    },
    {
      label: "Podium Rate",
      value: `${podiumRate.toFixed(1)}%`,
      progress: podiumRate,
    },
    {
      label: "Points per Race",
      value:
        data.total_races > 0
          ? (data.total_points / data.total_races).toFixed(2)
          : "0",
      progress: undefined,
    },
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
          <div className="flex items-center relative">
            <div className="flex-1" />
            <TabBar tabs={TABS} activeTab={activeTab} onTabChange={switchTab} />
            <div className="flex-1 flex justify-end border-t border-border-primary/40 mt-1 pt-1.5 mr-2">
              <SprintToggle
                checked={includeSprint}
                onChange={setIncludeSprint}
                isLoading={isFetching}
              />
            </div>
          </div>
        }
      />

      {/* Tab Content */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        {activeTab === "overview" && (
          <div className="space-y-6">
            <ArchiveDataHeader
              title={data.full_name}
              eyebrow="Driver Profile"
              subtitle={`${data.current_team ?? "Independent entry"}${data.driver_number ? ` · #${data.driver_number}` : ""}`}
              accentColor={teamColor}
              stats={stats}
              headlineStats={headlineStats}
              bannerImageUrl={bannerUrl}
              media={
                portraitUrl ? (
                  <Image
                    src={portraitUrl}
                    alt={data.full_name}
                    width={180}
                    height={180}
                    className="h-full max-h-[360px] w-full object-contain object-bottom"
                  />
                ) : (
                  <span className="text-5xl font-bold font-mono text-text-tertiary">
                    {data.driver_code}
                  </span>
                )
              }
              meta={
                <div className="flex items-center gap-3 bg-bg-primary border border-border-primary rounded-sm px-3 py-2">
                  {data.country_code && (
                    <span className="text-2xl">
                      {getDriverFlagEmoji(data.country_code)}
                    </span>
                  )}
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-widest text-text-muted">
                      Nationality
                    </div>
                    <div className="text-sm font-semibold text-text-primary">
                      {data.country_code
                        ? getCountryName(data.country_code)
                        : "Unknown"}
                    </div>
                  </div>
                </div>
              }
            />

            <ArchivePanel title="Career Highlights">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 rounded-sm border border-border-primary bg-bg-primary/20 px-4 md:px-5">
                {highlights.map((stat) => (
                  <ArchiveMetricBar
                    key={stat.label}
                    label={stat.label}
                    value={stat.value}
                    progress={stat.progress}
                    accentColor={teamColor}
                  />
                ))}
              </div>
            </ArchivePanel>

            <DriverSeasonHistoryGraph driverCode={driverCode} />

            <DriverStatisticsPanel driverCode={driverCode} />
          </div>
        )}

        {activeTab === "results" && (
          <DriverResultsTable
            driverCode={driverCode}
            includeSprint={includeSprint}
          />
        )}
      </div>
    </div>
  );
}
