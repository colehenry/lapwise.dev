"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import ChatInput from "@/components/chat/ChatInput";
import ChatMessage from "@/components/chat/ChatMessage";
import ConversationSidebar from "@/components/chat/ConversationSidebar";
import SuggestedQuestions from "@/components/chat/SuggestedQuestions";
import {
  type AskStreamEvent,
  type ChartConfig,
  deleteConversation,
  getConversation,
  listConversations,
  streamQuestion,
} from "@/lib/chat";

interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  charts?: ChartConfig[];
  queries?: string[];
}

const DAILY_LIMIT = 20;

function parseStringArray(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  return undefined;
}

function parseChartArray(value: unknown): ChartConfig[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value as ChartConfig[];
}

function AIAnalystIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      className={className}
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
  );
}

export default function AskPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [isAsking, setIsAsking] = useState(false);
  const [streamingAssistantId, setStreamingAssistantId] = useState<
    string | null
  >(null);
  const [streamStatus, setStreamStatus] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch conversations list
  const { data: conversations = [] } = useQuery({
    queryKey: ["ai-conversations"],
    queryFn: listConversations,
    enabled: isAuthenticated,
    refetchOnWindowFocus: false,
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll after chat updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isAsking]);

  // Load a conversation's messages
  const loadConversation = useCallback(async (convId: string) => {
    try {
      const data = await getConversation(convId);
      setActiveConversationId(convId);
      setMessages(
        data.messages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            content: m.content,
            charts: parseChartArray(m.tool_results),
            queries: parseStringArray(m.tool_calls),
          })),
      );
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load conversation",
      );
    }
  }, []);

  // Start a new conversation
  function handleNewConversation() {
    setActiveConversationId(null);
    setMessages([]);
    setStreamingAssistantId(null);
    setStreamStatus(null);
    setError(null);
  }

  // Delete a conversation
  async function handleDeleteConversation(id: string) {
    try {
      await deleteConversation(id);
      queryClient.invalidateQueries({ queryKey: ["ai-conversations"] });
      if (activeConversationId === id) {
        handleNewConversation();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete conversation",
      );
    }
  }

  // Send a message
  async function handleSend(question: string) {
    setError(null);
    setIsAsking(true);
    setStreamStatus("Starting analysis...");

    // Add user message immediately
    const userMsg: DisplayMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: question,
    };
    const assistantMsgId = `assistant-${Date.now()}`;

    setMessages((prev) => [...prev, userMsg]);
    setStreamingAssistantId(assistantMsgId);

    try {
      setMessages((prev) => [
        ...prev,
        {
          id: assistantMsgId,
          role: "assistant",
          content: "",
        },
      ]);

      await streamQuestion(
        question,
        activeConversationId ?? undefined,
        (event: AskStreamEvent) => {
          if (event.type === "init") {
            if (!activeConversationId) {
              setActiveConversationId(event.conversationId);
            }
            setRemaining(event.remaining);
            return;
          }

          if (event.type === "text-delta") {
            setStreamStatus("Writing report...");
            setMessages((prev) =>
              prev.map((message) =>
                message.id === assistantMsgId
                  ? { ...message, content: message.content + event.text }
                  : message,
              ),
            );
            return;
          }

          if (event.type === "status") {
            setStreamStatus(event.message);
            return;
          }

          if (event.type === "metadata") {
            setActiveConversationId(event.conversationId);
            setRemaining(event.remaining);
            setStreamStatus(null);
            setMessages((prev) =>
              prev.map((message) =>
                message.id === assistantMsgId
                  ? {
                      ...message,
                      charts: event.charts,
                      queries: event.queries,
                    }
                  : message,
              ),
            );
            return;
          }

          if (event.type === "error") {
            throw new Error(event.error);
          }
        },
      );

      // Refresh conversations list
      queryClient.invalidateQueries({ queryKey: ["ai-conversations"] });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Something went wrong";
      setError(errorMessage);
      setMessages((prev) =>
        prev.filter(
          (message) =>
            message.id !== assistantMsgId || message.content.trim().length > 0,
        ),
      );
    } finally {
      setStreamingAssistantId(null);
      setStreamStatus(null);
      setIsAsking(false);
    }
  }

  // Auth loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-bg-secondary flex items-center justify-center">
        <div className="text-text-muted text-sm">Loading...</div>
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-bg-secondary md:pl-24">
        <div className="px-4 pt-20 md:pt-24">
          <div className="mx-auto max-w-7xl">
            <div className="flex items-center justify-between rounded-3xl border border-border-primary bg-bg-primary/80 px-5 py-4 shadow-[0_16px_48px_rgba(0,0,0,0.35)] backdrop-blur-xl">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-purple-500/30 bg-purple-500/15 text-purple-300">
                  <AIAnalystIcon className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-sm font-bold uppercase tracking-[0.2em] text-text-primary">
                    Lapwise AI Analyst
                  </div>
                  <div className="text-xs text-text-muted">
                    Live race analysis, historical comparisons, and data-backed
                    reports
                  </div>
                </div>
              </div>
              <div className="hidden rounded-full border border-border-primary bg-bg-elevated px-3 py-1 text-[11px] font-mono uppercase tracking-widest text-text-muted md:block">
                Sign in required
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center px-4 py-24">
          <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-3xl border border-purple-500/30 bg-purple-500/15 text-purple-300">
            <AIAnalystIcon className="h-8 w-8" />
          </div>
          <h2 className="text-text-primary text-lg font-bold mb-2">
            Sign in to use the AI Analyst
          </h2>
          <p className="text-text-muted text-sm mb-6 text-center max-w-md">
            Ask any question about Formula 1 and get expert analysis powered by
            AI.
          </p>
          <Link
            href="/login?redirect=/ask"
            className="bg-purple-500 text-text-primary px-6 py-2.5 rounded-lg font-medium text-sm hover:bg-purple-600 transition-colors"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  const hasMessages = messages.length > 0;
  const activeConversation = conversations.find(
    (conversation) => conversation.id === activeConversationId,
  );

  return (
    <div className="min-h-screen bg-bg-secondary md:pl-24">
      <div className="px-4 pb-4 pt-20 md:pt-24">
        <div className="mx-auto flex max-w-7xl gap-4 xl:gap-6">
          <div className="min-w-0 flex-1">
            <div className="mb-4 rounded-3xl border border-border-primary bg-bg-primary/85 p-4 shadow-[0_16px_48px_rgba(0,0,0,0.35)] backdrop-blur-xl md:p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-purple-500/30 bg-purple-500/15 text-purple-300">
                    <AIAnalystIcon className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-lg font-bold text-text-primary">
                        Lapwise AI Analyst
                      </h1>
                      <span className="rounded-full border border-purple-500/20 bg-purple-500/10 px-2.5 py-1 text-[10px] font-mono uppercase tracking-widest text-purple-300">
                        Beta
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-text-muted">
                      Ask about race weekends, strategy, weather, telemetry, or
                      historical comparisons.
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-mono uppercase tracking-widest text-text-muted">
                      <span className="rounded-full border border-border-primary bg-bg-elevated px-3 py-1">
                        {isAsking
                          ? streamStatus || "Analyzing"
                          : activeConversation?.title || "New conversation"}
                      </span>
                      {remaining !== null && (
                        <span className="rounded-full border border-border-primary bg-bg-elevated px-3 py-1">
                          {remaining} left today
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleNewConversation}
                    className="rounded-full border border-border-primary bg-bg-elevated px-4 py-2 text-xs font-mono font-bold uppercase tracking-widest text-text-secondary transition-colors hover:border-purple-500/40 hover:text-text-primary"
                  >
                    New chat
                  </button>
                  <button
                    type="button"
                    onClick={() => setSidebarOpen(true)}
                    className="rounded-full border border-border-primary bg-bg-elevated px-4 py-2 text-xs font-mono font-bold uppercase tracking-widest text-text-secondary transition-colors hover:border-purple-500/40 hover:text-text-primary lg:hidden"
                  >
                    History
                  </button>
                </div>
              </div>
            </div>

            <div className="flex min-h-[calc(100vh-12rem)] flex-col overflow-hidden rounded-[28px] border border-border-primary bg-bg-primary/75 shadow-[0_16px_48px_rgba(0,0,0,0.35)] backdrop-blur-xl">
              <div className="flex-1 overflow-y-auto">
                {!hasMessages ? (
                  <SuggestedQuestions onSelect={handleSend} />
                ) : (
                  <div className="mx-auto max-w-4xl px-4 py-5 md:px-6">
                    {messages.map((msg) => (
                      <ChatMessage
                        key={msg.id}
                        messageRole={msg.role}
                        content={msg.content}
                        charts={msg.charts}
                        queries={msg.queries}
                        isLoading={
                          msg.id === streamingAssistantId &&
                          !msg.content &&
                          !(msg.charts && msg.charts.length > 0)
                        }
                        statusText={
                          msg.id === streamingAssistantId ? streamStatus : null
                        }
                        userName={user.username}
                        userAvatarUrl={user.avatar_url}
                      />
                    ))}
                    {error && (
                      <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                        {error}
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              <ChatInput
                onSend={handleSend}
                isLoading={isAsking}
                remaining={remaining}
                dailyLimit={DAILY_LIMIT}
              />
            </div>
          </div>

          <ConversationSidebar
            conversations={conversations}
            activeId={activeConversationId}
            onSelect={loadConversation}
            onNew={handleNewConversation}
            onDelete={handleDeleteConversation}
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />
        </div>
      </div>
    </div>
  );
}
