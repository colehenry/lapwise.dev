"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import ArchivePanel from "@/components/archive/ArchivePanel";
import ArchiveStatTile from "@/components/archive/ArchiveStatTile";
import CircuitLapRecords from "@/components/CircuitLapRecords";
import CircuitLapTimeTrend from "@/components/CircuitLapTimeTrend";
import CircuitRaceHistoryTable from "@/components/CircuitRaceHistoryTable";
import CircuitRecentRace from "@/components/CircuitRecentRace";
import CircuitStatisticsPanel from "@/components/CircuitStatisticsPanel";
import CircuitTyreStats from "@/components/CircuitTyreStats";
import CircuitWeatherProfile from "@/components/CircuitWeatherProfile";
import InteractiveTrackMap from "@/components/InteractiveTrackMap";
import PageHeader from "@/components/PageHeader";
import Skeleton from "@/components/ui/Skeleton";
import TabBar from "@/components/ui/TabBar";
import { useTabSync } from "@/hooks/useTabSync";
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
  const router = useRouter();
  const id = params.id as string;
  const { activeTab, switchTab } = useTabSync<CircuitTab>(
    `/circuits/${id}`,
    "overview",
  );

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
          <h1 className="text-3xl font-bold text-text-primary mb-4">
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

  const hasCoordinates = circuit.latitude != null && circuit.longitude != null;

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
          <div className="space-y-6">
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
                <ArchivePanel title="Circuit Profile">
                  <div className="space-y-4 text-center">
                    <div className="grid grid-cols-2 gap-2">
                      <ArchiveStatTile
                        label="Length"
                        value={
                          circuit.track_length_km
                            ? `${circuit.track_length_km.toFixed(3)} km`
                            : "N/A"
                        }
                      />
                      <ArchiveStatTile
                        label="Races"
                        value={circuit.total_races}
                      />
                      <ArchiveStatTile
                        label="First Race"
                        value={circuit.first_year ?? "N/A"}
                      />
                      <ArchiveStatTile
                        label="Most Recent"
                        value={circuit.most_recent_year ?? "N/A"}
                      />
                    </div>

                    {hasCoordinates && (
                      <div className="pt-4 border-t border-border-primary">
                        <div className="text-[10px] font-mono uppercase tracking-widest text-text-muted mb-1">
                          Coordinates
                        </div>
                        <div className="text-xs font-mono text-text-tertiary">
                          {circuit.latitude?.toFixed(4)},{" "}
                          {circuit.longitude?.toFixed(4)}
                        </div>
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${circuit.latitude},${circuit.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-3 inline-flex items-center rounded-sm border border-border-primary bg-bg-primary px-3 py-2 text-xs font-mono font-bold uppercase tracking-widest text-text-secondary transition-colors hover:border-purple-500 hover:text-purple-300"
                        >
                          View Map
                        </a>
                      </div>
                    )}
                  </div>
                </ArchivePanel>

                <ArchivePanel title="Lap Records">
                  <CircuitLapRecords circuitId={id} />
                </ArchivePanel>

                <ArchivePanel title="Weather Profile" className="flex-1">
                  <CircuitWeatherProfile circuitId={id} />
                </ArchivePanel>
              </div>
            </div>

            {/* Lap Time Trend */}
            <ArchivePanel title="Lap Time Evolution">
              <CircuitLapTimeTrend circuitId={id} />
            </ArchivePanel>

            {/* Tyre Strategy */}
            <ArchivePanel title="Tyre Strategy">
              <CircuitTyreStats circuitId={id} />
            </ArchivePanel>
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
