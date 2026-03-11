"use client";

import { useState } from "react";
import MarkdownContent from "@/components/discussions/MarkdownContent";
import Button from "@/components/ui/Button";

interface CommentEditorProps {
  onSubmit: (body: string) => Promise<void>;
  onCancel?: () => void;
  placeholder?: string;
  submitLabel?: string;
  maxLength?: number;
  initialValue?: string;
}

export default function CommentEditor({
  onSubmit,
  onCancel,
  placeholder = "Write a reply...",
  submitLabel = "Post comment",
  maxLength = 10000,
  initialValue = "",
}: CommentEditorProps) {
  const [body, setBody] = useState(initialValue);
  const [mode, setMode] = useState<"write" | "preview">("write");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!body.trim()) return;

    setIsSubmitting(true);
    setError("");

    try {
      await onSubmit(body.trim());
      setBody("");
      setMode("write");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post comment");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="border border-border-primary rounded-sm bg-bg-secondary/60 p-3 space-y-3"
    >
      <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest">
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
          onChange={(event) => setBody(event.target.value)}
          maxLength={maxLength}
          rows={4}
          placeholder={placeholder}
          className="w-full px-3 py-2 bg-bg-tertiary border border-border-primary rounded-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/40 transition-colors resize-none"
        />
      ) : (
        <div className="min-h-[120px] rounded-sm border border-border-primary bg-bg-tertiary p-3">
          {body.trim() ? (
            <MarkdownContent content={body} />
          ) : (
            <p className="text-sm text-text-muted">Nothing to preview yet.</p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-[10px] font-mono uppercase tracking-widest text-text-muted">
          {body.length}/{maxLength}
        </span>

        <div className="flex items-center gap-2">
          {onCancel && (
            <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button
            type="submit"
            variant="primary"
            size="sm"
            isLoading={isSubmitting}
          >
            {submitLabel}
          </Button>
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-sm px-3 py-2">
          {error}
        </p>
      )}
    </form>
  );
}
