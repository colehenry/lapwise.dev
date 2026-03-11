"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { voteComment, votePost } from "@/lib/discussions";

interface VoteButtonProps {
  postId?: number;
  commentId?: number;
  initialCount: number;
  initialVoted: boolean;
  size?: "sm" | "md";
  onChange?: (count: number, voted: boolean) => void;
}

export default function VoteButton({
  postId,
  commentId,
  initialCount,
  initialVoted,
  size = "md",
  onChange,
}: VoteButtonProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading } = useAuth();

  const [count, setCount] = useState(initialCount);
  const [voted, setVoted] = useState(initialVoted);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setCount(initialCount);
    setVoted(initialVoted);
  }, [initialCount, initialVoted]);

  const actionLabel = useMemo(() => {
    if (commentId) return "Vote on comment";
    return "Vote on post";
  }, [commentId]);

  const handleVote = async () => {
    if (isLoading || isSubmitting) return;

    if (!isAuthenticated) {
      router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }

    if (!postId && !commentId) return;

    const nextVoted = !voted;
    const nextCount = nextVoted ? count + 1 : count - 1;

    setVoted(nextVoted);
    setCount(nextCount);
    setIsSubmitting(true);

    try {
      let result: { voted: boolean; new_count: number } | null = null;
      if (postId) {
        result = await votePost(postId);
      } else if (commentId) {
        result = await voteComment(commentId);
      }

      if (!result) return;

      setVoted(result.voted);
      setCount(result.new_count);
      onChange?.(result.new_count, result.voted);
    } catch {
      setVoted(voted);
      setCount(count);
    } finally {
      setIsSubmitting(false);
    }
  };

  const sizeStyles = {
    sm: "px-2.5 py-1 text-xs",
    md: "px-3 py-1.5 text-sm",
  };

  return (
    <button
      type="button"
      onClick={handleVote}
      aria-pressed={voted}
      aria-label={actionLabel}
      title={isAuthenticated ? actionLabel : "Log in to vote"}
      className={`inline-flex items-center gap-1 rounded-sm border font-mono tracking-wider transition-colors duration-150 ${sizeStyles[size]} ${
        voted
          ? "bg-purple-500/20 border-purple-500 text-purple-200"
          : "border-border-primary text-text-muted hover:text-text-primary hover:bg-bg-elevated"
      }`}
      disabled={isSubmitting}
    >
      <svg
        className={`w-3.5 h-3.5 ${voted ? "text-purple-300" : "text-text-muted"}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <title>Upvote</title>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 15l7-7 7 7"
        />
      </svg>
      <span className="tabular-nums">{count}</span>
    </button>
  );
}
