"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { getCircuitFlagEmoji, getDriverFlagEmoji } from "@/lib/flags";

interface UpcomingEvent {
  event_name: string;
  event_type: string; // "race" or "testing"
  event_date: string; // ISO date string
  location: string;
  country: string;
  round_number: number | null;
  circuit_id: number | null;
  circuit_name: string | null;
}

async function fetchUpcomingEvents(): Promise<UpcomingEvent[]> {
  const apiKey = process.env.NEXT_PUBLIC_API_KEY || "";
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/events/upcoming?limit=10`,
    {
      headers: {
        "X-API-Key": apiKey,
      },
    },
  );

  if (!res.ok) {
    throw new Error("Failed to fetch upcoming events");
  }

  return res.json();
}

function getDaysUntilEvent(dateString: string): number {
  const eventDate = new Date(dateString);
  const today = new Date();
  const diffTime = eventDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

function formatEventDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function NextRaceBanner() {
  const {
    data: events,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["upcoming-events"],
    queryFn: fetchUpcomingEvents,
    staleTime: 60 * 60 * 1000, // Cache for 1 hour
  });

  // Don't show banner if loading or error
  if (isLoading || error || !events || events.length === 0) {
    return null;
  }

  return (
    <div className="w-full bg-bg-secondary py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Latest Race Result - Centered with max width */}
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-text-primary mb-6 text-center">
            Latest Race Result
          </h2>
          <LatestRaceCompact />
        </div>

        {/* Upcoming Events - Full Width */}
        <div>
          <h2 className="text-3xl font-bold text-text-primary mb-6 text-center">
            Upcoming Events
          </h2>
          {/* Horizontal Scrollable Events */}
          <div className="overflow-x-auto overflow-y-hidden -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 scrollbar-thin scrollbar-thumb-purple-500/20 scrollbar-track-transparent hover:scrollbar-thumb-purple-500/40">
            <div className="flex gap-4 pb-4 min-w-min">
              {events.map((event) => {
                const daysUntil = getDaysUntilEvent(event.event_date);
                const formattedDate = formatEventDate(event.event_date);
                const isTesting = event.event_type === "testing";
                const flag = getCircuitFlagEmoji(event.country);
                const year = new Date(event.event_date).getFullYear();
                const lastYear = year - 1;

                // Determine if this circuit/event is new
                // For 2026: Madrid is new, rest are returning
                const isNewCircuit =
                  event.event_name.includes("Madrid") ||
                  event.circuit_id === null;

                // Show last year link only for races (not testing) that aren't new circuits
                const showLastYearLink =
                  !isTesting && event.round_number && !isNewCircuit;

                const content = (
                  <div
                    key={`${event.event_date}-${event.event_name}`}
                    className="flex-shrink-0 w-80 bg-bg-primary border border-border-primary rounded-lg p-4 hover:border-purple-500/30 transition-all duration-200"
                  >
                    <div className="flex items-center gap-4">
                      {/* Countdown - Vertical on Left */}
                      <div className="flex flex-col items-center justify-center border-r border-border-primary pr-4 min-w-[60px]">
                        <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wide">
                          In
                        </span>
                        <span className="text-2xl font-bold text-text-primary my-1">
                          {daysUntil}
                        </span>
                        <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wide">
                          {daysUntil === 1 ? "Day" : "Days"}
                        </span>
                      </div>

                      {/* Event Info - Right Side */}
                      <div className="flex-1 text-center flex flex-col min-h-[200px]">
                        <h3 className="text-sm font-bold text-text-primary mb-2 truncate">
                          {event.event_name}
                        </h3>
                        <div className="text-3xl mb-2">{flag}</div>
                        <span className="text-xs font-semibold text-text-tertiary uppercase tracking-wider block mb-2">
                          {isTesting ? "Testing" : "Grand Prix"}
                        </span>
                        <p className="text-xs text-text-tertiary truncate">
                          {event.location}
                        </p>
                        <p className="text-xs text-text-muted mt-1 mb-3 truncate">
                          {formattedDate}
                        </p>

                        {/* Action Button/Badge */}
                        {isNewCircuit && !isTesting && (
                          <div className="mt-auto">
                            <span className="inline-block px-3 py-1 text-xs font-semibold bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded">
                              New Circuit
                            </span>
                          </div>
                        )}
                        {showLastYearLink && (
                          <div className="mt-auto">
                            <Link
                              href={`/results/${lastYear}/${event.round_number}`}
                              className="inline-block px-3 py-1 text-xs font-semibold bg-bg-secondary text-text-tertiary border border-border-primary rounded hover:border-purple-500/50 hover:text-purple-400 transition-colors duration-200"
                            >
                              View {lastYear} Results
                            </Link>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );

                return content;
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Latest Race Compact Component
interface LatestRacePodiumDriver {
  full_name: string;
  driver_code: string;
  country_code: string | null;
  headshot_url: string | null;
  team_name: string;
  team_color: string | null;
  fastest_lap: boolean;
}

interface LatestRaceCompactData {
  round: number;
  event_name: string;
  date: string;
  circuit_name: string;
  circuit_id: number;
  session_type: string;
  podium: LatestRacePodiumDriver[];
}

async function fetchLatestRaceCompact(): Promise<LatestRaceCompactData> {
  const apiKey = process.env.NEXT_PUBLIC_API_KEY || "";
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/results/latest`,
    {
      headers: {
        "X-API-Key": apiKey,
      },
    },
  );

  if (!res.ok) {
    throw new Error("Failed to fetch latest race");
  }

  return res.json();
}

