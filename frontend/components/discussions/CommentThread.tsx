"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import CommentEditor from "@/components/discussions/CommentEditor";
import MarkdownContent from "@/components/discussions/MarkdownContent";
import UserAvatar from "@/components/discussions/UserAvatar";
import VoteButton from "@/components/discussions/VoteButton";
import { createComment } from "@/lib/discussions";
import { formatRelativeTime } from "@/lib/time";
import type { CommentResponse } from "@/lib/types";

interface CommentThreadProps {
  postId: number;
  comments: CommentResponse[];
  onRefresh: () => void;
  isLocked?: boolean;
}

function CommentNode({
  comment,
  depth,
  postId,
  onRefresh,
  isLocked = false,
}: {
  comment: CommentResponse;
  depth: number;
  postId: number;
  onRefresh: () => void;
  isLocked?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading } = useAuth();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showReply, setShowReply] = useState(false);

  const hasReplies = comment.replies && comment.replies.length > 0;
  const isEdited = comment.updated_at !== comment.created_at;

  const handleReply = async (body: string) => {
    if (isLoading) return;

    if (!isAuthenticated) {
      router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }

    await createComment({
      postId,
      body,
      parent_comment_id: comment.id,
    });
    setShowReply(false);
    onRefresh();
  };

  if (isCollapsed) {
    return (
      <div className={depth > 0 ? "ml-3" : ""}>
        <div className="flex items-center gap-2 border border-border-primary rounded-sm bg-bg-tertiary/60 px-3 py-2">
          <button
            type="button"
            onClick={() => setIsCollapsed(false)}
            className="w-5 h-5 flex items-center justify-center rounded-sm border border-border-primary text-text-muted hover:text-text-primary hover:border-purple-500/50 transition-colors"
            aria-label="Expand comment"
          >
            <svg
              className="w-3 h-3"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              aria-hidden="true"
            >
              <title>Expand</title>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 5v14m-7-7h14"
              />
            </svg>
          </button>
          <UserAvatar
            username={comment.author.username}
            avatarUrl={comment.author.avatar_url}
            size="sm"
          />
          <span className="text-xs font-mono uppercase tracking-wider text-text-muted">
            {comment.author.username}
          </span>
          <span className="text-[10px] font-mono text-text-muted">
            • {formatRelativeTime(comment.created_at)}
          </span>
          {hasReplies && (
            <span className="text-[10px] font-mono text-text-muted">
              • {comment.replies.length}{" "}
              {comment.replies.length === 1 ? "reply" : "replies"}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={depth > 0 ? "ml-3" : ""}>
      <div className="flex">
        {/* Clickable collapse rail */}
        <button
          type="button"
          onClick={() => setIsCollapsed(true)}
          className="group flex-shrink-0 w-5 flex flex-col items-center pt-1 cursor-pointer bg-transparent border-none p-0"
          aria-label="Collapse comment"
        >
          <div className="w-px flex-1 bg-border-primary group-hover:bg-purple-500 transition-colors" />
        </button>

        {/* Comment content */}
        <div className="flex-1 min-w-0 border border-border-primary rounded-sm bg-bg-tertiary p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <UserAvatar
                username={comment.author.username}
                avatarUrl={comment.author.avatar_url}
                size="sm"
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono uppercase tracking-wider text-text-secondary">
                    {comment.author.username}
                  </span>
                  {comment.author.role !== "user" && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full border border-border-secondary text-text-tertiary uppercase tracking-widest font-mono">
                      {comment.author.role}
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-text-muted font-mono uppercase tracking-widest">
                  {formatRelativeTime(comment.created_at)}
                  {isEdited && " • edited"}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 text-sm">
            <MarkdownContent content={comment.body} />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <VoteButton
              commentId={comment.id}
              initialCount={comment.vote_count}
              initialVoted={comment.user_voted}
              size="sm"
            />
            {!isLocked && (
              <button
                type="button"
                onClick={() => {
                  if (!isAuthenticated && !isLoading) {
                    router.push(
                      `/login?redirect=${encodeURIComponent(pathname)}`,
                    );
                    return;
                  }
                  setShowReply((prev) => !prev);
                }}
                className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-widest border border-border-primary rounded-sm text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
              >
                Reply
              </button>
            )}
          </div>

          {showReply && (
            <div className="mt-3">
              <CommentEditor
                onSubmit={handleReply}
                onCancel={() => setShowReply(false)}
                submitLabel="Reply"
                placeholder="Reply to this comment..."
              />
            </div>
          )}
        </div>
      </div>

      {/* Replies nested under the rail */}
      {hasReplies && (
        <div className="mt-3 space-y-3 ml-5">
          {comment.replies.map((reply) => (
            <CommentNode
              key={reply.id}
              comment={reply}
              depth={depth + 1}
              postId={postId}
              onRefresh={onRefresh}
              isLocked={isLocked}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CommentThread({
  postId,
  comments,
  onRefresh,
  isLocked = false,
}: CommentThreadProps) {
  if (!comments.length) {
    return (
      <div className="border border-dashed border-border-primary rounded-sm p-4 text-sm text-text-muted">
        No comments yet. Be the first to join the discussion.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {comments.map((comment) => (
        <CommentNode
          key={comment.id}
          comment={comment}
          depth={0}
          postId={postId}
          onRefresh={onRefresh}
          isLocked={isLocked}
        />
      ))}
    </div>
  );
}
