"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import CircuitLapRecords from "@/components/CircuitLapRecords";
import CircuitLapTimeTrend from "@/components/CircuitLapTimeTrend";
import CircuitRaceHistoryTable from "@/components/CircuitRaceHistoryTable";
import CircuitRecentRace from "@/components/CircuitRecentRace";
import CircuitStatisticsPanel from "@/components/CircuitStatisticsPanel";
import CircuitTyreStats from "@/components/CircuitTyreStats";
import CircuitWeatherProfile from "@/components/CircuitWeatherProfile";
import InteractiveTrackMap from "@/components/InteractiveTrackMap";
import PageHeader from "@/components/PageHeader";
import { TrianglePattern } from "@/components/Patterns";
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
      <PageHeader
        title={circuit.name}
        subtitle={`${circuit.location}, ${circuit.country}`}
        onBack={() => router.push("/circuits")}
        backLabel="CIRCUITS"
        bottomContent={
          <div className="flex justify-center">
            <TabBar tabs={TABS} activeTab={activeTab} onTabChange={switchTab} />
          </div>
        }
      />

      {/* Tab Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {activeTab === "overview" && (
          <div className="space-y-8">
            {/* Main grid: left column (map + recent race) / right column (stats + records + weather) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left column */}
              <div className="lg:col-span-2 flex flex-col gap-6">
                {/* Interactive Track Map */}
                <InteractiveTrackMap
                  circuitId={circuit.id}
                  circuitName={circuit.name}
                  trackLengthKm={circuit.track_length_km}
                  location={circuit.location}
                />

                {/* Recent Race - fills remaining space below map */}
                <div className="flex-1">
                  <CircuitRecentRace circuitId={id} />
                </div>
              </div>

              {/* Right column */}
              <div className="lg:col-span-1 flex flex-col gap-4">
                {/* Circuit Info Card */}
                <div className="bg-bg-tertiary rounded-sm p-6 border border-border-primary">
                  <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                    Circuit Stats
                  </h2>

                  <div className="space-y-6">
                    <div>
                      <div className="text-2xl font-bold text-white">
                        {circuit.track_length_km
                          ? `${circuit.track_length_km.toFixed(3)} km`
                          : "N/A"}
                      </div>
                    </div>

                    <div>
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
                          <span className="text-text-tertiary">
                            Most Recent
                          </span>
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

                {/* Lap Records Card */}
                <div className="bg-bg-tertiary rounded-sm p-6 border border-border-primary">
                  <CircuitLapRecords circuitId={id} />
                </div>

                {/* Weather Profile Card */}
                <div className="bg-bg-tertiary rounded-sm p-6 border border-border-primary flex-1">
                  <CircuitWeatherProfile circuitId={id} />
                </div>
              </div>
            </div>

            {/* Lap Time Trend */}
            <div className="bg-bg-tertiary border border-border-primary rounded-sm shadow-sm overflow-hidden">
              <div className="relative h-10 bg-bg-primary border-b border-border-primary px-4 flex items-center overflow-hidden">
                <TrianglePattern id="lap-trend-triangles" />
                <span className="relative z-10 text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono">
                  Lap Time Evolution
                </span>
              </div>
              <div className="p-6">
                <CircuitLapTimeTrend circuitId={id} />
              </div>
            </div>

            {/* Tyre Strategy */}
            <div className="bg-bg-tertiary border border-border-primary rounded-sm shadow-sm overflow-hidden">
              <div className="relative h-10 bg-bg-primary border-b border-border-primary px-4 flex items-center overflow-hidden">
                <TrianglePattern id="tyre-stats-triangles" />
                <span className="relative z-10 text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono">
                  Tyre Strategy
                </span>
              </div>
              <div className="p-6">
                <CircuitTyreStats circuitId={id} />
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
