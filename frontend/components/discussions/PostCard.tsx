import Link from "next/link";
import { stripLapwiseEmbeds } from "@/components/discussions/MarkdownContent";
import TagPill from "@/components/discussions/TagPill";
import UserAvatar from "@/components/discussions/UserAvatar";
import VoteButton from "@/components/discussions/VoteButton";
import Badge from "@/components/ui/Badge";
import MonoLabel from "@/components/ui/MonoLabel";
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
  const preview = stripLapwiseEmbeds(post.body);

  return (
    <Link
      href={`/discussions/${post.id}`}
      className="block border border-border-primary rounded-sm bg-bg-tertiary p-3 hover:border-purple-500/70 transition-all duration-150 md:p-4"
    >
      {/* Top row: vote + meta — vote sits inline so content gets full width below */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: preventDefault stops link navigation when clicking vote */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: interactive children need event isolation */}
      <div
        className="flex flex-wrap items-center gap-1.5 mb-2"
        onClick={(e) => e.preventDefault()}
      >
        <VoteButton
          postId={post.id}
          initialCount={post.vote_count}
          initialVoted={post.user_voted}
          size="sm"
        />
        {post.is_locked && <MonoLabel>Locked</MonoLabel>}
        {post.is_pinned && (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-purple-300">
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
        <span className="text-[10px] text-text-muted font-mono uppercase tracking-wider">
          {formatRelativeTime(post.created_at)}
        </span>
      </div>

      {/* Title — full card width */}
      <h3 className="text-base font-semibold text-text-primary leading-snug md:text-lg">
        {post.title}
      </h3>

      {/* Body preview — full card width */}
      {preview && (
        <p className="text-xs text-text-tertiary mt-1.5 leading-relaxed line-clamp-2 md:mt-2 md:text-sm md:line-clamp-3">
          {preview}
        </p>
      )}

      {post.tags.length > 0 && (
        <div className="hidden flex-wrap gap-2 mt-3 sm:flex">
          {post.tags.map((tag) => (
            <TagPill key={tag.id} label={tag.name} color={tag.color} />
          ))}
        </div>
      )}

      <div className="mt-2.5 pt-2.5 border-t border-border-primary flex flex-wrap items-center justify-between gap-2 md:mt-3 md:pt-3">
        <div className="flex min-w-0 items-center gap-2 text-[10px] text-text-muted md:text-xs">
          <UserAvatar
            username={post.author.username}
            avatarUrl={post.author.avatar_url}
            size="sm"
          />
          <span className="min-w-0 truncate font-mono uppercase tracking-wider">
            {post.author.username}
          </span>
          {post.author.role !== "user" && (
            <span className="hidden text-[10px] px-2 py-0.5 rounded-full border border-border-secondary text-text-tertiary uppercase tracking-widest font-mono sm:inline">
              {post.author.role}
            </span>
          )}
        </div>

        <div className="flex items-center gap-4 text-[10px] text-text-muted font-mono uppercase tracking-widest md:text-xs">
          <span>{post.comment_count} cmt</span>
        </div>
      </div>
    </Link>
  );
}
