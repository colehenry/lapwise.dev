"use client";

import { useEffect, useRef, useState } from "react";

interface ChatInputProps {
  onSend: (message: string) => Promise<void>;
  isLoading: boolean;
  remaining: number | null;
  dailyLimit: number;
}

export default function ChatInput({
  onSend,
  isLoading,
  remaining,
  dailyLimit,
}: ChatInputProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: resize when the value changes
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    }
  }, [input]);

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

  return (
    <div className="border-t border-border-primary bg-bg-secondary/95 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="max-w-4xl mx-auto px-4 py-3 flex gap-3 items-end"
      >
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about F1..."
            rows={1}
            maxLength={2000}
            disabled={isLoading}
            className="w-full bg-bg-tertiary border border-border-primary rounded-lg px-4 py-3 text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 disabled:opacity-50 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="bg-purple-500 text-text-primary px-4 py-3 rounded-lg font-medium text-sm hover:bg-purple-600 active:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
        >
          {isLoading ? (
            <svg
              className="animate-spin h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
            >
              <title>Sending</title>
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          ) : (
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <title>Send</title>
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
          )}
        </button>
      </form>
      {remaining !== null && (
        <div className="max-w-4xl mx-auto px-4 pb-2">
          <span className="text-text-muted text-xs">
            {remaining}/{dailyLimit} questions remaining today
          </span>
        </div>
      )}
    </div>
  );
}
