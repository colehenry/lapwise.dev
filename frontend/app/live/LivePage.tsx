"use client";

import { useState } from "react";
import ReplayBrowser from "./components/ReplayBrowser";
import ReplayPlayer from "./components/ReplayPlayer";

export default function LivePage() {
  const [selectedReplay, setSelectedReplay] = useState<{
    season: number;
    round: number;
    eventName: string;
  } | null>(null);

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
    <div className="min-h-screen bg-bg-primary">
      <section className="bg-bg-secondary border-b border-border-primary relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-20 right-1/4 w-64 h-64 rounded-full bg-purple-500/10 blur-3xl" />
          <div className="absolute bottom-0 left-1/4 w-56 h-56 rounded-full bg-red-500/10 blur-3xl" />
        </div>
        <div className="relative max-w-6xl mx-auto px-6 py-12 md:py-16">
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-text-primary">
            Race Replay
          </h1>
          <p className="mt-4 text-base md:text-lg text-text-secondary max-w-2xl">
            Watch animated race replays with real telemetry data. See driver
            positions, tire strategies, and safety car deployments unfold on the
            track map.
          </p>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <ReplayBrowser
          onSelect={(season, round, eventName) =>
            setSelectedReplay({ season, round, eventName })
          }
        />
      </div>
    </div>
  );
}
