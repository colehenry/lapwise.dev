"use client";

import { useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import MarkdownContent from "@/components/discussions/MarkdownContent";
import TagPill from "@/components/discussions/TagPill";
import { useAuth } from "@/components/AuthProvider";
import { fetchTags } from "@/lib/discussions";
import type { DiscussionTag } from "@/lib/types";
import { useQuery } from "@tanstack/react-query";

interface PostEditorProps {
  initial?: {
    id?: number;
    title?: string;
    body?: string;
    post_type?: string;
    tag_ids?: number[];
  };
  disablePostType?: boolean;
  onSubmit: (data: {
    title: string;
    body: string;
    post_type: string;
    tag_ids: number[];
  }) => Promise<void>;
  submitLabel?: string;
}

const typeOptions = [
  { value: "discussion", label: "Discussion" },
  { value: "analysis", label: "Analysis" },
];

const adminTypeOptions = [
  { value: "news", label: "News" },
  { value: "weekly_recap", label: "Weekly Recap" },
];

const TITLE_LIMIT = 300;
const BODY_LIMIT = 50000;

export default function PostEditor({
  initial,
  disablePostType = false,
  onSubmit,
  submitLabel = "Publish post",
}: PostEditorProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [postType, setPostType] = useState(
    initial?.post_type ?? "discussion",
  );
  const [selectedTags, setSelectedTags] = useState<number[]>(
    initial?.tag_ids ?? [],
  );
  const [mode, setMode] = useState<"write" | "preview">("write");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const draftKey = initial?.id
    ? `discussion_draft_${initial.id}`
    : "discussion_draft_new";

  const { data: tags = [] } = useQuery<DiscussionTag[]>({
    queryKey: ["discussion-tags"],
    queryFn: fetchTags,
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (initial?.title || initial?.body) return;
    const stored = localStorage.getItem(draftKey);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as {
        title?: string;
        body?: string;
        postType?: string;
        tagIds?: number[];
      };
      if (parsed.title) setTitle(parsed.title);
      if (parsed.body) setBody(parsed.body);
      if (parsed.postType) setPostType(parsed.postType);
      if (parsed.tagIds) setSelectedTags(parsed.tagIds);
    } catch {
      // Ignore invalid drafts
    }
  }, [draftKey, initial?.title, initial?.body]);

  const groupedTags = useMemo(() => {
    const groups: Record<string, DiscussionTag[]> = {};
    for (const tag of tags) {
      const key = tag.category ?? "other";
      if (!groups[key]) groups[key] = [];
      groups[key].push(tag);
    }
    return groups;
  }, [tags]);

  const toggleTag = (id: number) => {
    setSelectedTags((prev) =>
      prev.includes(id) ? prev.filter((tagId) => tagId !== id) : [...prev, id],
    );
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!title.trim() || !body.trim()) {
      setError("Title and body are required.");
      return;
    }

    setIsSubmitting(true);

    try {
      await onSubmit({
        title: title.trim(),
        body: body.trim(),
        post_type: postType,
        tag_ids: selectedTags,
      });
      localStorage.removeItem(draftKey);
      setSuccess("Post saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save post.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveDraft = () => {
    setSuccess("");
    setError("");
    localStorage.setItem(
      draftKey,
      JSON.stringify({
        title,
        body,
        postType,
        tagIds: selectedTags,
      }),
    );
    setSuccess("Draft saved locally.");
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 border border-border-primary rounded-sm bg-bg-secondary/40 p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-widest text-text-muted">
            Post type
          </span>
          <select
            value={postType}
            onChange={(e) => setPostType(e.target.value)}
            disabled={disablePostType}
            className="bg-bg-primary border border-border-primary text-text-primary font-mono text-xs px-3 py-1.5 rounded-sm focus:outline-none focus:border-purple-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {typeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
            {isAdmin &&
              adminTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
          </select>
        </div>

        <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-text-muted">
          <span>{title.length}/{TITLE_LIMIT} title</span>
          <span>•</span>
          <span>{body.length}/{BODY_LIMIT} body</span>
        </div>
      </div>

      <div>
        <label
          htmlFor="post-title"
          className="block text-xs font-mono uppercase tracking-widest text-text-muted mb-2"
        >
          Title
        </label>
        <input
          id="post-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={TITLE_LIMIT}
          placeholder="Give your post a clear, searchable headline"
          className="w-full px-3 py-2 bg-bg-tertiary border border-border-primary rounded-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/40 transition-colors"
        />
      </div>

      <div>
        <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-text-muted mb-2">
          <button
            type="button"
            onClick={() => setMode("write")}
            className={`px-2.5 py-1 rounded-sm border transition-colors ${
              mode === "write"
                ? "bg-purple-500/20 border-purple-500 text-purple-200"
                : "border-border-primary text-text-muted hover:text-text-primary"
            }`}
          >
            Write
          </button>
          <button
            type="button"
            onClick={() => setMode("preview")}
            className={`px-2.5 py-1 rounded-sm border transition-colors ${
              mode === "preview"
                ? "bg-purple-500/20 border-purple-500 text-purple-200"
                : "border-border-primary text-text-muted hover:text-text-primary"
            }`}
          >
            Preview
          </button>
        </div>
        {mode === "write" ? (
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={BODY_LIMIT}
            rows={12}
            placeholder="Share your analysis, questions, or insights..."
            className="w-full px-3 py-3 bg-bg-tertiary border border-border-primary rounded-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/40 transition-colors resize-none"
          />
        ) : (
          <div className="min-h-[260px] rounded-sm border border-border-primary bg-bg-tertiary p-4">
            {body.trim() ? (
              <MarkdownContent content={body} />
            ) : (
              <p className="text-sm text-text-muted">
                Nothing to preview yet.
              </p>
            )}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-text-muted mb-2">
          Tags
        </div>
        {tags.length === 0 ? (
          <div className="text-sm text-text-muted">
            No tags available yet.
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedTags).map(([category, group]) => (
              <div key={category}>
                <div className="text-[10px] font-mono uppercase tracking-widest text-text-muted mb-2">
                  {category}
                </div>
                <div className="flex flex-wrap gap-2">
                  {group.map((tag) => (
                    <TagPill
                      key={tag.id}
                      label={tag.name}
                      color={tag.color}
                      active={selectedTags.includes(tag.id)}
                      onClick={() => toggleTag(tag.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleSaveDraft}
          >
            Save draft
          </Button>
          <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
            {submitLabel}
          </Button>
        </div>
        {success && (
          <span className="text-xs text-success font-mono uppercase tracking-widest">
            {success}
          </span>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-sm px-3 py-2">
          {error}
        </p>
      )}
    </form>
  );
}
