"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { ChartConfig } from "@/lib/chat";
import type { ClutchProgressStatus } from "@/lib/clutch-progress";
import ChatAnswerMarkdown from "./ChatAnswerMarkdown";
import ClutchProgress from "./ClutchProgress";

const AIChart = dynamic(() => import("./AIChart"), {
  ssr: false,
  loading: () => (
    <div className="h-[340px] rounded-sm border border-line-soft bg-surface-panel" />
  ),
});

interface ChatMessageProps {
  messageRole: "user" | "assistant";
  content: string;
  charts?: ChartConfig[];
  followUps?: string[];
  onFollowUp?: (question: string) => void;
  isLoading?: boolean;
  isStreaming?: boolean;
  progressStatus?: ClutchProgressStatus | null;
}

/**
 * One turn of the transcript.
 *
 * A question is the prompt line the homepage demo writes; an answer is prose
 * under it. Neither is a bubble — the hairline above each question is the only
 * thing separating one exchange from the next.
 */
export default function ChatMessage({
  messageRole,
  content,
  charts,
  followUps,
  onFollowUp,
  isLoading,
  isStreaming,
  progressStatus,
}: ChatMessageProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard not available
    }
  }

  if (messageRole === "user") {
    return (
      <p className="m-0 flex min-w-0 max-w-full justify-end gap-2.5 border-t border-line-soft pt-5 text-right font-mono text-[13.5px] leading-[1.6] text-ink-strong first:border-t-0 first:pt-0 md:text-[14.5px]">
        <span className="min-w-0 whitespace-pre-wrap break-words">
          {content}
        </span>
        <span aria-hidden="true" className="shrink-0 text-accent-bright">
          ❮
        </span>
      </p>
    );
  }

  return (
    <article
      className="mt-3.5 min-w-0 max-w-full space-y-3 overflow-hidden pb-5"
      aria-label="Clutch response"
      aria-busy={Boolean(isLoading || isStreaming)}
    >
      {(isStreaming || isLoading) && (
        <ClutchProgress status={progressStatus ?? { stage: "starting" }} />
      )}

      {content && (
        <ChatAnswerMarkdown
          content={content}
          isStreaming={Boolean(isStreaming)}
        />
      )}

      {charts && charts.length > 0 && (
        <div className="min-w-0 max-w-full space-y-3 overflow-hidden">
          {charts.map((chart, i) => (
            <AIChart key={`chart-${chart.title}-${i}`} config={chart} />
          ))}
        </div>
      )}

      {!isStreaming && content && (
        <div className="flex items-start justify-between gap-2 pt-0.5">
          <div className="flex min-w-0 flex-1 flex-wrap gap-2">
            {followUps &&
              followUps.length > 0 &&
              onFollowUp &&
              followUps.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => onFollowUp(q)}
                  className="max-w-full break-words rounded-sm border border-line-soft bg-surface-panel px-3 py-[7px] text-left text-[12.5px] text-ink-soft transition-colors hover:border-accent hover:text-ink-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-bright"
                >
                  {q}
                </button>
              ))}
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="ml-2 shrink-0 rounded-sm p-1.5 text-ink-faint transition-colors hover:text-ink-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-bright"
            title="Copy response"
          >
            {copied ? (
              <svg
                className="h-3.5 w-3.5 text-success"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <title>Copied</title>
                <path
                  fillRule="evenodd"
                  d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <svg
                className="h-3.5 w-3.5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <title>Copy</title>
                <path d="M7 3.5A1.5 1.5 0 018.5 2h3.879a1.5 1.5 0 011.06.44l3.122 3.12A1.5 1.5 0 0117 6.622V12.5a1.5 1.5 0 01-1.5 1.5h-1v-3.379a3 3 0 00-.879-2.121L10.5 5.379A3 3 0 008.379 4.5H7v-1z" />
                <path d="M4.5 6A1.5 1.5 0 003 7.5v9A1.5 1.5 0 004.5 18h7a1.5 1.5 0 001.5-1.5v-5.879a1.5 1.5 0 00-.44-1.06L9.44 6.439A1.5 1.5 0 008.378 6H4.5z" />
              </svg>
            )}
          </button>
        </div>
      )}
    </article>
  );
}
