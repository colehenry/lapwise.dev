"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { apiHeaders, apiUrl } from "@/lib/api";
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
  const res = await fetch(apiUrl("/api/events/upcoming?limit=10"), {
    headers: apiHeaders(),
  });

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
    <section className="w-full bg-bg-secondary py-10 px-6 border-y border-border-primary/60">
      <div className="max-w-5xl mx-auto">
        <div>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-2 h-2 rounded-full bg-purple-500" />
            <span className="text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono">
              Race Calendar
            </span>
          </div>

          {/* Horizontal Scrollable Events */}
          <div className="overflow-x-auto overflow-y-hidden -mx-6 px-6 scrollbar-permanent">
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
                    className="flex-shrink-0 w-56 bg-bg-tertiary border border-border-primary rounded-sm p-3 hover:border-purple-500/60 transition-all duration-200"
                  >
                    <div className="flex items-center gap-3">
                      {/* Countdown - Vertical on Left */}
                      <div className="flex flex-col items-center justify-center border-r border-border-primary pr-3 min-w-[44px]">
                        <span className="text-[9px] font-bold text-text-muted uppercase tracking-widest font-mono">
                          In
                        </span>
                        <span className="text-xl font-bold text-text-primary my-0.5 font-mono">
                          {daysUntil}
                        </span>
                        <span className="text-[9px] font-bold text-text-muted uppercase tracking-widest font-mono">
                          {daysUntil === 1 ? "Day" : "Days"}
                        </span>
                      </div>

                      {/* Event Info - Right Side */}
                      <div className="flex-1 text-center flex flex-col min-h-[140px]">
                        <h3 className="text-sm font-semibold text-text-primary tracking-tight mb-1 truncate">
                          {event.event_name.replace("Grand Prix", "GP")}
                        </h3>
                        <div className="text-2xl mb-1">{flag}</div>
                        <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest font-mono block mb-1">
                          {isTesting ? "Testing" : "GP"}
                        </span>
                        <p className="text-xs text-text-secondary truncate">
                          {event.location}
                        </p>
                        <p className="text-xs text-text-muted mt-0.5 mb-2 truncate font-mono">
                          {formattedDate}
                        </p>

                        {/* Action Button/Badge */}
                        {isNewCircuit && !isTesting && (
                          <div className="mt-auto">
                            <span className="inline-block px-2 py-0.5 text-[10px] font-bold font-mono tracking-widest uppercase bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-sm">
                              New Circuit
                            </span>
                          </div>
                        )}
                        {showLastYearLink && (
                          <div className="mt-auto">
                            <Link
                              href={`/results/${lastYear}/${event.round_number}`}
                              className="inline-block px-2 py-0.5 text-[10px] font-bold font-mono tracking-widest uppercase bg-bg-secondary text-text-tertiary border border-border-primary rounded-sm hover:border-purple-500/50 hover:text-purple-400 transition-colors duration-200"
                            >
                              {lastYear} Results
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
    </section>
  );
}
