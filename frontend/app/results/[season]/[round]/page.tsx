"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import SessionDetail from "@/components/SessionDetail";
import { apiHeaders, apiUrl } from "@/lib/api";

// Type definitions matching our API responses
type CircuitInfo = {
  id: number;
  name: string;
  location: string;
  country: string;
  track_length_km: number | null;
  track_map_url: string | null;
};

type DriverInfo = {
  driver_number: number | null;
  driver_code: string;
  full_name: string;
  country_code: string | null;
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

export default function RoundDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const season = params.season as string;
  const round = params.round as string;
  const initialMode = searchParams.get("mode") === "qualifying" ? "qualifying" : "race";

  const [data, setData] = useState<SessionResultsResponse | null>(null);
  const [qualifyingData, setQualifyingData] =
    useState<SessionResultsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [sessionType, setSessionType] = useState<"race" | "qualifying">(initialMode);

  // Scroll to top on page load
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Update sessionType if initialMode changes (e.g. back/forward navigation)
  useEffect(() => {
    if (initialMode) {
      setSessionType(initialMode);
    }
  }, [initialMode]);

  useEffect(() => {
    if (!season || !round) return;

    let isMounted = true;

    (async () => {
      try {
        setLoading(true);
        // Fetch race data first
        const response = await fetch(
          apiUrl(`/api/results/${season}/${round}`),
          {
            cache: "no-store",
            headers: apiHeaders(),
          },
        );
        const sessionData = await response.json();

        if (!isMounted) return;
        setData(sessionData);

        // Prefetch qualifying data in background
        fetch(apiUrl(`/api/results/${season}/${round}/qualifying`), {
          cache: "no-store",
          headers: apiHeaders(),
        })
          .then((res) => {
            if (!res.ok) throw new Error("Qualifying data not found");
            return res.json();
          })
          .then((qualData) => {
            if (isMounted) {
              setQualifyingData(qualData);
            }
          })
          .catch((error) => {
            // Silently fail - qualifying data is optional
            if (isMounted) {
              console.log("Qualifying data not available:", error);
            }
          });
      } catch (error) {
        if (isMounted) {
          console.error("Failed to fetch round details:", error);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [season, round]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#15151e] p-8">
        <div className="max-w-7xl mx-auto">
          <p className="text-center text-gray-400">Loading race details...</p>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="min-h-screen bg-[#15151e] p-8">
        <div className="max-w-7xl mx-auto">
          <p className="text-center text-red-400">
            Failed to load race details.
          </p>
        </div>
      </main>
    );
  }

  // Get the current data to display based on view mode
  const displayData = sessionType === "qualifying" ? qualifyingData : data;

  return (
    <SessionDetail
      data={displayData}
      qualifyingData={qualifyingData}
      season={season}
      sessionType={sessionType}
      onSessionTypeChange={setSessionType}
      onBack={() => router.push(`/results/${season}`)}
    />
  );
}
