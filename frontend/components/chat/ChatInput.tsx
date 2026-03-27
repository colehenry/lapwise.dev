"use client";

import { useEffect, useRef, useState } from "react";

interface ChatInputProps {
  onSend: (message: string) => Promise<void>;
  onAbort?: () => void;
  isLoading: boolean;
  remaining: number | null;
  dailyLimit: number;
  compact?: boolean;
  shellless?: boolean;
}

export default function ChatInput({
  onSend,
  onAbort,
  isLoading,
  remaining: _remaining,
  dailyLimit: _dailyLimit,
  compact,
  shellless,
}: ChatInputProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: resize when the value changes
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${compact ? Math.min(el.scrollHeight, 80) : el.scrollHeight}px`;
    }
  }, [input, compact]);

  async function submitMessage() {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
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
      <div className="border-t border-white/[0.06] bg-bg-primary/90 px-3 py-2.5">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about F1..."
            rows={1}
            maxLength={2000}
            disabled={isLoading}
            className="flex-1 resize-none rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-purple-500/40 focus:outline-none focus:ring-1 focus:ring-purple-500/20 disabled:opacity-50"
          />
          {isLoading && onAbort ? (
            <button
              type="button"
              onClick={onAbort}
              className="shrink-0 rounded-xl bg-red-500/10 border border-red-500/20 p-2 text-red-400 transition-colors hover:bg-red-500/20"
              title="Stop"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <title>Stop</title>
                <rect x="4" y="4" width="12" height="12" rx="1" />
              </svg>
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="shrink-0 rounded-xl bg-purple-500 p-2 text-text-primary transition-colors hover:bg-purple-600 disabled:cursor-not-allowed disabled:opacity-50"
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
        shellless ? "" : "border-t border-white/[0.06] px-4 py-4 md:px-6"
      }
    >
      <form
        onSubmit={handleSubmit}
        className="chat-input-glass mx-auto flex max-w-4xl items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-2 backdrop-blur-xl transition-all duration-200 focus-within:border-purple-500/30 focus-within:shadow-[0_0_40px_-10px_rgba(160,32,240,0.15)]"
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything about F1..."
          rows={1}
          maxLength={2000}
          disabled={isLoading}
          className="flex-1 resize-none overflow-hidden bg-transparent py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none disabled:opacity-50"
        />
        {isLoading && onAbort ? (
          <button
            type="button"
            onClick={onAbort}
            className="shrink-0 flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 transition-all hover:bg-red-500/20 active:scale-95"
            title="Stop generating"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <title>Stop</title>
              <rect x="4" y="4" width="12" height="12" rx="1" />
            </svg>
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="shrink-0 flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500 text-text-primary transition-all hover:bg-purple-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
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
