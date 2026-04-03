"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { ConcentricPattern, GridPattern } from "@/components/Patterns";
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
    month: "short",
    day: "numeric",
  });
}

export default function NextRaceBanner() {
  const calendarRef = useRef<HTMLDivElement>(null);

  const handleScrollClick = () => {
    const el = calendarRef.current;
    if (!el) return;
    const scrollIncrement = el.clientWidth * 0.5;
    el.scrollBy({ left: scrollIncrement, behavior: "smooth" });
  };

  const {
    data: events,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["upcoming-events"],
    queryFn: fetchUpcomingEvents,
    staleTime: 60 * 60 * 1000, // Cache for 1 hour
  });

  if (isLoading || error || !events || events.length === 0) {
    return null;
  }

  return (
    <section className="w-full bg-bg-primary py-12 px-6 relative overflow-hidden">
      <GridPattern
        id="calendar-grid"
        className="absolute inset-0 w-full h-full text-purple-500 opacity-[0.03] pointer-events-none"
      />

      <div className="max-w-6xl mx-auto relative z-10">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
            <span className="text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono">
              2026 Race Calendar
            </span>
          </div>
          <div className="hidden sm:flex items-center text-[10px] font-mono font-bold uppercase tracking-widest">
            <button
              type="button"
              onClick={handleScrollClick}
              className="group flex items-center gap-2 text-text-tertiary hover:text-purple-400 transition-colors duration-200 focus-visible:outline-none focus-visible:ring focus-visible:ring-purple-500 rounded"
              aria-label="Scroll through the race calendar"
            >
              <span className="transition-colors duration-200 group-hover:text-text-primary">
                Scroll
              </span>
              <svg
                className="w-3 h-3 animate-bounce-x"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 8l4 4m0 0l-4 4m4-4H3"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Horizontal Scrollable Events */}
        <div
          ref={calendarRef}
          className="overflow-x-auto overflow-y-visible -mx-6 px-6 pb-8 scrollbar-hide"
        >
          <div className="flex gap-5 min-w-min">
            {events.map((event) => {
              const daysUntil = getDaysUntilEvent(event.event_date);
              const formattedDate = formatEventDate(event.event_date);
              const isTesting = event.event_type === "testing";
              const flag = getCircuitFlagEmoji(event.country);
              const year = new Date(event.event_date).getFullYear();
              const lastYear = year - 1;

              // Map circuit IDs to correct track map files
              const TRACK_MAP_OVERRIDES: Record<number, number> = {
                83: 8, // Monaco duplicate circuit ID → correct track map
              };
              const trackMapId = event.circuit_id
                ? (TRACK_MAP_OVERRIDES[event.circuit_id] ?? event.circuit_id)
                : null;
              const isNewCircuit =
                event.event_name.includes("Madrid") || trackMapId === null;
              const showLastYearLink =
                !isTesting && event.round_number && !isNewCircuit;

              return (
                <div
                  key={`${event.event_date}-${event.event_name}`}
                  className="flex-shrink-0 w-[240px]"
                >
                  <div className="bg-bg-tertiary border border-border-primary rounded-sm overflow-hidden group hover:border-purple-500/50 transition-all duration-300 shadow-lg shadow-black/20">
                    <div className="p-5 flex flex-col items-center text-center">
                      {/* Top: Track Map Area (Flag removed from here) */}
                      <div className="relative w-full h-24 mb-4 bg-bg-secondary/50 rounded-sm overflow-hidden border border-border-primary/30 flex items-center justify-center">
                        <ConcentricPattern
                          id={`event-pattern-${event.event_date}`}
                          className="absolute inset-0 w-full h-full opacity-10 pointer-events-none"
                        />
                        {trackMapId ? (
                          <Image
                            src={`/track-maps/${trackMapId}.png`}
                            alt={event.circuit_name || ""}
                            width={120}
                            height={120}
                            className="object-contain relative z-10 opacity-60 mix-blend-lighten max-h-[80px]"
                          />
                        ) : (
                          <div className="text-[10px] text-text-muted font-mono uppercase tracking-widest relative z-10">
                            No map available
                          </div>
                        )}
                      </div>

                      {/* Event Identification */}
                      <span className="text-[10px] font-mono font-bold text-purple-400 uppercase tracking-widest mb-1">
                        {isTesting
                          ? "Testing Session"
                          : `Round ${String(event.round_number).padStart(2, "0")}`}
                      </span>

                      {/* GP Name with Flag inline before it */}
                      <div className="flex items-center gap-2 mb-4 max-w-full">
                        <span className="text-lg flex-shrink-0 transform group-hover:scale-110 transition-transform duration-300">
                          {flag}
                        </span>
                        <h3 className="text-base font-bold text-text-primary leading-tight line-clamp-1">
                          {event.event_name.replace("Grand Prix", "GP")}
                        </h3>
                      </div>

                      {/* Countdown */}
                      <div className="flex flex-col items-center mb-5">
                        <span className="text-4xl font-bold text-text-primary font-mono tracking-tighter leading-none">
                          {daysUntil}
                        </span>
                        <span className="text-[9px] font-bold text-text-muted uppercase tracking-widest font-mono mt-1">
                          Days Remaining
                        </span>
                      </div>

                      {/* Location & Date */}
                      <div className="flex flex-col items-center gap-1 mb-6">
                        <div className="flex items-center gap-1.5 text-text-secondary">
                          <svg
                            className="w-3 h-3"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                            />
                          </svg>
                          <span className="text-[10px] font-bold uppercase tracking-wide">
                            {event.location}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-text-muted">
                          <span className="text-[10px] font-mono font-bold">
                            {formattedDate}, {year}
                          </span>
                        </div>
                      </div>

                      {/* CTA Footer */}
                      <div className="w-full pt-4 border-t border-border-primary/40 flex items-center justify-center">
                        {isNewCircuit && !isTesting ? (
                          <span className="text-[9px] font-bold font-mono tracking-widest uppercase text-purple-400 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                            New Circuit
                          </span>
                        ) : showLastYearLink ? (
                          <Link
                            href={`/results/${lastYear}`}
                            className="text-[9px] font-bold font-mono tracking-widest uppercase text-text-muted hover:text-purple-400 transition-colors flex items-center gap-1.5 group/btn"
                          >
                            View {lastYear} Season
                            <svg
                              className="w-2.5 h-2.5 group-hover/btn:translate-x-0.5 transition-transform"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              aria-hidden="true"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 5l7 7-7 7"
                              />
                            </svg>
                          </Link>
                        ) : (
                          <span className="text-[9px] font-bold font-mono tracking-widest uppercase text-text-tertiary">
                            Race Debrief Coming
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
