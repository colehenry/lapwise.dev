"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useLayoutEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import CommentEditor from "@/components/discussions/CommentEditor";
import CommentThread from "@/components/discussions/CommentThread";
import MarkdownContent from "@/components/discussions/MarkdownContent";
import TagPill from "@/components/discussions/TagPill";
import UserAvatar from "@/components/discussions/UserAvatar";
import VoteButton from "@/components/discussions/VoteButton";
import { GridPattern } from "@/components/Patterns";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import {
  createComment,
  deletePost,
  fetchComments,
  fetchPost,
  toggleLock,
  togglePin,
} from "@/lib/discussions";
import { formatRelativeTime } from "@/lib/time";
import type { CommentListResponse, PostResponse } from "@/lib/types";

const typeLabels: Record<string, string> = {
  discussion: "Discussion",
  analysis: "Analysis",
  news: "News",
  weekly_recap: "Weekly Recap",
};

const typeVariants: Record<string, "purple" | "red" | "info" | "neutral"> = {
  discussion: "neutral",
  analysis: "info",
  news: "red",
  weekly_recap: "purple",
};

export default function DiscussionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const postId = Number(params.id);

  const {
    data: post,
    isLoading: postLoading,
    refetch: refetchPost,
  } = useQuery<PostResponse>({
    queryKey: ["discussion-post", postId],
    queryFn: () => fetchPost(postId),
    enabled: Number.isFinite(postId),
  });

  const {
    data: commentsData,
    isLoading: commentsLoading,
    refetch: refetchComments,
  } = useQuery<CommentListResponse>({
    queryKey: ["discussion-comments", postId],
    queryFn: () => fetchComments({ postId, limit: 50 }),
    enabled: Number.isFinite(postId),
  });

  const [voteCount, setVoteCount] = useState(0);
  const [userVoted, setUserVoted] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useLayoutEffect(() => {
    if (!post) return;
    setVoteCount(post.vote_count);
    setUserVoted(post.user_voted);
  }, [post]);

  if (postLoading || !post) {
    return (
      <div className="min-h-screen bg-bg-secondary flex items-center justify-center text-text-muted font-mono text-xs uppercase tracking-widest">
        Loading discussion...
      </div>
    );
  }

  const isAuthor = user?.id === post.author.id;
  const isAdmin = user?.role === "admin";
  const canEdit = isAuthor || isAdmin;
  const label = typeLabels[post.post_type] ?? "Post";
  const variant = typeVariants[post.post_type] ?? "neutral";
  const isEdited = post.updated_at !== post.created_at;

  const handleNewComment = async (body: string) => {
    try {
      await createComment({ postId, body });
      await refreshAll();
    } catch (err) {
      console.error("Failed to create comment:", err);
    }
  };

  const refreshAll = async () => {
    await refetchComments();
    await refetchPost();
  };

  const handleTogglePin = async () => {
    try {
      await togglePin(postId);
      await refetchPost();
      queryClient.invalidateQueries({ queryKey: ["discussion-posts"] });
    } catch (err) {
      console.error("Failed to toggle pin:", err);
    }
  };

  const handleToggleLock = async () => {
    try {
      await toggleLock(postId);
      await refetchPost();
    } catch (err) {
      console.error("Failed to toggle lock:", err);
    }
  };

  const handleDelete = async () => {
    setDeleteOpen(false);
    try {
      await deletePost(postId);
      router.push("/discussions");
    } catch (err) {
      console.error("Failed to delete post:", err);
    }
  };

  return (
    <div className="min-h-screen bg-bg-secondary">
      <div className="relative overflow-hidden border-b border-border-primary">
        <GridPattern
          id="discussion-detail-grid"
          className="absolute inset-0 w-full h-full text-purple-500 opacity-[0.06] pointer-events-none"
        />
        <div className="relative z-10 max-w-5xl mx-auto px-4 md:px-8 py-10">
          <Link
            href="/discussions"
            className="text-xs font-mono uppercase tracking-widest text-text-muted hover:text-text-primary"
          >
            ← Back to discussions
          </Link>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {post.is_pinned && (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest text-purple-300">
                <svg
                  className="w-3 h-3"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <title>Pinned</title>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 3l5 5-6 6-2 6-4-4 6-2 6-6"
                  />
                </svg>
                Pinned
              </span>
            )}
            {post.is_locked && (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest text-text-muted">
                <svg
                  className="w-3 h-3"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <title>Locked</title>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 11c1.1 0 2 .9 2 2v3a2 2 0 11-4 0v-3c0-1.1.9-2 2-2zm6-1V8a6 6 0 10-12 0v2"
                  />
                </svg>
                Locked
              </span>
            )}
            <Badge variant={variant} size="sm">
              {label}
            </Badge>
            <span className="text-[10px] font-mono uppercase tracking-widest text-text-muted">
              {formatRelativeTime(post.created_at)}
              {isEdited && " • edited"}
            </span>
          </div>

          <h1 className="text-3xl md:text-4xl font-bold text-text-primary mt-4">
            {post.title}
          </h1>
          <p className="text-text-tertiary mt-3">
            {post.comment_count} comments • {voteCount} votes
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 md:px-8 py-8 space-y-8">
        <div className="border border-border-primary rounded-sm bg-bg-tertiary p-5 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <UserAvatar
                username={post.author.username}
                avatarUrl={post.author.avatar_url}
                size="md"
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono uppercase tracking-wider text-text-secondary">
                    {post.author.username}
                  </span>
                  {post.author.role !== "user" && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full border border-border-secondary text-text-tertiary uppercase tracking-widest font-mono">
                      {post.author.role}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-text-muted">
                  Posted {formatRelativeTime(post.created_at)}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <VoteButton
                postId={post.id}
                initialCount={voteCount}
                initialVoted={userVoted}
                onChange={(count, voted) => {
                  setVoteCount(count);
                  setUserVoted(voted);
                }}
              />
              {canEdit && (
                <Link
                  href={`/discussions/${post.id}/edit`}
                  className="px-3 py-1.5 text-xs font-mono uppercase tracking-widest border border-border-primary rounded-sm text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
                >
                  Edit
                </Link>
              )}
              {isAdmin && (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleTogglePin}
                  >
                    {post.is_pinned ? "Unpin" : "Pin"}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleToggleLock}
                  >
                    {post.is_locked ? "Unlock" : "Lock"}
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={() => setDeleteOpen(true)}
                  >
                    Delete
                  </Button>
                </>
              )}
            </div>
          </div>

          <MarkdownContent content={post.body} />

          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <TagPill key={tag.id} label={tag.name} color={tag.color} />
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text-primary">
              Discussion ({post.comment_count})
            </h2>
          </div>

          {post.is_locked && (
            <div className="border border-border-primary rounded-sm bg-bg-tertiary/60 p-4 text-sm text-text-muted">
              This thread is locked. New comments are disabled.
            </div>
          )}

          {!post.is_locked && (
            <div className="border border-border-primary rounded-sm bg-bg-tertiary p-4">
              {authLoading ? null : isAuthenticated ? (
                <CommentEditor
                  onSubmit={handleNewComment}
                  submitLabel="Post comment"
                  placeholder="Add to the discussion..."
                />
              ) : (
                <div className="text-sm text-text-muted">
                  <Link
                    href={`/login?redirect=/discussions/${post.id}`}
                    className="text-purple-300 hover:text-purple-200"
                  >
                    Log in
                  </Link>{" "}
                  to join the discussion.
                </div>
              )}
            </div>
          )}

          {commentsLoading ? (
            <div className="text-xs font-mono uppercase tracking-widest text-text-muted">
              Loading comments...
            </div>
          ) : (
            <CommentThread
              postId={post.id}
              comments={commentsData?.comments ?? []}
              onRefresh={refreshAll}
              isLocked={post.is_locked}
            />
          )}
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title="Delete post"
        message="This will permanently delete the post and all its comments. This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  );
}
