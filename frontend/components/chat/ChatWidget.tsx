"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import {
  type AskStreamEvent,
  type ChartConfig,
  streamQuestion,
  type ThinkingStep,
} from "@/lib/chat";
import ChatInput from "./ChatInput";
import ChatMessage from "./ChatMessage";
import SuggestedQuestions from "./SuggestedQuestions";

interface PanelMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  charts?: ChartConfig[];
  queries?: string[];
  steps?: ThinkingStep[];
}

const TOTAL_LIMIT = 3;
const HIDDEN_PATHS = ["/ask", "/login", "/register"];

function AIAnalystIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M9 4.5a.75.75 0 01.721.544l.813 2.846a3.75 3.75 0 002.576 2.576l2.846.813a.75.75 0 010 1.442l-2.846.813a3.75 3.75 0 00-2.576 2.576l-.813 2.846a.75.75 0 01-1.442 0l-.813-2.846a3.75 3.75 0 00-2.576-2.576l-2.846-.813a.75.75 0 010-1.442l2.846-.813A3.75 3.75 0 007.466 7.89l.813-2.846A.75.75 0 019 4.5zM18 1.5a.75.75 0 01.728.568l.258 1.036c.236.94.97 1.674 1.91 1.91l1.036.258a.75.75 0 010 1.456l-1.036.258c-.94.236-1.674.97-1.91 1.91l-.258 1.036a.75.75 0 01-1.456 0l-.258-1.036a2.625 2.625 0 00-1.91-1.91l-1.036-.258a.75.75 0 010-1.456l1.036-.258a2.625 2.625 0 001.91-1.91l.258-1.036A.75.75 0 0118 1.5zM16.5 15a.75.75 0 01.712.513l.394 1.183c.15.447.5.799.948.948l1.183.395a.75.75 0 010 1.422l-1.183.395c-.447.15-.799.5-.948.948l-.395 1.183a.75.75 0 01-1.422 0l-.395-1.183a1.5 1.5 0 00-.948-.948l-1.183-.395a.75.75 0 010-1.422l1.183-.395c.447-.15.799-.5.948-.948l.395-1.183A.75.75 0 0116.5 15z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export default function ChatWidget() {
  const { isAuthenticated, user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<PanelMessage[]>([]);
  const [isAsking, setIsAsking] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [streamStatus, setStreamStatus] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on new messages
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isAsking]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen]);

  if (!isAuthenticated || HIDDEN_PATHS.some((p) => pathname.startsWith(p))) {
    return null;
  }

  async function handleSend(question: string) {
    if (isAsking) return;
    setError(null);
    setIsAsking(true);
    setStreamStatus("Starting analysis...");

    const userMsg: PanelMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: question,
    };
    const assistantId = `assistant-${Date.now()}`;

    setMessages((prev) => [...prev, userMsg]);
    setStreamingId(assistantId);
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "", steps: [] },
    ]);

    try {
      await streamQuestion(
        question,
        conversationId ?? undefined,
        (event: AskStreamEvent) => {
          if (event.type === "init") {
            if (!conversationId) setConversationId(event.conversationId);
            setRemaining(event.remaining);
            return;
          }

          if (event.type === "text-delta") {
            setStreamStatus(null);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: m.content + event.text }
                  : m,
              ),
            );
            return;
          }

          if (event.type === "status") {
            setStreamStatus(event.message);
            if (event.stepType) {
              const step: ThinkingStep = {
                message: event.message,
                stepType: event.stepType,
                timestamp: Date.now(),
              };
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, steps: [...(m.steps || []), step] }
                    : m,
                ),
              );
            }
            return;
          }

          if (event.type === "metadata") {
            setConversationId(event.conversationId);
            setRemaining(event.remaining);
            setStreamStatus(null);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, charts: event.charts, queries: event.queries }
                  : m,
              ),
            );
            return;
          }

          if (event.type === "error") {
            throw new Error(event.error);
          }
        },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setMessages((prev) =>
        prev.filter((m) => m.id !== assistantId || m.content.trim().length > 0),
      );
    } finally {
      setStreamingId(null);
      setStreamStatus(null);
      setIsAsking(false);
    }
  }

  function handleNewChat() {
    setMessages([]);
    setConversationId(null);
    setStreamingId(null);
    setStreamStatus(null);
    setError(null);
  }

  function handleExpand() {
    if (conversationId) {
      router.push(`/ask?c=${conversationId}`);
    } else {
      router.push("/ask");
    }
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="chat-widget-bubble fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-2xl border border-purple-500/20 bg-purple-500/10 text-purple-300 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-xl transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-105 hover:border-purple-500/30 hover:bg-purple-500/[0.15] hover:shadow-[0_8px_32px_rgba(160,32,240,0.15)]"
        aria-label="Open AI Analyst"
      >
        <AIAnalystIcon className="h-6 w-6" />
      </button>
    );
  }

  return (
    <div className="chat-widget-panel fixed bottom-6 right-6 z-50 flex h-[min(600px,calc(100vh-6rem))] w-[min(420px,calc(100vw-3rem))] flex-col overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] shadow-[0_16px_48px_rgba(0,0,0,0.5)] backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-purple-500/20 bg-purple-500/10 text-purple-300">
            <AIAnalystIcon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-text-primary">
                AI Analyst
              </span>
              <span className="rounded-full border border-purple-500/20 bg-purple-500/[0.08] px-1.5 py-0.5 text-[8px] font-mono uppercase tracking-[0.1em] text-purple-300">
                Beta
              </span>
            </div>
            {remaining !== null && (
              <div className="text-[10px] text-text-muted">
                {remaining} queries left
              </div>
            )}
            {remaining === null && user?.role === "admin" && (
              <div className="text-[10px] text-text-muted">
                Unlimited queries
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={handleNewChat}
              className="rounded-lg p-1.5 text-text-muted transition-all hover:bg-white/[0.04] hover:text-text-secondary"
              title="New chat"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <title>New chat</title>
                <path d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" />
              </svg>
            </button>
          )}

          <button
            type="button"
            onClick={handleExpand}
            disabled={isAsking}
            className="rounded-lg p-1.5 text-text-muted transition-all hover:bg-white/[0.04] hover:text-text-secondary disabled:opacity-50 disabled:cursor-not-allowed"
            title="Open full page"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <title>Expand</title>
              <path
                fillRule="evenodd"
                d="M3.5 2A1.5 1.5 0 002 3.5v4a.5.5 0 001 0v-4a.5.5 0 01.5-.5h4a.5.5 0 000-1h-4zm9 0a.5.5 0 000 1h4a.5.5 0 01.5.5v4a.5.5 0 001 0v-4A1.5 1.5 0 0016.5 2h-4zM3 12.5a.5.5 0 00-1 0v4A1.5 1.5 0 003.5 18h4a.5.5 0 000-1h-4a.5.5 0 01-.5-.5v-4zm15 0a.5.5 0 00-1 0v4a.5.5 0 01-.5.5h-4a.5.5 0 000 1h4a1.5 1.5 0 001.5-1.5v-4z"
                clipRule="evenodd"
              />
            </svg>
          </button>

          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="rounded-lg p-1.5 text-text-muted transition-all hover:bg-white/[0.04] hover:text-text-secondary"
            title="Minimize"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <title>Minimize</title>
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <SuggestedQuestions onSelect={handleSend} compact />
        ) : (
          <div className="px-3 py-3">
            {messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                messageRole={msg.role}
                content={msg.content}
                charts={msg.charts}
                queries={msg.queries}
                steps={msg.steps}
                isLoading={
                  msg.id === streamingId &&
                  !msg.content &&
                  !(msg.charts && msg.charts.length > 0)
                }
                isStreaming={msg.id === streamingId && isAsking}
                statusText={msg.id === streamingId ? streamStatus : null}
                compact
                userName={user?.username}
                userAvatarUrl={user?.avatar_url}
              />
            ))}
            {error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/[0.08] px-3 py-2 text-xs text-red-400">
                {error}
              </div>
            )}
            <div ref={scrollRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        isLoading={isAsking}
        remaining={remaining}
        dailyLimit={TOTAL_LIMIT}
        compact
      />
    </div>
  );
}
