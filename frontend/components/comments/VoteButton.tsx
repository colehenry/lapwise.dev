"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { voteComment } from "@/lib/comments";

interface VoteButtonProps {
  commentId: number;
  initialCount: number;
  initialVoted: boolean;
  onChange?: (count: number, voted: boolean) => void;
}

export default function VoteButton({
  commentId,
  initialCount,
  initialVoted,
  onChange,
}: VoteButtonProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading } = useAuth();

  const [count, setCount] = useState(initialCount);
  const [voted, setVoted] = useState(initialVoted);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setCount(initialCount);
    setVoted(initialVoted);
  }, [initialCount, initialVoted]);

  const handleVote = async () => {
    if (isLoading || isSubmitting) return;

    if (!isAuthenticated) {
      router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }

    const nextVoted = !voted;
    const nextCount = nextVoted ? count + 1 : count - 1;

    setVoted(nextVoted);
    setCount(nextCount);
    setIsSubmitting(true);
    setFailed(false);

    try {
      const result = await voteComment(commentId);
      setVoted(result.voted);
      setCount(result.new_count);
      onChange?.(result.new_count, result.voted);
    } catch {
      setVoted(voted);
      setCount(count);
      setFailed(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const label = failed
    ? "Vote failed. Click to try again."
    : isAuthenticated
      ? "Vote on comment"
      : "Log in to vote";

  return (
    <button
      type="button"
      onClick={handleVote}
      aria-pressed={voted}
      aria-label={label}
      title={label}
      className={`inline-flex items-center gap-1 font-mono text-[11px] tracking-wider transition-colors ${
        failed
          ? "text-red-400"
          : voted
            ? "text-purple-400"
            : "text-text-muted hover:text-text-primary"
      }`}
      disabled={isSubmitting}
    >
      <svg
        className="h-3.5 w-3.5"
        fill={voted ? "currentColor" : "none"}
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <title>Upvote</title>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 5l7 8h-4v6h-6v-6H5l7-8z"
        />
      </svg>
      <span className="tabular-nums">{count}</span>
    </button>
  );
}
