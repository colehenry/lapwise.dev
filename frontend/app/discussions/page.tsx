"use client";

import type { InfiniteData } from "@tanstack/react-query";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import PostCard from "@/components/discussions/PostCard";
import SortSelector from "@/components/discussions/SortSelector";
import TagFilter from "@/components/discussions/TagFilter";
import TagPill from "@/components/discussions/TagPill";
import { GridPattern } from "@/components/Patterns";
import Skeleton from "@/components/ui/Skeleton";
import { fetchPosts, fetchTags } from "@/lib/discussions";
import type { PostListItem, PostListResponse } from "@/lib/types";

const PAGE_SIZE = 20;
const SKELETON_KEYS = ["a", "b", "c", "d"];

export default function DiscussionsPage() {
  const { isAuthenticated } = useAuth();
  const [sort, setSort] = useState<"new" | "top" | "hot">("new");
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const { data: tags = [] } = useQuery({
    queryKey: ["discussion-tags"],
    queryFn: fetchTags,
    staleTime: 1000 * 60 * 5,
  });

  const sortParam = sort === "hot" ? "top" : sort;

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery<
      PostListResponse,
      Error,
      InfiniteData<PostListResponse, string | null>,
      (string | null)[],
      string | null
    >({
      queryKey: ["discussion-posts", sort, activeTag],
      queryFn: ({ pageParam }) =>
        fetchPosts({
          cursor: pageParam,
          limit: PAGE_SIZE,
          sort: sortParam,
          tag: activeTag,
        }),
      initialPageParam: null,
      getNextPageParam: (lastPage) => lastPage.next_cursor ?? null,
    });

  const allPosts = useMemo(() => {
    if (!data?.pages) return [] as PostListItem[];
    return data.pages.flatMap((page) => page.posts);
  }, [data]);

  const pinnedPosts = allPosts.filter((post) => post.is_pinned);
  const regularPosts = allPosts.filter((post) => !post.is_pinned);

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const newPostHref = isAuthenticated
    ? "/discussions/new"
    : "/login?redirect=/discussions/new";

  return (
    <div className="min-h-screen bg-bg-secondary">
      <div className="relative overflow-hidden border-b border-border-primary">
        <GridPattern
          id="discussions-grid"
          className="absolute inset-0 w-full h-full text-purple-500 opacity-[0.06] pointer-events-none"
        />
        <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-8 py-10">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                <span className="text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono">
                  Community Discussions
                </span>
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-text-primary tracking-tight">
                Race Debriefs & Analysis
              </h1>
              <p className="text-text-tertiary mt-3 max-w-2xl">
                Share insights, ask questions, and break down every lap with the
                Lapwise community.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={newPostHref}
                className="inline-flex items-center gap-2 border border-purple-500/60 bg-purple-500/15 text-purple-200 font-mono text-xs uppercase tracking-widest px-4 py-2 rounded-sm hover:bg-purple-500/25 transition-colors"
              >
                New Post
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <title>Create post</title>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 5v14m7-7H5"
                  />
                </svg>
              </Link>
              {!isAuthenticated && (
                <span className="text-[10px] font-mono uppercase tracking-widest text-text-muted">
                  Log in to publish
                </span>
              )}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-6">
            <SortSelector value={sort} onChange={setSort} />
            {sort === "hot" && (
              <span className="text-[10px] font-mono uppercase tracking-widest text-text-muted">
                Hot ranking uses top votes for now
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-5">
            <div className="border border-border-primary rounded-sm bg-bg-tertiary/40 p-3">
              <TagFilter
                tags={tags}
                activeTag={activeTag}
                onChange={setActiveTag}
              />
            </div>

            {pinnedPosts.length > 0 && (
              <div className="space-y-3">
                <div className="text-[10px] font-mono uppercase tracking-widest text-text-muted">
                  Pinned
                </div>
                {pinnedPosts.map((post) => (
                  <PostCard key={`pinned-${post.id}`} post={post} />
                ))}
              </div>
            )}

            <div className="space-y-4">
              {isLoading &&
                SKELETON_KEYS.map((key) => (
                  <Skeleton
                    key={`post-skeleton-${key}`}
                    variant="rectangular"
                    height="140px"
                    className="rounded-sm"
                  />
                ))}

              {!isLoading && regularPosts.length === 0 && (
                <div className="border border-dashed border-border-primary rounded-sm p-6 text-sm text-text-muted">
                  No discussions found for this filter yet.
                </div>
              )}

              {regularPosts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}

              <div ref={sentinelRef} />

              {isFetchingNextPage && (
                <div className="text-xs font-mono uppercase tracking-widest text-text-muted">
                  Loading more discussions...
                </div>
              )}
            </div>
          </div>

          <aside className="lg:col-span-4 space-y-5">
            <div className="border border-border-primary rounded-sm bg-bg-tertiary p-4">
              <div className="text-[10px] font-mono uppercase tracking-widest text-text-muted mb-4">
                Community Stats
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-2xl font-bold text-purple-300 font-mono">
                    {allPosts.length}
                  </div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-text-muted">
                    Loaded Posts
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-purple-300 font-mono">
                    {tags.length}
                  </div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-text-muted">
                    Active Tags
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-purple-300 font-mono">
                    {pinnedPosts.length}
                  </div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-text-muted">
                    Pinned Threads
                  </div>
                </div>
              </div>
            </div>

            <div className="border border-border-primary rounded-sm bg-bg-tertiary p-4">
              <div className="text-[10px] font-mono uppercase tracking-widest text-text-muted mb-4">
                Trending Tags
              </div>
              <div className="flex flex-wrap gap-2">
                {tags.slice(0, 10).map((tag) => (
                  <TagPill
                    key={tag.id}
                    label={tag.name}
                    color={tag.color}
                    onClick={() => setActiveTag(tag.slug)}
                  />
                ))}
                {tags.length === 0 && (
                  <span className="text-sm text-text-muted">No tags yet.</span>
                )}
              </div>
            </div>

            <div className="border border-border-primary rounded-sm bg-bg-tertiary p-4">
              <div className="text-[10px] font-mono uppercase tracking-widest text-text-muted mb-3">
                Posting Tips
              </div>
              <ul className="text-sm text-text-tertiary space-y-2">
                <li>Include lap numbers, telemetry, or race context.</li>
                <li>Use tags to help others discover your post.</li>
                <li>Be specific with questions or insights.</li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
