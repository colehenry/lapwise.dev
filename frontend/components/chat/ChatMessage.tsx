"use client";

import { useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import UserAvatar from "@/components/discussions/UserAvatar";
import type { ChartConfig } from "@/lib/chat";
import AIChart from "./AIChart";

interface ChatMessageProps {
  messageRole: "user" | "assistant";
  content: string;
  charts?: ChartConfig[];
  queries?: string[];
  isLoading?: boolean;
  statusText?: string | null;
  userName?: string;
  userAvatarUrl?: string | null;
}

function AIAnalystAvatar() {
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-purple-500/30 bg-purple-500/15 text-purple-300 shadow-[inset_0_0_18px_rgba(160,32,240,0.12)]">
      <svg
        className="h-5 w-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4 15.5 6.2 10A2 2 0 0 1 8 8.75h8a2 2 0 0 1 1.8 1.25L20 15.5" />
        <path d="M5 15.5h14v2a1.75 1.75 0 0 1-1.75 1.75h-1.5A1.75 1.75 0 0 1 14 17.5v-.25h-4V17.5a1.75 1.75 0 0 1-1.75 1.75h-1.5A1.75 1.75 0 0 1 5 17.5Z" />
        <circle cx="8" cy="15.25" r="1.1" />
        <circle cx="16" cy="15.25" r="1.1" />
        <path d="M8.5 8.75 10 6.5h4l1.5 2.25" />
      </svg>
    </div>
  );
}

export default function ChatMessage({
  messageRole,
  content,
  charts,
  queries,
  isLoading,
  statusText,
  userName,
  userAvatarUrl,
}: ChatMessageProps) {
  const [showSQL, setShowSQL] = useState(false);
  const isUser = messageRole === "user";

  if (isLoading) {
    return (
      <div className="flex gap-3 py-4">
        <AIAnalystAvatar />
        <div className="flex-1 pt-1">
          <div className="rounded-3xl border border-border-primary bg-bg-elevated/70 px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-text-muted">
              <svg
                className="animate-spin h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
              >
                <title>Thinking</title>
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
              Analyzing your question...
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex gap-3 py-4 ${isUser ? "flex-row-reverse" : ""}`}>
      <div className="shrink-0 pt-1">
        {isUser ? (
          <UserAvatar
            username={userName || "You"}
            avatarUrl={userAvatarUrl}
            size="md"
            className="rounded-2xl"
          />
        ) : (
          <AIAnalystAvatar />
        )}
      </div>

      <div className={`flex-1 min-w-0 ${isUser ? "text-right" : ""}`}>
        {isUser ? (
          <div className="inline-block max-w-[85%] rounded-3xl border border-border-primary bg-bg-elevated px-4 py-3 text-left text-sm text-text-primary shadow-[0_10px_26px_rgba(0,0,0,0.16)]">
            {content}
          </div>
        ) : (
          <div className="space-y-3 rounded-[28px] border border-border-primary bg-bg-elevated/55 px-4 py-4 shadow-[0_12px_30px_rgba(0,0,0,0.18)] md:px-5">
            {statusText && (
              <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-500/10 px-3 py-1 text-xs text-purple-300">
                <svg
                  className="h-3.5 w-3.5 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <title>Working</title>
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
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                {statusText}
              </div>
            )}

            <div className="prose-chat text-sm text-text-secondary leading-relaxed">
              <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
            </div>

            {charts && charts.length > 0 && (
              <div className="space-y-3">
                {charts.map((chart, i) => (
                  <AIChart key={`chart-${chart.title}-${i}`} config={chart} />
                ))}
              </div>
            )}

            {queries && queries.length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowSQL(!showSQL)}
                  className="text-xs text-text-muted hover:text-text-tertiary transition-colors flex items-center gap-1"
                >
                  <svg
                    className={`h-3 w-3 transition-transform ${showSQL ? "rotate-90" : ""}`}
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <title>Toggle</title>
                    <path
                      fillRule="evenodd"
                      d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {queries.length} SQL{" "}
                  {queries.length === 1 ? "query" : "queries"} executed
                </button>
                {showSQL && (
                  <div className="mt-2 space-y-2">
                    {queries.map((sql) => (
                      <pre
                        key={sql}
                        className="bg-bg-primary border border-border-primary rounded-sm p-3 text-xs text-text-tertiary overflow-x-auto font-mono"
                      >
                        {sql}
                      </pre>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
