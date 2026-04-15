"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { GridPattern } from "@/components/Patterns";
import Skeleton from "@/components/ui/Skeleton";
import TiltCard from "@/components/ui/TiltCard";
import { apiHeaders, apiUrl, isValidHeadshotUrl } from "@/lib/api";
import { fetchPosts } from "@/lib/discussions";
import { constructorHref, driverHref } from "@/lib/entityLinks";
import type { PostListResponse, RoundSummary } from "@/lib/types";

export default function HomeDiscussionSection() {
  const { data: latestRace, isLoading: raceLoading } = useQuery<RoundSummary>({
    queryKey: ["latest-race"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/results/latest"), {
        headers: apiHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch latest race");
      return res.json();
    },
    staleTime: 1000 * 60 * 10,
  });

  const { data: postsData, isLoading: postsLoading } =
    useQuery<PostListResponse>({
      queryKey: ["home-discussions"],
      queryFn: () => fetchPosts({ limit: 4, sort: "new" }),
      staleTime: 1000 * 60 * 5,
    });

  if (raceLoading) {
    return (
      <section className="py-16 px-6 bg-bg-primary">
        <div className="max-w-5xl mx-auto">
          <Skeleton className="h-64 w-full" />
        </div>
      </section>
    );
  }

  const posts = postsData?.posts || [];
  const podium = latestRace?.podium || [];
  const currentYear = latestRace
    ? new Date(latestRace.date).getFullYear()
    : null;

  return (
    <section className="py-20 px-6 bg-bg-primary relative overflow-hidden">
      <GridPattern
        id="discussion-grid"
        className="absolute inset-0 w-full h-full text-purple-500 opacity-[0.03] pointer-events-none"
      />

      <div className="max-w-5xl mx-auto relative z-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-purple-500" />
              <span className="text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono">
                Community & Analysis
              </span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-text-primary tracking-tight">
              Race Debriefs & <span className="text-purple-400">Analysis</span>
            </h2>
          </div>
          <Link
            href="/discussions"
            className="inline-flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-widest text-text-muted hover:text-purple-400 transition-colors group"
          >
            Explore All Discussions
            <svg
              className="w-4 h-4 group-hover:translate-x-1 transition-transform"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <title>Discussions</title>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 8l4 4m0 0l-4 4m4-4H3"
              />
            </svg>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Results "Little Cards" */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest font-mono">
                Top Finishers
              </span>
              <Link
                href={`/results/${currentYear}/${latestRace?.round}`}
                className="text-[10px] font-bold text-purple-400 uppercase tracking-widest font-mono hover:underline"
              >
                Full Results
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {podium.map((driver, idx) => (
                <TiltCard key={driver.driver_code}>
                  <div className="bg-bg-tertiary border border-border-primary rounded-sm p-3 flex items-center gap-4 hover:border-purple-500/40 transition-colors">
                    <div className="w-8 text-center font-mono font-bold text-lg text-text-muted">
                      {idx + 1}
                    </div>
                    <div className="relative w-10 h-10 bg-bg-secondary border border-border-primary rounded-sm overflow-hidden flex-shrink-0">
                      {isValidHeadshotUrl(driver.headshot_url) ? (
                        <Image
                          src={driver.headshot_url}
                          alt={driver.full_name}
                          fill
                          className="object-cover scale-110 translate-y-1"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-text-muted font-mono text-xs">
                          {driver.driver_code}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Link
                          href={driverHref(driver) ?? "/drivers"}
                          className="text-sm font-bold text-text-primary truncate hover:text-purple-300 transition-colors"
                        >
                          {driver.full_name}
                        </Link>
                        <span
                          className="text-[10px] font-mono font-bold"
                          style={{
                            color: driver.team_color
                              ? `#${driver.team_color}`
                              : "#fff",
                          }}
                        >
                          {driver.driver_code}
                        </span>
                      </div>
                      <Link
                        href={
                          constructorHref(driver.team_name) ?? "/constructors"
                        }
                        className="text-[10px] text-text-muted truncate uppercase tracking-wider hover:text-purple-300 transition-colors"
                      >
                        {driver.team_name}
                      </Link>
                    </div>
                    {driver.fastest_lap && (
                      <div title="Fastest Lap" className="text-purple-400">
                        <svg
                          className="w-4 h-4"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z" />
                        </svg>
                      </div>
                    )}
                  </div>
                </TiltCard>
              ))}
            </div>
          </div>

          {/* Discussion Feed */}
          <div className="lg:col-span-7 space-y-4">
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest font-mono">
              Latest Debriefs
            </span>
            <div className="space-y-3">
              {postsLoading ? (
                [1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-24 w-full rounded-sm" />
                ))
              ) : posts.length > 0 ? (
                posts.map((post) => (
                  <Link
                    key={post.id}
                    href={`/discussions/${post.id}`}
                    className="block group"
                  >
                    <div className="bg-bg-tertiary/60 border border-border-primary rounded-sm p-4 hover:border-purple-500/50 hover:bg-bg-tertiary transition-all">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full border border-purple-500/30 text-purple-400 uppercase tracking-widest font-mono font-bold">
                          {post.post_type}
                        </span>
                        <span className="text-[10px] text-text-muted font-mono">
                          by {post.author.username}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-text-primary group-hover:text-purple-300 transition-colors">
                        {post.title}
                      </h4>
                      <p className="text-[11px] text-text-tertiary line-clamp-1 mt-1">
                        {post.body}
                      </p>
                    </div>
                  </Link>
                ))
              ) : (
                <p className="text-xs text-text-muted font-mono italic">
                  No recent discussions found.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
