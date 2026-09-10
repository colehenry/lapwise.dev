"use client";

import { useEffect, useRef, useState } from "react";

interface ChatInputProps {
  onSend: (message: string) => Promise<void>;
  onAbort?: () => void;
  isLoading: boolean;
  disabled?: boolean;
  /** Seeds the composer once, for a question carried in from another page. */
  initialValue?: string;
}

const COMPOSER_MAX_HEIGHT_PX = 144;

/**
 * The prompt line, and the same one the homepage demo ends on: a caret, a
 * field that grows with the draft, and one filled control on the right.
 */
export default function ChatInput({
  onSend,
  onAbort,
  isLoading,
  disabled = false,
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
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, COMPOSER_MAX_HEIGHT_PX)}px`;
      el.style.overflowY =
        el.scrollHeight > COMPOSER_MAX_HEIGHT_PX ? "auto" : "hidden";
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

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-3 rounded-sm border border-line-strong bg-surface-panel py-2.5 pl-[15px] pr-2.5 transition-colors focus-within:border-accent"
    >
      <span
        aria-hidden="true"
        className={`shrink-0 font-mono text-[14px] leading-none text-accent-bright ${
          !isLoading && input.length === 0 ? "caret-blink" : ""
        }`}
      >
        ❯
      </span>
      <textarea
        ref={textareaRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask about any race, driver or season…"
        rows={1}
        maxLength={2000}
        disabled={isLoading || disabled}
        aria-label="Message Clutch"
        className="max-h-36 min-h-6 flex-1 resize-none self-center bg-transparent text-[14.5px] leading-[1.6] text-ink-strong outline-none placeholder:text-ink-faint disabled:opacity-50"
      />
      {isLoading && onAbort ? (
        <button
          type="button"
          onClick={onAbort}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-danger text-danger-bright transition-colors hover:bg-danger/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-bright"
          title="Stop generating"
          aria-label="Stop generating"
        >
          <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
            <title>Stop</title>
            <rect x="4" y="4" width="12" height="12" rx="1" />
          </svg>
        </button>
      ) : (
        <button
          type="submit"
          disabled={!input.trim() || isLoading || disabled}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-accent-bright bg-accent text-ink-strong transition-colors hover:bg-accent-bright disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-bright"
          aria-label="Send message"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <title>Send</title>
            <path d="M4 12h14" />
            <path d="M13 6l6 6-6 6" />
          </svg>
        </button>
      )}
    </form>
  );
}
