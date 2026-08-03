"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { formatRelativeTime } from "@/lib/time";
import type { CommentResponse } from "@/lib/types";
import CommentEditor from "./CommentEditor";
import MarkdownContent from "./MarkdownContent";
import UserAvatar from "./UserAvatar";
import VoteButton from "./VoteButton";

interface CommentThreadProps {
  comments: CommentResponse[];
  onReply: (body: string, parentId: number) => Promise<void>;
  onDelete: (commentId: number) => Promise<void>;
  isLocked?: boolean;
  isAdmin?: boolean;
}

const ACTION_CLASS =
  "font-mono text-[11px] uppercase tracking-wider text-text-muted transition-colors hover:text-text-primary disabled:opacity-40";

function CommentNode({
  comment,
  onReply,
  onDelete,
  isLocked = false,
  isAdmin = false,
}: {
  comment: CommentResponse;
  onReply: (body: string, parentId: number) => Promise<void>;
  onDelete: (commentId: number) => Promise<void>;
  isLocked?: boolean;
  isAdmin?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading, user } = useAuth();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showReply, setShowReply] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const canDelete = isAdmin || user?.id === comment.author.id;
  const replies = comment.replies ?? [];
  const isEdited = comment.updated_at !== comment.created_at;

  const requireAuth = () => {
    if (isLoading) {
      throw new Error("Still checking your session. Try again in a moment.");
    }
    if (!isAuthenticated) {
      router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
      throw new Error("Log in to reply.");
    }
  };

  const handleReply = async (body: string) => {
    requireAuth();
    await onReply(body, comment.id);
    setShowReply(false);
  };

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    setError("");
    try {
      await onDelete(comment.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete comment");
      setDeleting(false);
    }
  };

  return (
    <article className="group grid grid-cols-[16px_28px_minmax(0,1fr)] gap-x-2 py-4">
      <button
        type="button"
        onClick={() => setIsCollapsed((prev) => !prev)}
        aria-expanded={!isCollapsed}
        aria-label={isCollapsed ? "Expand comment" : "Collapse comment"}
        title={isCollapsed ? "Expand" : "Collapse"}
        className={`col-start-1 row-start-1 flex h-7 w-4 items-center justify-center text-text-muted transition-all hover:text-text-primary focus-visible:opacity-100 ${
          isCollapsed
            ? "opacity-100"
            : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
        }`}
      >
        <svg
          className={`h-3 w-3 transition-transform duration-150 ${
            isCollapsed ? "-rotate-90" : ""
          }`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            d="M6 9l6 6 6-6"
          />
        </svg>
      </button>

      <div className="col-start-2 row-start-1">
        <UserAvatar
          username={comment.author.username}
          avatarUrl={comment.author.avatar_url}
          size="sm"
        />
      </div>

      <div className="col-start-3 row-start-1 flex min-w-0 flex-wrap items-baseline gap-x-2 self-center">
        <span className="text-sm font-medium text-text-primary">
          {comment.author.username}
        </span>
        {comment.author.role !== "user" && (
          <span className="font-mono text-[10px] uppercase tracking-widest text-purple-400">
            {comment.author.role}
          </span>
        )}
        <span className="text-xs text-text-muted">
          {formatRelativeTime(comment.created_at)}
          {isEdited && " · edited"}
        </span>
        {isCollapsed && replies.length > 0 && (
          <span className="text-xs text-text-muted">
            · {replies.length} {replies.length === 1 ? "reply" : "replies"}
          </span>
        )}
      </div>

      {!isCollapsed && (
        <div className="col-start-3 row-start-2 min-w-0">
          <MarkdownContent
            content={comment.body}
            className="comment-body mt-2"
          />

          <div className="mt-2.5 flex flex-wrap items-center gap-5">
            <VoteButton
              commentId={comment.id}
              initialCount={comment.vote_count}
              initialVoted={comment.user_voted}
            />
            {!isLocked && (
              <button
                type="button"
                onClick={() => setShowReply((prev) => !prev)}
                className={ACTION_CLASS}
              >
                {showReply ? "Cancel" : "Reply"}
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                disabled={deleting}
                onClick={handleDelete}
                className={`${ACTION_CLASS} hover:text-red-400`}
              >
                {deleting ? "Deleting" : "Delete"}
              </button>
            )}
          </div>

          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

          {showReply && (
            <div className="mt-3">
              <CommentEditor
                onSubmit={handleReply}
                submitLabel="Reply"
                placeholder={`Reply to ${comment.author.username}`}
                autoFocus
              />
            </div>
          )}

          {replies.length > 0 && (
            <div className="mt-1 border-l border-border-primary pl-3">
              {replies.map((reply) => (
                <CommentNode
                  key={reply.id}
                  comment={reply}
                  onReply={onReply}
                  onDelete={onDelete}
                  isLocked={isLocked}
                  isAdmin={isAdmin}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

export default function CommentThread({
  comments,
  onReply,
  onDelete,
  isLocked = false,
  isAdmin = false,
}: CommentThreadProps) {
  if (!comments.length) {
    return (
      <p className="py-6 text-sm text-text-muted">
        No comments yet. Be the first to weigh in on this race.
      </p>
    );
  }

  return (
    <div className="divide-y divide-border-primary/60">
      {comments.map((comment) => (
        <CommentNode
          key={comment.id}
          comment={comment}
          onReply={onReply}
          onDelete={onDelete}
          isLocked={isLocked}
          isAdmin={isAdmin}
        />
      ))}
    </div>
  );
}
