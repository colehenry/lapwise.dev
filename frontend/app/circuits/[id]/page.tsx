"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import CircuitRaceHistoryTable from "@/components/CircuitRaceHistoryTable";
import CircuitStatisticsPanel from "@/components/CircuitStatisticsPanel";
import Skeleton from "@/components/ui/Skeleton";
import TabBar from "@/components/ui/TabBar";
import { apiHeaders, apiUrl } from "@/lib/api";
import type { CircuitInfo } from "@/lib/types";

type CircuitTab = "overview" | "history" | "statistics";

const TABS: { key: CircuitTab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "history", label: "History" },
  { key: "statistics", label: "Statistics" },
];

async function fetchCircuit(id: string): Promise<CircuitInfo> {
  const res = await fetch(apiUrl(`/api/circuits/${id}`), {
    headers: apiHeaders(),
  });
  if (!res.ok) {
    if (res.status === 404) throw new Error("Circuit not found");
    throw new Error("Failed to fetch circuit");
  }
  return res.json();
}

export default function CircuitDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = params.id as string;

  const urlTab = searchParams.get("tab") as CircuitTab | null;
  const [activeTab, setActiveTab] = useState<CircuitTab>(urlTab || "overview");

  useEffect(() => {
    if (urlTab) setActiveTab(urlTab);
  }, [urlTab]);

  const switchTab = (tab: CircuitTab) => {
    setActiveTab(tab);
    const url =
      tab === "overview" ? `/circuits/${id}` : `/circuits/${id}?tab=${tab}`;
    router.replace(url, { scroll: false });
  };

  const {
    data: circuit,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["circuit", id],
    queryFn: () => fetchCircuit(id),
    enabled: !!id,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg-secondary p-4 md:p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <Skeleton variant="text" width="160px" />
          <Skeleton variant="text" width="400px" height="48px" />
          <Skeleton variant="rectangular" height="40px" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <Skeleton variant="rectangular" height="400px" />
            </div>
            <Skeleton variant="rectangular" height="400px" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !circuit) {
    return (
      <div className="min-h-screen bg-bg-secondary p-4 md:p-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-3xl font-bold text-white mb-4">
            Circuit Not Found
          </h1>
          <p className="text-text-tertiary mb-8">
            The circuit you are looking for does not exist or could not be
            loaded.
          </p>
          <Link
            href="/circuits"
            className="inline-block px-6 py-3 bg-red-500 text-white rounded-sm hover:bg-red-600 transition-colors"
          >
            Back to Circuits
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-secondary">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-bg-secondary border-b border-border-primary">
        <div className="max-w-6xl mx-auto px-6">
          <div className="h-16 flex items-center gap-4">
            <Link
              href="/circuits"
              className="bg-bg-primary border border-border-primary text-text-primary font-mono text-xs font-bold px-4 py-2 rounded-sm hover:border-purple-500 hover:text-purple-300 transition-colors duration-150 flex items-center gap-2"
            >
              <span>&larr;</span>
              <span className="hidden sm:inline">CIRCUITS</span>
            </Link>
            <div className="flex flex-col">
              <span className="text-text-primary font-mono text-sm font-bold leading-none">
                {circuit.name}
              </span>
              <span className="text-text-muted text-[10px] tracking-widest uppercase font-bold hidden sm:inline">
                {circuit.location}, {circuit.country}
              </span>
            </div>
          </div>

          <TabBar tabs={TABS} activeTab={activeTab} onTabChange={switchTab} />
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Info */}
            <div className="lg:col-span-2 space-y-6">
              <div>
                <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">
                  {circuit.name}
                </h1>
                <div className="flex items-center gap-3 text-xl text-text-tertiary">
                  <span className="flex items-center gap-1">
                    {circuit.location}, {circuit.country}
                  </span>
                </div>
              </div>

              {/* Track Map */}
              <div className="bg-bg-tertiary rounded-sm p-8 border border-border-primary flex items-center justify-center min-h-[400px]">
                <div className="relative w-full h-[300px] md:h-[400px]">
                  <Image
                    src={`/track-maps/${circuit.id}.png`}
                    alt={`${circuit.name} track map`}
                    fill
                    className="object-contain"
                  />
                </div>
              </div>
            </div>

            {/* Sidebar Stats */}
            <div className="lg:col-span-1 space-y-4">
              <div className="bg-bg-tertiary rounded-sm p-6 border border-border-primary">
                <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                  Circuit Stats
                </h2>

                <div className="space-y-6">
                  <div>
                    <div className="text-xs text-text-muted uppercase tracking-wider mb-1">
                      Dimensions
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {circuit.track_length_km
                        ? `${circuit.track_length_km.toFixed(3)} km`
                        : "N/A"}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-text-muted uppercase tracking-wider mb-1">
                      Activity
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-white">
                        {circuit.total_races}
                      </span>
                      <span className="text-text-tertiary">
                        Grand Prix held
                      </span>
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-text-muted uppercase tracking-wider mb-1">
                      History
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-text-tertiary">First Race</span>
                        <span className="text-white font-medium">
                          {circuit.first_year}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-text-tertiary">Most Recent</span>
                        <span className="text-white font-medium">
                          {circuit.most_recent_year}
                        </span>
                      </div>
                    </div>
                  </div>

                  {(circuit.latitude || circuit.longitude) && (
                    <div>
                      <div className="text-xs text-text-muted uppercase tracking-wider mb-1">
                        Coordinates
                      </div>
                      <div className="text-sm font-mono text-text-tertiary">
                        {circuit.latitude?.toFixed(4)},{" "}
                        {circuit.longitude?.toFixed(4)}
                      </div>
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${circuit.latitude},${circuit.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-red-500 hover:text-red-400 mt-2 block"
                      >
                        View on Google Maps
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "history" && <CircuitRaceHistoryTable circuitId={id} />}

        {activeTab === "statistics" && (
          <CircuitStatisticsPanel circuitId={id} />
        )}
      </div>
    </div>
  );
}
