"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import Skeleton from "@/components/ui/Skeleton";
import { apiUrl } from "@/lib/api";
import { fetchWithAuth } from "@/lib/auth";

interface PublicProfile {
  username: string;
  role: string;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
}

export default function ProfilePage() {
  const params = useParams();
  const username = params.username as string;
  const { user: currentUser } = useAuth();
  const isOwnProfile = currentUser?.username === username;

  const { data: profile, isLoading } = useQuery<PublicProfile>({
    queryKey: ["profile", username],
    queryFn: async () => {
      const res = await fetchWithAuth(apiUrl(`/api/users/${username}`));
      if (!res.ok) throw new Error("Profile not found");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12">
        <Skeleton variant="rectangular" width="100%" height="200px" />
      </div>
    );
  }

  const displayProfile = profile;

  if (!displayProfile) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center">
        <p className="text-text-muted">User not found.</p>
      </div>
    );
  }

  const initial = displayProfile.username[0].toUpperCase();
  const memberSince = new Date(displayProfile.created_at).toLocaleDateString(
    "en-US",
    { month: "long", year: "numeric" },
  );

  return (
    <div className="max-w-lg mx-auto px-4 py-12">
      <div className="flex items-start gap-4 mb-6">
        <div className="w-16 h-16 rounded-full bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-2xl font-bold text-purple-300 shrink-0">
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-text-primary">
            @{displayProfile.username}
          </h1>
          {displayProfile.role !== "user" && (
            <span className="inline-block mt-1 px-2 py-0.5 text-xs rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
              {displayProfile.role}
            </span>
          )}
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

      {displayProfile.bio && (
        <p className="text-text-secondary text-sm mb-4">{displayProfile.bio}</p>
      )}

      <p className="text-text-muted text-xs">Member since {memberSince}</p>
    </div>
  );
}
