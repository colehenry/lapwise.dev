"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import UserAvatar from "@/components/comments/UserAvatar";
import Button from "@/components/ui/Button";
import {
  adminDeleteComment,
  adminRestoreComment,
  adminSetThreadLock,
  fetchAdminComments,
} from "@/lib/admin";
import { formatRelativeTime } from "@/lib/time";
import type { AdminCommentListItem } from "@/lib/types";

export default function AdminCommentsPage() {
  const [comments, setComments] = useState<AdminCommentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchAdminComments();
      setComments(data.comments);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load comments");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const runAction = async (id: number, action: () => Promise<void>) => {
    setBusyId(id);
    try {
      await action();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {["a", "b", "c"].map((k) => (
          <div
            key={k}
            className="h-24 rounded-sm border border-border-primary bg-bg-tertiary animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-4 text-red-400 border border-red-400/20 bg-red-400/5 rounded-sm text-sm">
          {error}
        </div>
      )}

      {comments.length === 0 ? (
        <div className="border border-dashed border-border-primary rounded-sm p-8 text-center text-sm text-text-muted">
          No comments yet.
        </div>
      ) : (
        comments.map((comment) => {
          const isRemoved = comment.deleted_at !== null;
          const busy = busyId === comment.id;

          return (
            <div
              key={comment.id}
              className={`border rounded-sm p-4 space-y-3 ${
                isRemoved
                  ? "border-red-500/30 bg-red-500/5"
                  : "border-border-primary bg-bg-tertiary"
              }`}
            >
              <div className="flex flex-wrap items-center gap-3">
                <UserAvatar
                  username={comment.author.username}
                  avatarUrl={comment.author.avatar_url}
                  size="sm"
                />
                <span className="text-xs font-mono uppercase tracking-wider text-text-secondary">
                  {comment.author.username}
                </span>
                <Link
                  href={`/results/${comment.year}/${comment.round}#comments`}
                  className="text-[10px] font-mono uppercase tracking-widest text-purple-400 hover:text-purple-300"
                >
                  {comment.year} R{String(comment.round).padStart(2, "0")}
                </Link>
                <span className="text-[10px] font-mono uppercase tracking-widest text-text-muted">
                  {formatRelativeTime(comment.created_at)}
                </span>
                {isRemoved && (
                  <span className="text-[10px] font-mono uppercase tracking-widest text-red-400">
                    Removed
                  </span>
                )}
              </div>

              <p className="text-sm text-text-secondary whitespace-pre-line">
                {comment.body}
              </p>

              <div className="flex flex-wrap items-center gap-2">
                {isRemoved ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      runAction(comment.id, () =>
                        adminRestoreComment(comment.id),
                      )
                    }
                  >
                    Restore
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      runAction(comment.id, () =>
                        adminDeleteComment(comment.id),
                      )
                    }
                  >
                    Remove
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    runAction(comment.id, () =>
                      adminSetThreadLock(comment.year, comment.round, true),
                    )
                  }
                >
                  Lock thread
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    runAction(comment.id, () =>
                      adminSetThreadLock(comment.year, comment.round, false),
                    )
                  }
                >
                  Unlock
                </Button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
