"use client";

import { useEffect, useRef, useState } from "react";

interface ChatInputProps {
  onSend: (message: string) => Promise<void>;
  onAbort?: () => void;
  isLoading: boolean;
  disabled?: boolean;
  compact?: boolean;
  shellless?: boolean;
  /** Seeds the composer once, for a question carried in from another page. */
  initialValue?: string;
}

const COMPOSER_MAX_HEIGHT_PX = 144;
const COMPACT_COMPOSER_MAX_HEIGHT_PX = 80;

export default function ChatInput({
  onSend,
  onAbort,
  isLoading,
  disabled = false,
  compact,
  shellless,
  initialValue = "",
}: ChatInputProps) {
  const [input, setInput] = useState(initialValue);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const seeded = useRef(initialValue ?? "");

  useEffect(() => {
    if (!initialValue || seeded.current === initialValue) return;
    seeded.current = initialValue;
    setInput(initialValue);
  }, [initialValue]);

  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      const maxHeight = compact
        ? COMPACT_COMPOSER_MAX_HEIGHT_PX
        : COMPOSER_MAX_HEIGHT_PX;
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
      el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
    }
  });

  async function submitMessage() {
    const trimmed = input.trim();
    if (!trimmed || isLoading || disabled) return;
    setInput("");
    await onSend(trimmed);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await submitMessage();
  }

  async function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      await submitMessage();
    }
  }

  if (compact) {
    return (
      <div className="border-t border-[var(--glass-border)] bg-surface-page/90 px-3 py-2.5">
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about F1..."
            rows={1}
            maxLength={2000}
            disabled={isLoading || disabled}
            aria-label="Message Clutch"
            className="max-h-20 min-h-9 flex-1 resize-none rounded-xl border border-[var(--glass-border)] bg-[var(--glass-surface-soft)] px-3 py-2 text-sm text-ink-strong placeholder:text-ink-faint focus:border-accent/40 focus:outline-none focus:ring-1 focus:ring-accent/20 disabled:opacity-50"
          />
          {isLoading && onAbort ? (
            <button
              type="button"
              onClick={onAbort}
              className="shrink-0 rounded-xl bg-danger/10 border border-danger/20 p-2 text-danger-bright transition-colors hover:bg-danger/20"
              title="Stop"
              aria-label="Stop generating"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <title>Stop</title>
                <rect x="4" y="4" width="12" height="12" rx="1" />
              </svg>
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim() || isLoading || disabled}
              className="shrink-0 rounded-xl bg-accent p-2 text-ink-strong transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Send message"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <title>Send</title>
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
            </button>
          )}
        </form>
      </div>
    );
  }

  return (
    <div
      className={
        shellless
          ? ""
          : "border-t border-[var(--glass-border)] px-4 py-4 md:px-6"
      }
    >
      <form
        onSubmit={handleSubmit}
        className="chat-input-glass mx-auto flex max-w-4xl items-end gap-3 rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-surface)] px-4 py-2 backdrop-blur-xl transition-all duration-200 focus-within:border-accent/30 focus-within:shadow-[0_0_40px_-10px_rgba(160,32,240,0.15)]"
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything about F1..."
          rows={1}
          maxLength={2000}
          disabled={isLoading || disabled}
          aria-label="Message Clutch"
          className="max-h-36 min-h-10 flex-1 resize-none bg-transparent py-2 text-sm text-ink-strong placeholder:text-ink-faint focus:outline-none disabled:opacity-50"
        />
        {isLoading && onAbort ? (
          <button
            type="button"
            onClick={onAbort}
            className="shrink-0 flex h-10 w-10 items-center justify-center rounded-xl bg-danger/10 border border-danger/20 text-danger-bright transition-all hover:bg-danger/20 active:scale-95"
            title="Stop generating"
            aria-label="Stop generating"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <title>Stop</title>
              <rect x="4" y="4" width="12" height="12" rx="1" />
            </svg>
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim() || isLoading || disabled}
            className="shrink-0 flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-ink-strong transition-all hover:bg-accent active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Send message"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <title>Send</title>
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
          </button>
        )}
      </form>
    </div>
  );
}
