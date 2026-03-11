import Link from "next/link";
import TagPill from "@/components/discussions/TagPill";
import UserAvatar from "@/components/discussions/UserAvatar";
import VoteButton from "@/components/discussions/VoteButton";
import Badge from "@/components/ui/Badge";
import { formatRelativeTime } from "@/lib/time";
import type { PostListItem } from "@/lib/types";

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

export default function PostCard({ post }: { post: PostListItem }) {
  const label = typeLabels[post.post_type] ?? "Post";
  const variant = typeVariants[post.post_type] ?? "neutral";

  return (
    <div className="border border-border-primary rounded-sm bg-bg-tertiary p-4 hover:border-purple-500/70 transition-all duration-150">
      <div className="flex gap-4">
        <div className="flex flex-col items-center gap-2">
          <VoteButton
            postId={post.id}
            initialCount={post.vote_count}
            initialVoted={post.user_voted}
          />
          {post.is_locked && (
            <span className="text-[10px] font-mono uppercase tracking-widest text-text-muted">
              Locked
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted font-mono uppercase tracking-wider">
            {post.is_pinned && (
              <span className="inline-flex items-center gap-1 text-purple-300">
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
            <Badge variant={variant} size="sm">
              {label}
            </Badge>
            <span>•</span>
            <span>{formatRelativeTime(post.created_at)}</span>
          </div>

          <Link href={`/discussions/${post.id}`} className="block mt-2">
            <h3 className="text-lg font-semibold text-text-primary leading-snug">
              {post.title}
            </h3>
            <p className="text-sm text-text-tertiary mt-2 leading-relaxed">
              {post.body}
            </p>
          </Link>

          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {post.tags.map((tag) => (
                <TagPill key={tag.id} label={tag.name} color={tag.color} />
              ))}
            </div>
          )}

          <div className="mt-4 pt-3 border-t border-border-primary flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <UserAvatar
                username={post.author.username}
                avatarUrl={post.author.avatar_url}
                size="sm"
              />
              <span className="font-mono uppercase tracking-wider">
                {post.author.username}
              </span>
              {post.author.role !== "user" && (
                <span className="text-[10px] px-2 py-0.5 rounded-full border border-border-secondary text-text-tertiary uppercase tracking-widest font-mono">
                  {post.author.role}
                </span>
              )}
            </div>

            <div className="flex items-center gap-4 text-xs text-text-muted font-mono uppercase tracking-widest">
              <span>{post.comment_count} comments</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
