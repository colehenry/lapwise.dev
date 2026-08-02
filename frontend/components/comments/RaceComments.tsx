"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import CommentEditor from "@/components/comments/CommentEditor";
import CommentThread from "@/components/comments/CommentThread";
import Button from "@/components/ui/Button";
import { type CommentSort, useRaceComments } from "@/hooks/useRaceComments";

interface RaceCommentsProps {
  season: number;
  round: number;
}

const SORTS: { key: CommentSort; label: string }[] = [
  { key: "new", label: "New" },
  { key: "top", label: "Top" },
];

export default function RaceComments({ season, round }: RaceCommentsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();

  const [sort, setSort] = useState<CommentSort>("new");
  const {
    comments,
    commentCount,
    isLocked,
    isLoading,
    addComment,
    removeComment,
  } = useRaceComments(season, round, sort);

  return (
    <section
      id="comments"
      className="scroll-mt-32 px-3 pb-12 pt-8 md:px-6 md:pt-10"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-primary pb-3">
        <div className="flex items-baseline gap-3">
          <h2 className="text-xl font-bold tracking-tight text-text-primary">
            Discussion
          </h2>
          {commentCount > 0 && (
            <span className="font-mono text-xs tabular-nums text-text-muted">
              {commentCount} {commentCount === 1 ? "comment" : "comments"}
            </span>
          )}
        </div>

        {comments.length > 1 && (
          <div className="flex items-center gap-3">
            {SORTS.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setSort(option.key)}
                className={`font-mono text-[11px] uppercase tracking-wider transition-colors ${
                  sort === option.key
                    ? "text-purple-400"
                    : "text-text-muted hover:text-text-primary"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-5">
        {isLocked ? (
          <p className="text-sm text-text-muted">
            This thread is locked. No new comments can be added.
          </p>
        ) : isAuthenticated ? (
          <CommentEditor onSubmit={(body) => addComment(body)} />
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
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
      </div>

      {isLoading ? (
        <div className="mt-6 h-20 animate-pulse rounded-sm bg-bg-tertiary" />
      ) : (
        <div className="mt-2">
          <CommentThread
            comments={comments}
            onReply={addComment}
            onDelete={removeComment}
            isLocked={isLocked}
            isAdmin={user?.role === "admin"}
          />
        </div>
      )}
    </section>
  );
}
