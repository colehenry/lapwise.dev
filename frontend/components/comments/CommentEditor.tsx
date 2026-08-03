"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";

interface CommentEditorProps {
  onSubmit: (body: string) => Promise<void>;
  onCancel?: () => void;
  placeholder?: string;
  submitLabel?: string;
  maxLength?: number;
  initialValue?: string;
  autoFocus?: boolean;
}

export default function CommentEditor({
  onSubmit,
  onCancel,
  placeholder = "Add a comment",
  submitLabel = "Comment",
  maxLength = 10000,
  initialValue = "",
  autoFocus = false,
}: CommentEditorProps) {
  const [body, setBody] = useState(initialValue);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const hasContent = body.trim().length > 0;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!hasContent) return;

    setIsSubmitting(true);
    setError("");

    try {
      await onSubmit(body.trim());
      setBody("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post comment");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        maxLength={maxLength}
        rows={hasContent ? 4 : 2}
        placeholder={placeholder}
        // biome-ignore lint/a11y/noAutofocus: only set when the user opens a reply box.
        autoFocus={autoFocus}
        className="w-full resize-y rounded-sm border border-border-primary bg-bg-secondary px-3 py-2.5 text-[15px] leading-relaxed text-text-primary placeholder:text-text-muted transition-colors focus:border-purple-500 focus:outline-none"
      />

      {(hasContent || onCancel) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {body.length > maxLength - 500 ? (
            <span className="text-[11px] font-mono uppercase tracking-wider text-text-muted">
              {maxLength - body.length} left
            </span>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-2">
            {onCancel && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onCancel}
              >
                Cancel
              </Button>
            )}
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSubmitting}
              disabled={!hasContent}
            >
              {submitLabel}
            </Button>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}
    </form>
  );
}
