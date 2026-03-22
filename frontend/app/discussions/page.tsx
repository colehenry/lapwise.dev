"use client";

import type { InfiniteData } from "@tanstack/react-query";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  return (
    <Suspense>
      <DiscussionsFeed />
    </Suspense>
  );
}

function DiscussionsFeed() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const sort = (searchParams.get("sort") === "top" ? "top" : "new") as
    | "new"
    | "top";
  const activeTag = searchParams.get("tag") || null;
  const searchParam = searchParams.get("q") || "";
  const [searchInput, setSearchInput] = useState(searchParam);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null) {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      const qs = params.toString();
      router.replace(qs ? `?${qs}` : "/discussions", { scroll: false });
    },
    [router, searchParams],
  );

  const setSort = useCallback(
    (value: "new" | "top") => {
      updateParams({ sort: value === "new" ? null : value });
    },
    [updateParams],
  );

  const setActiveTag = useCallback(
    (tag: string | null) => {
      updateParams({ tag });
    },
    [updateParams],
  );

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchInput(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        updateParams({ q: value || null });
      }, 300);
    },
    [updateParams],
  );

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
      queryKey: ["discussion-posts", sort, activeTag, searchParam],
      queryFn: ({ pageParam }) =>
        fetchPosts({
          cursor: pageParam,
          limit: PAGE_SIZE,
          sort,
          tag: activeTag,
          search: searchParam || null,
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
          <div className="relative flex-1 max-w-xs">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              aria-hidden="true"
            >
              <title>Search</title>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search discussions..."
              className="w-full pl-9 pr-3 py-1.5 text-xs font-mono bg-bg-tertiary border border-border-primary rounded-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-purple-500/60 transition-colors"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => handleSearchChange("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
              >
                <svg
                  className="w-3.5 h-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <title>Clear search</title>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>
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

            {!isLoading && allPosts.length === 0 && (
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
