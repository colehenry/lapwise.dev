"use client";

import { useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChartConfig } from "@/lib/chat";
import AIChart from "./AIChart";

interface ChatMessageProps {
  messageRole: "user" | "assistant";
  content: string;
  charts?: ChartConfig[];
  queries?: string[];
  isLoading?: boolean;
  statusText?: string | null;
}

export default function ChatMessage({
  messageRole,
  content,
  charts,
  queries,
  isLoading,
  statusText,
}: ChatMessageProps) {
  const [showSQL, setShowSQL] = useState(false);
  const isUser = messageRole === "user";

  if (isLoading) {
    return (
      <div className="flex gap-3 py-4">
        <div className="w-7 h-7 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center shrink-0">
          <span className="text-purple-400 text-xs font-bold">AI</span>
        </div>
        <div className="flex-1 pt-1">
          <div className="flex items-center gap-2 text-text-muted text-sm">
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
    );
  }

  return (
    <div className={`flex gap-3 py-4 ${isUser ? "flex-row-reverse" : ""}`}>
      {/* Avatar */}
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
          isUser
            ? "bg-bg-elevated border border-border-secondary"
            : "bg-purple-500/20 border border-purple-500/30"
        }`}
      >
        <span
          className={`text-xs font-bold ${isUser ? "text-text-secondary" : "text-purple-400"}`}
        >
          {isUser ? "U" : "AI"}
        </span>
      </div>

      {/* Message content */}
      <div className={`flex-1 min-w-0 ${isUser ? "text-right" : ""}`}>
        {isUser ? (
          <div className="inline-block bg-bg-elevated border border-border-primary rounded-lg px-4 py-2.5 text-sm text-text-primary text-left max-w-[85%]">
            {content}
          </div>
        ) : (
          <div className="space-y-3">
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

            {/* Markdown response */}
            <div className="prose-chat text-sm text-text-secondary leading-relaxed">
              <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
            </div>

            {/* Charts */}
            {charts && charts.length > 0 && (
              <div className="space-y-3">
                {charts.map((chart, i) => (
                  <AIChart key={`chart-${chart.title}-${i}`} config={chart} />
                ))}
              </div>
            )}

            {/* SQL queries toggle */}
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
