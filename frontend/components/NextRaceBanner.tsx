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
      <div className="bg-bg-primary border border-border-primary rounded-lg p-6 shadow-lg">
        <div className="animate-pulse space-y-4">
          <div className="text-center space-y-2">
            <div className="h-6 bg-bg-secondary rounded w-2/3 mx-auto" />
            <div className="h-12 w-12 bg-bg-secondary rounded-full mx-auto" />
            <div className="h-3 bg-bg-secondary rounded w-1/3 mx-auto" />
            <div className="h-3 bg-bg-secondary rounded w-1/2 mx-auto" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="h-32 bg-bg-secondary rounded-lg" />
            <div className="h-32 bg-bg-secondary rounded-lg" />
            <div className="h-32 bg-bg-secondary rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-bg-primary border border-border-primary rounded-lg p-6 shadow-lg">
        <p className="text-red-400 text-sm text-center">
          Failed to load latest race
        </p>
      </div>
    );
  }

  const year = new Date(data.date).getFullYear();
  const formattedDate = new Date(data.date).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const flag = getCircuitFlagEmoji(data.circuit_name);

  const trackMapUrl = `/track-maps/${data.circuit_id}.png`;

  return (
    <div className="bg-bg-primary border border-border-primary rounded-lg p-6 shadow-lg hover:border-purple-500/30 transition-all duration-300">
      {/* Header with Track Map */}
      <div className="flex items-start justify-between gap-6 mb-6">
        {/* Race Info - Left Side */}
        <div className="flex-1 text-center">
          <h3 className="text-xl font-bold text-text-primary mb-2">
            {data.event_name}
          </h3>
          <div className="text-3xl mb-2">{flag}</div>
          <span className="inline-block px-2.5 py-0.5 text-[10px] font-semibold text-text-tertiary uppercase tracking-wider bg-bg-secondary border border-border-primary rounded-full mb-1.5">
            Grand Prix
          </span>
          <p className="text-xs text-text-tertiary mt-1.5">{data.circuit_name}</p>
          <p className="text-xs text-text-muted mt-0.5">{formattedDate}</p>
        </div>

        {/* Track Map - Right Side */}
        <div className="flex-shrink-0">
          <Image
            src={trackMapUrl}
            alt={`${data.circuit_name} track map`}
            width={160}
            height={160}
            className="object-contain"
          />
        </div>
      </div>

      {/* Top 3 Finishers - Grid Layout (Smaller Cards) */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {data.podium.map((driver, index) => {
          const position = index + 1;
          const positionColor =
            position === 1
              ? "text-yellow-400 bg-yellow-400/10 border-yellow-400/30"
              : position === 2
                ? "text-gray-300 bg-gray-300/10 border-gray-300/30"
                : "text-amber-600 bg-amber-600/10 border-amber-600/30";

          const driverFlag = driver.country_code
            ? getDriverFlagEmoji(driver.country_code)
            : "";

          return (
            <div
              key={driver.driver_code}
              className="relative bg-bg-secondary border border-border-primary rounded-lg p-2 hover:border-purple-500/50 transition-all duration-200 group"
              style={{
                borderTopColor: driver.team_color
                  ? `#${driver.team_color}`
                  : undefined,
                borderTopWidth: "3px",
              }}
            >
              {/* Position Badge - Smaller */}
              <div
                className={`absolute -top-2 -left-2 w-7 h-7 rounded-full ${positionColor} border-2 border-bg-primary flex items-center justify-center font-bold text-sm shadow-md`}
              >
                {position}
              </div>

              {/* Driver Info - Centered & Compact */}
              <div className="flex flex-col items-center gap-1.5 mt-0.5">
                {driver.headshot_url ? (
                  <img
                    src={driver.headshot_url}
                    alt={driver.full_name}
                    className="w-10 h-10 rounded-full object-cover bg-bg-primary border border-border-primary group-hover:border-purple-500/50 transition-all duration-200"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-bg-primary flex items-center justify-center text-text-muted font-bold border border-border-primary text-xs">
                    {driver.driver_code}
                  </div>
                )}

                <div className="text-center">
                  <Link
                    href={`/drivers/${driver.driver_code}`}
                    className="font-bold text-text-primary text-sm hover:text-purple-400 transition-colors inline-flex items-center gap-1"
                  >
                    {driverFlag && (
                      <span className="text-xs">{driverFlag}</span>
                    )}
                    {driver.driver_code}
                  </Link>
                  <p className="text-[10px] text-text-tertiary mt-0.5 truncate max-w-[100px]">
                    {driver.team_name}
                  </p>
                  {driver.fastest_lap && (
                    <div className="mt-1 inline-flex items-center gap-0.5 px-1 py-0.5 bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-full text-[9px] font-semibold">
                      <svg
                        className="w-2 h-2"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <title>Fastest Lap</title>
                        <path d="M10 2L13 8L19 9L14.5 13.5L15.5 19L10 16L4.5 19L5.5 13.5L1 9L7 8L10 2Z" />
                      </svg>
                      FL
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* View Full Results Link */}
      <div className="pt-4 border-t border-border-primary">
        <Link
          href={`/results/${year}/${data.round}`}
          className="block text-center px-3 py-2 text-xs font-semibold bg-bg-secondary text-text-tertiary border border-border-primary rounded-lg hover:border-purple-500/50 hover:text-purple-400 hover:bg-purple-500/5 transition-all duration-200"
        >
          View Full Results →
        </Link>
      </div>
    </div>
  );
}
