"use client";

import { useLayoutEffect, useRef } from "react";
import type { DisplayMessage } from "@/lib/chatMessages";
import ChatMessage from "./ChatMessage";
import SuggestedQuestions from "./SuggestedQuestions";

interface ChatTranscriptProps {
  messages: DisplayMessage[];
  error: string | null;
  streamingAssistantId: string | null;
  streamStatus: string | null;
  isAsking: boolean;
  disabled: boolean;
  userName: string;
  userAvatarUrl?: string | null;
  onSend: (question: string) => void;
}

const FOLLOW_DISTANCE_PX = 96;

export default function ChatTranscript({
  messages,
  error,
  streamingAssistantId,
  streamStatus,
  isAsking,
  disabled,
  userName,
  userAvatarUrl,
  onSend,
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
        <SuggestedQuestions onSelect={onSend} disabled={disabled} />
      ) : (
        <div className="mx-auto w-full max-w-4xl min-w-0 px-3 py-4 md:px-4 md:py-6">
          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              messageRole={message.role}
              content={message.content}
              charts={message.charts}
              queries={message.queries}
              steps={message.steps}
              followUps={message.followUps}
              onFollowUp={disabled ? undefined : onSend}
              isLoading={
                message.id === streamingAssistantId &&
                !message.content &&
                !(message.charts && message.charts.length > 0)
              }
              isStreaming={message.id === streamingAssistantId && isAsking}
              statusText={
                message.id === streamingAssistantId ? streamStatus : null
              }
              userName={userName}
              userAvatarUrl={userAvatarUrl}
            />
          ))}
        </div>
      )}
      {error && (
        <div
          className="mx-auto mb-4 w-[calc(100%_-_1.5rem)] max-w-4xl rounded-xl border border-red-500/20 bg-red-500/[0.08] px-4 py-3 text-sm text-red-400"
          role="alert"
        >
          {error}
        </div>
      )}
    </div>
  );
}
