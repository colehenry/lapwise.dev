"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import PostCard from "@/components/discussions/PostCard";
import UserAvatar from "@/components/discussions/UserAvatar";
import FavoritesPicker from "@/components/favorites/FavoritesPicker";
import Button from "@/components/ui/Button";
import Skeleton from "@/components/ui/Skeleton";
import { apiHeaders, apiUrl, isValidHeadshotUrl } from "@/lib/api";
import { fetchWithAuth } from "@/lib/auth";
import type {
  PostListItem,
  PostListResponse,
  UserPublicProfile,
} from "@/lib/types";

export default function ProfilePage() {
  const params = useParams();
  const username = params.username as string;
  const { user: currentUser, refreshUser } = useAuth();
  const isOwnProfile = currentUser?.username === username;
  const [showPicker, setShowPicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const { data: profile, isLoading } = useQuery<UserPublicProfile>({
    queryKey: ["profile", username],
    queryFn: async () => {
      const res = await fetchWithAuth(apiUrl(`/api/users/${username}`));
      if (!res.ok) throw new Error("Profile not found");
      return res.json();
    },
  });

  const {
    data: postsData,
    isLoading: postsLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<PostListResponse>({
    queryKey: ["user-posts", profile?.username],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({
        author_username: profile?.username ?? username,
        sort: "new",
        limit: "10",
      });
      if (pageParam) params.set("cursor", pageParam as string);
      const res = await fetch(apiUrl(`/api/posts?${params}`), {
        headers: apiHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch posts");
      return res.json();
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.next_cursor,
    enabled: !!profile?.username,
  });

  const allPosts =
    postsData?.pages.flatMap((page) => page.posts as PostListItem[]) ?? [];

  const handleSaveFavorites = useCallback(
    async (favorites: {
      favorite_driver_slug: string | null;
      favorite_team_name: string | null;
      favorite_circuit_id: number | null;
    }) => {
      setIsSaving(true);
      try {
        const res = await fetchWithAuth(apiUrl("/auth/me"), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(favorites),
        });
        if (!res.ok) throw new Error("Failed to save");
        await refreshUser();
        setShowPicker(false);
      } catch (err) {
        console.error("Failed to save favorites:", err);
      } finally {
        setIsSaving(false);
      }
    },
    [refreshUser],
  );

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <Skeleton variant="rectangular" width="100%" height="200px" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <p className="text-text-muted">User not found.</p>
      </div>
    );
  }

  const memberSince = new Date(profile.created_at).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const hasFavorites =
    profile.favorite_driver ||
    profile.favorite_team ||
    profile.favorite_circuit;

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <UserAvatar
          username={profile.username}
          avatarUrl={profile.avatar_url}
          size="xl"
        />
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-text-primary">
            @{profile.username}
          </h1>
          {profile.role !== "user" && (
            <span className="inline-block mt-1 px-2 py-0.5 text-xs rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
              {profile.role}
            </span>
          )}
          {profile.bio && (
            <p className="text-text-secondary text-sm mt-2">{profile.bio}</p>
          )}
          <p className="text-text-muted text-xs mt-2">
            Member since {memberSince}
          </p>
        </div>
        {isOwnProfile && (
          <Link
            href="/settings"
            className="text-sm text-purple-400 hover:text-purple-300 transition-colors shrink-0"
          >
            Edit profile
          </Link>
        )}
      </div>

      {/* Favorites */}
      {hasFavorites && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-text-secondary">
              Favorites
            </h2>
            {isOwnProfile && (
              <button
                type="button"
                onClick={() => setShowPicker(true)}
                className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
              >
                Edit favorites
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {profile.favorite_team && (
              <Link
                href={`/constructors/${encodeURIComponent(profile.favorite_team.team_name)}`}
                className="flex items-center gap-3 p-3 rounded-sm bg-bg-tertiary border border-border-primary hover:border-purple-500/50 transition-colors"
              >
                <div
                  className="w-1 h-10 rounded-full shrink-0"
                  style={{
                    backgroundColor: profile.favorite_team.team_color
                      ? `#${profile.favorite_team.team_color}`
                      : "var(--border-primary)",
                  }}
                />
                {profile.favorite_team.logo_url && (
                  // biome-ignore lint/performance/noImgElement: external logo URL
                  <img
                    src={profile.favorite_team.logo_url}
                    alt={profile.favorite_team.team_name}
                    className="w-8 h-8 object-contain shrink-0"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                )}
                <div className="min-w-0">
                  <p className="text-xs text-text-muted">Team</p>
                  <p className="text-sm font-medium text-text-primary truncate">
                    {profile.favorite_team.team_name}
                  </p>
                </div>
              </Link>
            )}

            {profile.favorite_driver && (
              <Link
                href={`/drivers/${profile.favorite_driver.driver_slug}`}
                className="flex items-center gap-3 p-3 rounded-sm bg-bg-tertiary border border-border-primary hover:border-purple-500/50 transition-colors"
              >
                {isValidHeadshotUrl(profile.favorite_driver.headshot_url) ? (
                  // biome-ignore lint/performance/noImgElement: external headshot URL
                  <img
                    src={profile.favorite_driver.headshot_url}
                    alt={profile.favorite_driver.full_name}
                    className="w-10 h-10 rounded-full object-cover bg-bg-elevated shrink-0"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-bg-elevated flex items-center justify-center text-text-muted text-xs font-mono shrink-0">
                    {profile.favorite_driver.driver_code ??
                      profile.favorite_driver.full_name
                        .slice(0, 3)
                        .toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs text-text-muted">Driver</p>
                  <p className="text-sm font-medium text-text-primary truncate">
                    {profile.favorite_driver.full_name}
                  </p>
                </div>
              </Link>
            )}

            {profile.favorite_circuit && (
              <Link
                href={`/circuits/${profile.favorite_circuit.circuit_id}`}
                className="flex items-center gap-3 p-3 rounded-sm bg-bg-tertiary border border-border-primary hover:border-purple-500/50 transition-colors"
              >
                {/* biome-ignore lint/performance/noImgElement: static track map */}
                <img
                  src={`/track-maps/${profile.favorite_circuit.circuit_id}.png`}
                  alt=""
                  className="w-10 h-10 object-contain opacity-60 shrink-0"
                  loading="lazy"
                />
                <div className="min-w-0">
                  <p className="text-xs text-text-muted">Circuit</p>
                  <p className="text-sm font-medium text-text-primary truncate">
                    {profile.favorite_circuit.name}
                  </p>
                  <p className="text-xs text-text-muted truncate">
                    {profile.favorite_circuit.country}
                  </p>
                </div>
              </Link>
            )}
          </div>
        </section>
      )}

      {/* Set favorites CTA (own profile, no favorites) */}
      {isOwnProfile && !hasFavorites && (
        <div className="mb-8 p-4 rounded-sm bg-bg-tertiary border border-border-primary border-dashed">
          <p className="text-sm text-text-secondary mb-3">
            Personalize your profile — pick your favorite team, driver, and
            circuit.
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowPicker(true)}
          >
            Set favorites
          </Button>
        </div>
      )}

      {/* Posts */}
      <section>
        <h2 className="text-sm font-semibold text-text-secondary mb-3">
          Posts
          {allPosts.length > 0 && (
            <span className="ml-2 text-text-muted font-normal">
              ({allPosts.length}
              {hasNextPage ? "+" : ""})
            </span>
          )}
        </h2>
        {postsLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton
                key={`post-skel-${
                  // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
                  i
                }`}
                variant="rectangular"
                width="100%"
                height="100px"
              />
            ))}
          </div>
        ) : allPosts.length > 0 ? (
          <div className="space-y-3">
            {allPosts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
            {hasNextPage && (
              <div className="text-center pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => fetchNextPage()}
                  isLoading={isFetchingNextPage}
                >
                  Load more
                </Button>
              </div>
            )}
          </div>
        ) : (
          <p className="text-text-muted text-sm py-4">No posts yet.</p>
        )}
      </section>

      {/* Favorites picker modal */}
      <FavoritesPicker
        open={showPicker}
        onClose={() => setShowPicker(false)}
        onSave={handleSaveFavorites}
        initialDriverSlug={currentUser?.favorite_driver?.driver_slug}
        initialTeamName={currentUser?.favorite_team?.team_name}
        initialCircuitId={currentUser?.favorite_circuit?.circuit_id}
        isSaving={isSaving}
      />
    </div>
  );
}
