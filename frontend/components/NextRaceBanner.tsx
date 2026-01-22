"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { getCircuitFlagEmoji } from "@/lib/flags";

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
    `${process.env.NEXT_PUBLIC_API_URL}/api/events/upcoming?limit=4`,
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Title */}
        <h2 className="text-3xl font-bold text-text-primary text-center mb-8">
          Upcoming Events
        </h2>

        {/* Events Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {events.map((event) => {
            const daysUntil = getDaysUntilEvent(event.event_date);
            const formattedDate = formatEventDate(event.event_date);
            const isTesting = event.event_type === "testing";
            const flag = getCircuitFlagEmoji(event.country);
            const year = new Date(event.event_date).getFullYear();

            // Determine link URL - projections for races, no link for testing
            const linkUrl =
              !isTesting && event.round_number
                ? `/projections/${year}/${event.round_number}`
                : null;

            const content = (
              <div
                key={`${event.event_date}-${event.event_name}`}
                className={`
                bg-bg-primary border border-border-primary rounded-lg p-4
                ${linkUrl ? "hover:border-purple-500/50 hover:bg-bg-primary/80 cursor-pointer transition-all duration-200" : ""}
              `}
              >
                <div className="flex items-center gap-4">
                  {/* Countdown - Vertical on Left */}
                  <div className="flex flex-col items-center justify-center border-r border-border-primary pr-3">
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
                  <div className="flex-1 text-center">
                    <h3 className="text-sm font-bold text-text-primary mb-2">
                      {event.event_name}
                    </h3>
                    <div className="text-3xl mb-2">{flag}</div>
                    <span className="text-xs font-semibold text-text-tertiary uppercase tracking-wider block mb-2">
                      {isTesting ? "Testing" : "Grand Prix"}
                    </span>
                    <p className="text-xs text-text-tertiary">
                      {event.location}
                    </p>
                    <p className="text-xs text-text-muted mt-1">
                      {formattedDate}
                    </p>
                  </div>
                </div>
              </div>
            );

            return linkUrl ? (
              <Link
                key={`${event.event_date}-${event.event_name}`}
                href={linkUrl}
              >
                {content}
              </Link>
            ) : (
              content
            );
          })}
        </div>
      </div>
    </div>
  );
}
