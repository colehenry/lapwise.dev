"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import ArchiveDataHeader from "@/components/archive/ArchiveDataHeader";
import ArchiveMetricBar from "@/components/archive/ArchiveMetricBar";
import ArchivePanel from "@/components/archive/ArchivePanel";
import ConstructorResultsTable from "@/components/ConstructorResultsTable";
import ConstructorSeasonHistoryGraph from "@/components/ConstructorSeasonHistoryGraph";
import ConstructorStatisticsPanel from "@/components/ConstructorStatisticsPanel";
import PageHeader from "@/components/PageHeader";
import ProfileSkeleton from "@/components/ui/ProfileSkeleton";
import TabBar from "@/components/ui/TabBar";
import { useTabSync } from "@/hooks/useTabSync";
import { apiHeaders, apiUrl } from "@/lib/api";
import {
  getConstructorBannerUrl,
  getConstructorLogoUrl,
  getConstructorPhotoUrl,
} from "@/lib/entityImageOverrides";
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
  const router = useRouter();
  const teamName = params.teamName as string;
  const { activeTab, switchTab } = useTabSync<ConstructorTab>(
    `/constructors/${teamName}`,
    "overview",
  );

  const { data, isLoading, error } = useQuery({
    queryKey: ["constructor-profile", teamName],
    queryFn: () => fetchConstructorProfile(teamName),
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
  const teamColor = data.team_color ? `#${data.team_color}` : null;
  const logoUrl = getConstructorLogoUrl(data);
  const photoUrl = getConstructorPhotoUrl(data);
  const bannerUrl = getConstructorBannerUrl(data);
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
          <div className="space-y-6">
            <ArchiveDataHeader
              title={data.team_name}
              eyebrow="Constructor Profile"
              subtitle={`${data.latest_season ? `Active in ${data.latest_season}` : "Historical constructor"}${data.best_finish ? ` · Best finish ${getOrdinalSuffix(data.best_finish)}` : ""}`}
              accentColor={teamColor}
              stats={stats}
              headlineStats={headlineStats}
              bannerImageUrl={bannerUrl}
              media={
                photoUrl ? (
                  <Image
                    src={photoUrl}
                    alt={`${data.team_name} car`}
                    width={320}
                    height={180}
                    className="h-full w-full scale-125 rotate-[-90deg] object-contain"
                  />
                ) : logoUrl ? (
                  <Image
                    src={logoUrl}
                    alt={data.team_name}
                    width={180}
                    height={180}
                    className="h-full w-full object-contain p-7"
                    unoptimized={logoUrl.includes("wikimedia.org")}
                  />
                ) : (
                  <span className="text-text-primary font-bold text-5xl text-center px-4">
                    {data.team_name
                      .split(" ")
                      .map((word) => word[0])
                      .join("")}
                  </span>
                )
              }
              meta={
                data.best_finish ? (
                  <div className="bg-bg-primary border border-border-primary rounded-sm px-3 py-2">
                    <div className="text-[10px] font-mono uppercase tracking-widest text-text-muted">
                      Best Finish
                    </div>
                    <div className="text-sm font-semibold text-text-primary">
                      {getOrdinalSuffix(data.best_finish)}
                    </div>
                  </div>
                ) : null
              }
            />

            <ArchivePanel title="Constructor Highlights">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 rounded-sm border border-border-primary bg-bg-primary/20 px-4 md:px-5">
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

            <ConstructorSeasonHistoryGraph teamName={teamName} />
          </div>
        )}

        {activeTab === "results" && (
          <ConstructorResultsTable teamName={teamName} />
        )}

        {activeTab === "statistics" && (
          <ConstructorStatisticsPanel
            teamName={teamName}
            accentColor={teamColor}
          />
        )}
      </div>
    </div>
  );
}
