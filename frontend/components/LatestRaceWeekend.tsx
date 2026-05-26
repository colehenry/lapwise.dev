"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { ConcentricPattern } from "@/components/Patterns";
import TrackMapImage from "@/components/TrackMapImage";
import Skeleton from "@/components/ui/Skeleton";
import TiltCard from "@/components/ui/TiltCard";
import { apiHeaders, apiUrl, isValidHeadshotUrl } from "@/lib/api";
import type { RoundSummary } from "@/lib/types";

export default function LatestRaceWeekend() {
  const { data, isLoading, isError } = useQuery<RoundSummary>({
    queryKey: ["latest-race"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/results/latest"), {
        headers: apiHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch latest race");
      return res.json();
    },
    staleTime: 1000 * 60 * 10,
    retry: 1,
  });

  if (isLoading) {
    return (
      <section className="bg-bg-primary py-8 px-6">
        <div className="max-w-5xl mx-auto">
          <Skeleton className="h-40 w-full rounded-sm" />
        </div>
      </section>
    );
  }

  if (isError || !data?.podium) return null;

  const currentYear = new Date(data.date).getFullYear();

  return (
    <section className="bg-bg-primary py-8 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-2 h-2 rounded-full bg-purple-500" />
          <span className="text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono">
            Latest Race Weekend
          </span>
        </div>

        <TiltCard>
          <Link
            href={`/results/${currentYear}/${data.round}`}
            className="block group bg-bg-tertiary border border-border-primary rounded-sm overflow-hidden hover:border-purple-500 hover:shadow-purple transition-all duration-150"
          >
            <div className="flex flex-col md:flex-row">
              {/* Left: Race Info */}
              <div className="flex-1 p-5 relative">
                <div className="relative z-10">
                  <span className="text-[10px] text-text-muted tracking-widest uppercase font-mono font-bold">
                    RND {String(data.round).padStart(2, "0")}
                  </span>
                  <h3 className="text-xl font-bold text-text-primary mt-1">
                    {data.event_name}
                  </h3>
                  <p className="text-text-muted text-xs tracking-wide mt-1">
                    {data.circuit_name} &bull;{" "}
                    {new Date(data.date).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>

                  {/* Podium */}
                  <div className="flex items-center gap-4 mt-4">
                    {data.podium.map((driver, idx) => {
                      const medals = ["\u{1F947}", "\u{1F948}", "\u{1F949}"];
                      return (
                        <div
                          key={driver.driver_code}
                          className="flex items-center gap-1.5"
                        >
                          <span className="text-lg">{medals[idx]}</span>
                          {isValidHeadshotUrl(driver.headshot_url) && (
                            <Image
                              src={driver.headshot_url as string}
                              alt={driver.full_name}
                              width={28}
                              height={28}
                              className="rounded-sm object-cover border border-border-secondary"
                            />
                          )}
                          <span
                            className="font-bold text-xs font-mono"
                            style={{
                              color: driver.team_color
                                ? `#${driver.team_color}`
                                : "#fff",
                            }}
                          >
                            {driver.driver_code}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Right: Track map + CTA */}
              <div className="md:w-56 bg-bg-primary border-t md:border-t-0 md:border-l border-border-primary relative flex flex-col items-center justify-center p-4 overflow-hidden min-h-[140px]">
                <ConcentricPattern id="latest-race-pattern" />
                <TrackMapImage
                  circuitId={data.circuit_id}
                  circuitName={data.circuit_name}
                  width={140}
                  height={80}
                  className="object-contain relative z-10 opacity-85 mb-3"
                  fallbackClassName="relative z-10 mb-3 h-20 w-full px-3"
                />
                <span className="relative z-10 text-[10px] tracking-widest text-purple-300 font-bold uppercase font-mono group-hover:text-purple-200 transition-colors duration-150 flex items-center gap-1">
                  Explore Full Race Weekend
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <title>Arrow right</title>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 7l5 5m0 0l-5 5m5-5H6"
                    />
                  </svg>
                </span>
              </div>
            </div>
          </Link>
        </TiltCard>
      </div>
    </section>
  );
}
