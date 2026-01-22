"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import SessionDetail from "@/components/SessionDetail";
import { apiHeaders, apiUrl } from "@/lib/api";

// Type definitions matching our API responses
type CircuitInfo = {
  name: string;
  location: string;
  country: string;
  track_length_km: number | null;
};

type DriverInfo = {
  driver_number: number | null;
  driver_code: string;
  full_name: string;
};

type TeamInfo = {
  name: string;
  team_color: string | null;
};

type SessionResultDetail = {
  position: number | null;
  status: string;
  headshot_url: string | null;
  driver: DriverInfo;
  team: TeamInfo;
  grid_position: number | null;
  points: number | null;
  laps_completed: number | null;
  time_seconds: number | null;
  fastest_lap: boolean;
  q1_time_seconds: number | null;
  q2_time_seconds: number | null;
  q3_time_seconds: number | null;
};

type SessionInfo = {
  id: number;
  year: number;
  round: number;
  session_type: string;
  event_name: string;
  date: string;
  circuit: CircuitInfo;
};

type SessionResultsResponse = {
  session: SessionInfo;
  results: SessionResultDetail[];
};

export default function SprintDetailPage() {
  const params = useParams();
  const router = useRouter();
  const season = params.season as string;
  const round = params.round as string;

  const [data, setData] = useState<SessionResultsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Scroll to top on page load
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (!season || !round) return;

    (async () => {
      try {
        setLoading(true);
        const response = await fetch(
          apiUrl(`/api/results/${season}/${round}/sprint`),
          {
            cache: "no-store",
            headers: apiHeaders(),
          },
        );
        const sessionData = await response.json();
        setData(sessionData);
      } catch (error) {
        console.error("Failed to fetch sprint details:", error);
      } finally {
        setLoading(false);
      }
    })();
  }, [season, round]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#15151e] p-8">
        <div className="max-w-7xl mx-auto">
          <p className="text-center text-gray-400">Loading sprint details...</p>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="min-h-screen bg-[#15151e] p-8">
        <div className="max-w-7xl mx-auto">
          <p className="text-center text-red-400">
            Failed to load sprint details.
          </p>
        </div>
      </main>
    );
  }

  return (
    <SessionDetail
      data={data}
      season={season}
      isSprint={true}
      onBack={() => router.push(`/results/${season}`)}
    />
  );
}
