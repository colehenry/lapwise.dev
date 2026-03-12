"use client";

import type { InfiniteData } from "@tanstack/react-query";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import PostCard from "@/components/discussions/PostCard";
import SortSelector from "@/components/discussions/SortSelector";
import TagFilter from "@/components/discussions/TagFilter";
import PageHeader from "@/components/PageHeader";
import MonoLabel from "@/components/ui/MonoLabel";
import Skeleton from "@/components/ui/Skeleton";
import { fetchPosts, fetchTags } from "@/lib/discussions";
import type { PostListItem, PostListResponse } from "@/lib/types";

const PAGE_SIZE = 20;
const SKELETON_KEYS = ["a", "b", "c", "d"];

export default function DiscussionsPage() {
  const { isAuthenticated } = useAuth();
  const [sort, setSort] = useState<"new" | "top">("new");
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const { data: tags = [] } = useQuery({
    queryKey: ["discussion-tags"],
    queryFn: fetchTags,
    staleTime: 1000 * 60 * 5,
  });

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
          sort,
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
      <PageHeader
        title="Discussions"
        subtitle="Community Analysis & Race Debriefs"
      >
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
      </PageHeader>

      <div className="max-w-6xl mx-auto px-4 md:px-8 py-6">
        <div className="flex flex-wrap items-center gap-6 mb-6">
          <SortSelector value={sort} onChange={setSort} />
          {!isAuthenticated && <MonoLabel>Log in to publish</MonoLabel>}
        </div>

        <div className="space-y-5">
          <div className="border border-border-primary rounded-sm bg-bg-tertiary/40 p-3">
            <TagFilter
              tags={tags}
              activeTag={activeTag}
              onChange={setActiveTag}
            />
          </div>

          {pinnedPosts.length > 0 && (
            <div className="space-y-3">
              <MonoLabel as="div">Pinned</MonoLabel>
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
      </div>
    </div>
  );
}