function LatestRaceCompact() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["latest-race-compact"],
    queryFn: fetchLatestRaceCompact,
  });

  if (isLoading) {
    return (
      <div className="bg-bg-primary border border-border-primary rounded-lg p-8 shadow-lg h-[280px]">
        <div className="animate-pulse h-full flex items-center justify-center">
          <div className="text-text-tertiary">Loading latest race...</div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-bg-primary border border-border-primary rounded-lg p-8 shadow-lg h-[280px]">
        <p className="text-red-400 text-sm text-center">
          Failed to load latest race
        </p>
      </div>
    );
  }

  const year = new Date(data.date).getFullYear();

  return (
    <div className="space-y-4">
      {/* Race Result Card - Scaled 2x */}
      <div className="bg-bg-tertiary border border-border-primary rounded-lg shadow-lg p-8 hover:border-purple-500 transition-all h-[280px]">
        <div className="flex items-center gap-8 h-full">
          {/* Left side: Race info and podium */}
          <div className="flex-1 min-w-0 h-full flex flex-col">
            {/* Race Header */}
            <div className="mb-6 pb-4 border-b border-border-secondary">
              <div className="flex items-center gap-4 flex-wrap mb-2">
                <h3 className="text-2xl font-bold text-white truncate">
                  <span className="text-text-tertiary font-normal">
                    Round {data.round}
                  </span>{" "}
                  • {data.event_name}
                </h3>
                {data.session_type === "sprint_race" && (
                  <span className="bg-purple-500 text-white px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap">
                    SPRINT
                  </span>
                )}
              </div>
              <p className="text-sm text-text-tertiary truncate">
                {data.circuit_name} •{" "}
                {new Date(data.date).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>

            {/* Podium - Horizontal Layout */}
            <div className="flex items-center flex-1">
              {data.podium.map((driver, idx) => {
                const medals = ["🥇", "🥈", "🥉"];

                return (
                  <div
                    key={driver.driver_code}
                    className="flex items-center gap-2 flex-1 min-w-0"
                  >
                    {/* Medal */}
                    <span className="text-3xl flex-shrink-0">
                      {medals[idx]}
                    </span>

                    {/* Driver Photo */}
                    {driver.headshot_url && (
                      <Image
                        src={driver.headshot_url}
                        alt={driver.full_name}
                        width={80}
                        height={80}
                        className="rounded-full object-cover border-2 border-border-secondary flex-shrink-0"
                      />
                    )}

                    {/* Driver Name - Team colored, centered vertically */}
                    <div className="flex items-center min-w-0">
                      <div
                        className="font-bold text-xl truncate"
                        style={{
                          color: driver.team_color
                            ? `#${driver.team_color}`
                            : "#fff",
                        }}
                      >
                        {driver.driver_code}
                        {driver.fastest_lap && (
                          <span
                            className="text-base text-[#c77dff] ml-2 cursor-help"
                            title="Fastest Lap"
                          >
                            ⚡
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right side: Track map - centered vertically */}
          <div className="flex-shrink-0 flex items-center h-full">
            <Image
              src={`/track-maps/${data.circuit_id}.png`}
              alt={`${data.circuit_name} track map`}
              width={300}
              height={300}
              className="object-contain max-h-full"
            />
          </div>
        </div>
      </div>

      {/* View Full Results Button */}
      <div className="flex justify-center">
        <Link
          href={`/results/${year}/${data.round}`}
          className="px-6 py-3 text-sm font-semibold bg-bg-tertiary text-text-secondary border-2 border-border-primary rounded-lg hover:border-purple-500 hover:text-purple-400 hover:bg-purple-500/5 transition-all duration-200"
        >
          View Full Results →
        </Link>
      </div>
    </div>
  );
}
