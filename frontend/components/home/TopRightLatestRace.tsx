"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ConcentricPattern } from "@/components/layout/Patterns";
import TrackMapImage from "@/components/track/TrackMapImage";
import Skeleton from "@/components/ui/Skeleton";
import { isValidHeadshotUrl } from "@/lib/api";
import { circuitHref, driverHref } from "@/lib/entityLinks";
import { latestRoundQuery } from "@/lib/queries/seasons";

const formatGap = (
  time: number | null | undefined,
  winnerTime: number | null | undefined,
) => {
  if (
    typeof time !== "number" ||
    typeof winnerTime !== "number" ||
    winnerTime === 0
  )
    return "—";
  let gapValue: number;
  if (time < winnerTime / 2) {
    gapValue = time;
  } else {
    gapValue = time - winnerTime;
  }
  if (Math.abs(gapValue) < 0.001) return "Winner";
  return `+${gapValue.toFixed(3)}`;
};

export default function TopRightLatestRace() {
  const [showTooltip, setShowTooltip] = useState(false);
  const [showDiscussionTooltip, setShowDiscussionTooltip] = useState(false);

  const { data, isLoading, isError } = useQuery(latestRoundQuery());

  if (isLoading) {
    return (
      <div className="w-full max-w-2xl">
        <Skeleton className="h-[260px] w-full rounded-sm md:h-[300px]" />
      </div>
    );
  }

  if (isError || !data?.podium) return null;

  const winner = data.podium[0];
  const currentYear = new Date(data.date).getFullYear();
  const gpName = data.event_name.replace("Grand Prix", "GP");

  return (
    <div className="w-full max-w-2xl group relative">
      <div className="absolute -inset-1 bg-gradient-to-r from-purple-500/20 to-red-500/20 rounded-sm blur opacity-20 group-hover:opacity-30 transition duration-500" />

      <div className="relative overflow-visible bg-bg-tertiary border border-border-primary rounded-sm flex flex-col md:flex-row min-h-[260px] md:min-h-[300px]">
        {/* Left: Results & Discussion CTA */}
        <div className="flex-1 p-4 md:p-6 md:pr-10 relative z-10 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <span className="text-[10px] text-purple-400 font-bold uppercase tracking-widest font-mono whitespace-nowrap">
                Latest GP Results
              </span>
              <div className="w-1 h-1 rounded-full bg-border-primary shrink-0" />
              <span className="text-[10px] text-text-muted font-bold uppercase tracking-widest font-mono whitespace-nowrap">
                RND {data.round}
              </span>
            </div>

            <h3 className="text-xl md:text-2xl font-bold text-text-primary leading-tight mb-0.5">
              {data.event_name}
            </h3>
            <Link
              href={circuitHref(data.circuit_id) ?? "/circuits"}
              className="inline-flex text-[11px] text-text-muted font-mono uppercase tracking-wider mb-4 md:mb-5 hover:text-purple-300 transition-colors"
            >
              {data.circuit_name}
            </Link>

            <div className="space-y-2.5 mb-5 md:space-y-3 md:mb-8">
              {data.podium.map((driver, idx) => (
                <div
                  key={driver.driver_slug ?? `${driver.full_name}-${idx}`}
                  className="flex items-center gap-3"
                >
                  <span className="w-4 text-[10px] font-bold text-text-muted font-mono shrink-0">
                    P{idx + 1}
                  </span>

                  <div className="relative w-8 h-8 bg-bg-secondary border border-border-primary rounded-sm overflow-hidden shrink-0">
                    {isValidHeadshotUrl(driver.headshot_url) ? (
                      <Image
                        src={driver.headshot_url as string}
                        alt={driver.full_name}
                        fill
                        className="object-cover scale-110 translate-y-1"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-text-muted font-mono text-[10px]">
                        {driver.driver_code}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 flex items-center justify-between border-b border-border-primary/40 pb-1">
                    <Link
                      href={driverHref(driver) ?? "/drivers"}
                      className="text-sm font-bold text-text-primary mr-3 truncate md:mr-4 hover:text-purple-300 transition-colors"
                    >
                      {driver.full_name}
                    </Link>
                    <span
                      className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-sm bg-bg-secondary whitespace-nowrap shrink-0"
                      style={{
                        color: driver.team_color
                          ? `#${driver.team_color}`
                          : "var(--text-primary)",
                        borderColor: driver.team_color
                          ? `#${driver.team_color}40`
                          : "transparent",
                        borderWidth: "1px",
                      }}
                    >
                      {idx === 0
                        ? "WINNER"
                        : formatGap(driver.time_seconds, winner.time_seconds)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 md:gap-6 relative">
            <Link
              href={`/results/${currentYear}/${data.round}`}
              className="px-4 py-2 bg-purple-500 text-text-primary text-[10px] font-bold uppercase tracking-widest rounded-sm hover:bg-purple-600 transition-colors shadow-lg shadow-purple-500/20 whitespace-nowrap"
            >
              Full Results
            </Link>

            <div className="relative">
              <Link
                href={`/results/${currentYear}/${data.round}#comments`}
                className="text-[10px] font-bold text-text-muted uppercase tracking-widest hover:text-purple-400 transition-colors flex items-center gap-2 group/link whitespace-nowrap"
                onMouseEnter={() => setShowDiscussionTooltip(true)}
                onMouseLeave={() => setShowDiscussionTooltip(false)}
              >
                Join Discussion
                <svg
                  className="w-3.5 h-3.5 transform group-hover/link:translate-x-1 transition-transform duration-200"
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
              </Link>

              {showDiscussionTooltip && (
                <div className="absolute left-0 top-full mt-3 z-50 animate-in fade-in slide-in-from-top-1 duration-200 min-w-[220px]">
                  <div className="bg-bg-tertiary border border-border-primary px-3 py-2 rounded-sm shadow-2xl backdrop-blur-xl ring-1 ring-white/10">
                    <p className="text-[10px] text-text-primary font-bold leading-relaxed whitespace-nowrap">
                      What&apos;d you think about the{" "}
                      <span className="text-purple-400">{gpName}</span>?
                    </p>
                    <div className="absolute -top-1 left-4 w-2 h-2 bg-bg-tertiary border-t border-l border-border-primary rotate-45" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Track Map */}
        <Link
          href={circuitHref(data.circuit_id) ?? "/circuits"}
          className="h-36 md:h-auto md:w-64 bg-bg-secondary/40 border-t md:border-t-0 md:border-l border-border-primary relative flex items-center justify-center p-6 md:p-8 overflow-hidden group/map shrink-0"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <ConcentricPattern id="latest-hero-pattern" />
          <div className="relative z-10 w-full h-full flex items-center justify-center transition-transform duration-500 ease-out group-hover/map:scale-110">
            <TrackMapImage
              circuitId={data.circuit_id}
              circuitName={data.circuit_name}
              width={200}
              height={200}
              className="object-contain opacity-85 scale-[1.25]"
              fallbackClassName="h-full w-full px-3"
            />
          </div>

          {showTooltip && (
            <div className="absolute inset-x-0 bottom-4 flex justify-center z-30 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="bg-bg-tertiary border border-border-primary px-3 py-1.5 rounded-sm shadow-xl backdrop-blur-md">
                <p className="text-[10px] font-bold text-text-primary uppercase tracking-widest font-mono text-center whitespace-nowrap">
                  Explore Circuit
                </p>
                <p className="text-[9px] text-text-muted font-mono uppercase tracking-wider text-center whitespace-nowrap">
                  {data.circuit_location}, {data.circuit_country}
                </p>
              </div>
            </div>
          )}
        </Link>
      </div>
    </div>
  );
}
