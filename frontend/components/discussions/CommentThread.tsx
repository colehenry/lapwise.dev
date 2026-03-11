"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import CommentEditor from "@/components/discussions/CommentEditor";
import MarkdownContent from "@/components/discussions/MarkdownContent";
import UserAvatar from "@/components/discussions/UserAvatar";
import VoteButton from "@/components/discussions/VoteButton";
import { useAuth } from "@/components/AuthProvider";
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

  return (
    <div
      className={`border border-border-primary rounded-sm bg-bg-tertiary p-3 ${
        depth > 0 ? "ml-3" : ""
      }`}
    >
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

        {hasReplies && (
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="text-[10px] font-mono uppercase tracking-widest text-text-muted hover:text-text-primary"
          >
            {isCollapsed ? "Expand" : "Collapse"}
          </button>
        )}
      </div>

      {!isCollapsed && (
        <>
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
                    router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
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

          {hasReplies && (
            <div className="mt-4 space-y-3 border-l border-border-primary pl-4">
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
        </>
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
