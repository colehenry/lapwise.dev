"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { fetchAvailableReplays, fetchReplaySeasons } from "@/lib/api";
import ReplayBrowser from "./components/ReplayBrowser";
import ReplayPlayer from "./components/ReplayPlayer";

export default function ReplayPage() {
  const searchParams = useSearchParams();
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [selectedReplay, setSelectedReplay] = useState<{
    season: number;
    round: number;
    eventName: string;
  } | null>(null);
  const [autoLoaded, setAutoLoaded] = useState(false);

  const { data: seasons = [] } = useQuery({
    queryKey: ["replaySeasons"],
    queryFn: fetchReplaySeasons,
  });

  const activeSeason = selectedSeason ?? seasons[0] ?? null;

  // Auto-select replay from URL params (e.g., /replay?season=2024&round=5)
  useEffect(() => {
    if (autoLoaded || selectedReplay) return;

    const seasonParam = searchParams.get("season");
    const roundParam = searchParams.get("round");

    if (seasonParam && roundParam) {
      const season = Number.parseInt(seasonParam, 10);
      const round = Number.parseInt(roundParam, 10);

      if (!Number.isNaN(season) && !Number.isNaN(round)) {
        setAutoLoaded(true);
        fetchAvailableReplays(season)
          .then((data) => {
            const replay = data.replays.find((r) => r.round === round);
            if (replay) {
              setSelectedReplay({
                season,
                round,
                eventName: replay.event_name,
              });
            }
          })
          .catch(() => {});
      }
    }
  }, [searchParams, autoLoaded, selectedReplay]);

  if (selectedReplay) {
    return (
      <ReplayPlayer
        season={selectedReplay.season}
        round={selectedReplay.round}
        eventName={selectedReplay.eventName}
        onBack={() => setSelectedReplay(null)}
      />
    );
  }

  return (
    <main className="min-h-screen bg-bg-secondary">
      <PageHeader
        title="Race Replay"
        subtitle="Telemetry Replay"
        leftContent={
          seasons.length > 0 ? (
            <select
              value={activeSeason ?? ""}
              onChange={(e) => setSelectedSeason(Number(e.target.value))}
              className="bg-bg-primary border border-border-primary text-text-primary font-mono text-xs font-bold px-4 py-2 rounded-sm focus:outline-none focus:border-purple-500 transition-colors duration-150 cursor-pointer uppercase tracking-widest"
            >
              {seasons.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          ) : undefined
        }
      />

      <div className="max-w-6xl mx-auto p-6">
        <ReplayBrowser
          season={activeSeason}
          onSelect={(season, round, eventName) =>
            setSelectedReplay({ season, round, eventName })
          }
        />
      </div>
    </main>
  );
}
