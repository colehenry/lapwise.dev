"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import CommentEditor from "@/components/comments/CommentEditor";
import CommentThread from "@/components/comments/CommentThread";
import { TrianglePattern } from "@/components/Patterns";
import Button from "@/components/ui/Button";
import SortPills from "@/components/ui/SortPills";
import { createComment, fetchRaceComments } from "@/lib/comments";

interface RaceCommentsProps {
  season: number;
  round: number;
  eventName: string;
}

type SortKey = "new" | "top";

export default function RaceComments({
  season,
  round,
  eventName,
}: RaceCommentsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();

  const [sort, setSort] = useState<SortKey>("new");

  const queryKey = ["race-comments", season, round, sort];
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchRaceComments({ season, round, sort }),
  });

  const comments = data?.comments ?? [];
  const isLocked = data?.is_locked ?? false;
  const count = data?.comment_count ?? 0;

  const refresh = () => {
    queryClient.invalidateQueries({
      queryKey: ["race-comments", season, round],
    });
  };

  const handleSubmit = async (body: string) => {
    await createComment({ season, round, body });
    refresh();
  };

  return (
    <section id="comments" className="scroll-mt-32 p-3 md:p-6">
      <div className="bg-bg-tertiary border border-border-primary rounded-sm shadow-sm overflow-hidden">
        <div className="relative h-10 bg-bg-primary border-b border-border-primary px-4 flex items-center justify-between overflow-hidden">
          <TrianglePattern id="race-comments-triangles" />
          <span className="relative z-10 text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono">
            Comments — {eventName.replace("Grand Prix", "GP")}
          </span>
          <span className="relative z-10 text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono tabular-nums">
            {count}
          </span>
        </div>

        <div className="p-3 md:p-6 space-y-4">
          {isLocked ? (
            <p className="border border-dashed border-border-primary rounded-sm p-4 text-sm text-text-muted">
              This thread is locked. No new comments can be added.
            </p>
          ) : isAuthenticated ? (
            <CommentEditor
              onSubmit={handleSubmit}
              placeholder={`What did you make of the ${eventName.replace("Grand Prix", "GP")}?`}
            />
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 border border-border-primary rounded-sm bg-bg-secondary/60 px-4 py-3">
              <p className="text-sm text-text-muted">
                Log in to join the conversation.
              </p>
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={authLoading}
                onClick={() =>
                  router.push(`/login?redirect=${encodeURIComponent(pathname)}`)
                }
              >
                Log in
              </Button>
            </div>
          )}

          {comments.length > 1 && (
            <div className="flex justify-end">
              <SortPills<SortKey>
                active={sort}
                onChange={setSort}
                options={[
                  { key: "new", label: "New" },
                  { key: "top", label: "Top" },
                ]}
              />
            </div>
          )}

          {isLoading ? (
            <div className="h-24 animate-pulse rounded-sm border border-border-primary bg-bg-secondary/60" />
          ) : (
            <CommentThread
              season={season}
              round={round}
              comments={comments}
              onRefresh={refresh}
              isLocked={isLocked}
              isAdmin={user?.role === "admin"}
            />
          )}
        </div>
      </div>
    </section>
  );
}
