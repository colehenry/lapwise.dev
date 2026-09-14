"use client";

import { useLayoutEffect, useRef } from "react";
import type { DisplayMessage } from "@/lib/chatMessages";
import type { ClutchProgressStatus } from "@/lib/clutch-progress";
import ChatMessage from "./ChatMessage";
import SuggestedQuestions from "./SuggestedQuestions";

interface ChatTranscriptProps {
  messages: DisplayMessage[];
  error: string | null;
  streamingAssistantId: string | null;
  streamStatus: ClutchProgressStatus | null;
  isAsking: boolean;
  disabled: boolean;
  onSend: (question: string) => void;
  variant?: "page" | "dock";
}

const FOLLOW_DISTANCE_PX = 96;

export default function ChatTranscript({
  messages,
  error,
  streamingAssistantId,
  streamStatus,
  isAsking,
  disabled,
  onSend,
  variant = "page",
}: ChatTranscriptProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const shouldFollowRef = useRef(true);
  const previousMessageCountRef = useRef(0);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const appendedMessages = messages.slice(previousMessageCountRef.current);
    if (appendedMessages.some((message) => message.role === "user")) {
      shouldFollowRef.current = true;
    }

    if (shouldFollowRef.current) {
      viewport.scrollTop = viewport.scrollHeight;
    }
    previousMessageCountRef.current = messages.length;
  });

  function handleScroll() {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const distanceFromBottom =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
    shouldFollowRef.current = distanceFromBottom <= FOLLOW_DISTANCE_PX;
  }

  return (
    <div
      ref={viewportRef}
      onScroll={handleScroll}
      className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain [scrollbar-gutter:stable]"
      role="log"
      aria-label="Conversation"
      aria-live="polite"
      aria-busy={isAsking}
      aria-relevant="additions text"
    >
      {messages.length === 0 ? (
        variant === "page" && (
          <SuggestedQuestions onSelect={onSend} disabled={disabled} />
        )
      ) : (
        <div
          className={
            variant === "dock"
              ? "flex flex-col gap-2 px-3 py-3"
              : "page-frame py-5 md:py-7"
          }
        >
          <div className="mx-auto w-full min-w-0 max-w-3xl">
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                variant={variant}
                messageRole={message.role}
                content={message.content}
                charts={message.charts}
                followUps={message.followUps}
                onFollowUp={disabled ? undefined : onSend}
                isLoading={
                  message.id === streamingAssistantId &&
                  !message.content &&
                  !(message.charts && message.charts.length > 0)
                }
                isStreaming={message.id === streamingAssistantId && isAsking}
                progressStatus={
                  message.id === streamingAssistantId ? streamStatus : null
                }
              />
            ))}
          </div>
        </div>
      )}
      {error && (
        <div className="page-frame pb-5">
          <div
            className="mx-auto w-full max-w-3xl rounded-sm border border-danger bg-surface-panel px-3 py-2.5 text-[13px] text-danger-bright"
            role="alert"
          >
            {error}
          </div>
        </div>
      )}
    </div>
  );
}
