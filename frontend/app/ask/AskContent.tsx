"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import ChatInput from "@/components/chat/ChatInput";
import ChatMessage from "@/components/chat/ChatMessage";
import ConversationSidebar from "@/components/chat/ConversationSidebar";
import SuggestedQuestions from "@/components/chat/SuggestedQuestions";
import PageHeader from "@/components/PageHeader";
import ClutchIcon from "@/components/ui/ClutchIcon";
import { SUGGESTION_QUESTIONS } from "@/lib/ai/suggestions";
import {
  type AskStreamEvent,
  type CachedResponse,
  type ChartConfig,
  deleteConversation,
  fetchCachedResponse,
  getConversation,
  listConversations,
  renameConversation,
  streamQuestion,
  type ThinkingStep,
} from "@/lib/chat";

interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  charts?: ChartConfig[];
  queries?: string[];
  steps?: ThinkingStep[];
  followUps?: string[];
}

const TOTAL_LIMIT = 3;

function parseStringArray(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  return undefined;
}

function parseChartArray(value: unknown): ChartConfig[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value as ChartConfig[];
}

export default function AskContent() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

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
  const [pendingConversationId, setPendingConversationId] = useState<
    string | null
  >(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  // Lock background scroll on mobile so nav/footer don't drift behind the fixed chat panel.
  useEffect(() => {
    if (typeof window === "undefined" || window.innerWidth >= 768) return;
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = prev;
    };
  }, []);

  const { data: conversations = [] } = useQuery({
    queryKey: ["ai-conversations"],
    queryFn: listConversations,
    enabled: isAuthenticated,
    refetchOnWindowFocus: false,
  });

  const loadConversation = useCallback(async (convId: string) => {
    setPendingConversationId(convId);
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
    } finally {
      setPendingConversationId(null);
    }
  }, []);

  // Load conversation from ?c= query param (e.g. from widget expand)
  useEffect(() => {
    const convParam = searchParams.get("c");
    if (convParam && isAuthenticated && !activeConversationId) {
      loadConversation(convParam);
    }
  }, [searchParams, isAuthenticated, activeConversationId, loadConversation]);

  function handleNewConversation() {
    setActiveConversationId(null);
    setMessages([]);
    setStreamingAssistantId(null);
    setStreamStatus(null);
    setError(null);
  }

  function handleAbort() {
    abortRef.current?.abort();
  }

  async function handleRenameConversation(id: string, title: string) {
    try {
      await renameConversation(id, title);
      queryClient.invalidateQueries({ queryKey: ["ai-conversations"] });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to rename conversation",
      );
    }
  }

  async function simulateStreaming(
    cached: CachedResponse,
    assistantMsgId: string,
  ) {
    setStreamingAssistantId(assistantMsgId);
    setMessages((prev) => [
      ...prev,
      { id: assistantMsgId, role: "assistant", content: "", steps: [] },
    ]);

    const text = cached.text;
    const chunkSize = 4;
    for (let i = 0; i < text.length; i += chunkSize) {
      await new Promise<void>((resolve) => setTimeout(resolve, 12));
      const chunk = text.slice(i, i + chunkSize);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId ? { ...m, content: m.content + chunk } : m,
        ),
      );
    }

    setMessages((prev) =>
      prev.map((m) =>
        m.id === assistantMsgId
          ? {
              ...m,
              charts: cached.charts,
              queries: cached.queries,
              followUps: cached.followUps,
            }
          : m,
      ),
    );
  }

  async function handleDeleteConversation(id: string) {
    setDeletingId(id);
    // Optimistic update — remove immediately from cache
    queryClient.setQueryData<import("@/lib/chat").ChatConversation[]>(
      ["ai-conversations"],
      (prev) => prev?.filter((c) => c.id !== id) ?? [],
    );
    if (activeConversationId === id) handleNewConversation();
    try {
      await deleteConversation(id);
    } catch (err) {
      // Revert on failure
      queryClient.invalidateQueries({ queryKey: ["ai-conversations"] });
      setError(
        err instanceof Error ? err.message : "Failed to delete conversation",
      );
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSend(question: string) {
    if (isAsking) return;
    // Lock immediately — before any async work — so rapid clicks can't queue a second call
    setIsAsking(true);
    setError(null);

    // Show user message right away so the view transitions to chat instantly
    const userMsgId = `user-${Date.now()}`;
    const assistantMsgId = `assistant-${Date.now() + 1}`;
    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: "user", content: question },
    ]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // Check cache for suggestion questions
      if (SUGGESTION_QUESTIONS.has(question) && !activeConversationId) {
        const cached = await fetchCachedResponse(question);
        if (cached) {
          await simulateStreaming(cached, assistantMsgId);
          return;
        }
      }

      setStreamStatus("Starting analysis...");
      setStreamingAssistantId(assistantMsgId);
      setMessages((prev) => [
        ...prev,
        { id: assistantMsgId, role: "assistant", content: "", steps: [] },
      ]);

      await streamQuestion(
        question,
        activeConversationId ?? undefined,
        (event: AskStreamEvent) => {
          if (event.type === "init") {
            if (!activeConversationId)
              setActiveConversationId(event.conversationId);
            setRemaining(event.remaining);
            return;
          }

          if (event.type === "text-delta") {
            setStreamStatus(null);
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
            if (event.stepType) {
              const step: ThinkingStep = {
                message: event.message,
                stepType: event.stepType,
                timestamp: Date.now(),
              };
              setMessages((prev) =>
                prev.map((message) =>
                  message.id === assistantMsgId
                    ? {
                        ...message,
                        steps: [...(message.steps || []), step],
                      }
                    : message,
                ),
              );
            }
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
                      followUps: event.followUps,
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
        controller.signal,
      );

      queryClient.invalidateQueries({ queryKey: ["ai-conversations"] });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        // User aborted — keep partial content if any
        return;
      }
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
      abortRef.current = null;
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-bg-secondary">
        <div className="flex items-center justify-center py-32">
          <div className="text-text-muted text-sm">Loading...</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-bg-secondary">
        <PageHeader title="Clutch" subtitle="F1 Intelligence" />
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-6">
          <div className="flex flex-col items-center justify-center py-24">
            <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-3xl border border-purple-500/20 bg-purple-500/10 text-purple-300 shadow-[0_0_40px_-10px_rgba(160,32,240,0.25)]">
              <ClutchIcon className="h-8 w-8" />
            </div>
            <h2 className="text-text-primary text-lg font-bold tracking-tight mb-2">
              Sign in to ask Clutch
            </h2>
            <p className="text-text-muted text-sm mb-6 text-center max-w-md">
              Ask Clutch any question about Formula 1 and get expert analysis
              powered by AI.
            </p>
            <Link
              href="/login?redirect=/ask"
              className="bg-purple-500 text-text-primary px-6 py-2.5 rounded-2xl font-mono text-xs font-bold uppercase tracking-widest hover:bg-purple-600 transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const hasMessages = messages.length > 0;

  return (
    // Mobile: fixed panel sized from nav bottom (top-14) to dock top (bottom-[3.5rem+safe-area]).
    // 3.5rem matches actual dock height (min-h-12 + p-1 + pb-safe).
    // background scroll lock (useEffect above) prevents nav/footer ghosting behind panel.
    <div className="fixed inset-x-0 top-14 bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] flex flex-col overflow-hidden bg-bg-secondary md:static md:inset-auto md:flex-none md:overflow-visible md:min-h-screen">
      <PageHeader title="Clutch" compactMobile>
        {remaining !== null && (
          <span className="hidden sm:block rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.1em] text-text-muted">
            {remaining}/{TOTAL_LIMIT}
          </span>
        )}
        {remaining === null && user.role === "admin" && (
          <span className="hidden sm:block rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.1em] text-text-muted">
            Unlimited
          </span>
        )}
        <button
          type="button"
          onClick={handleNewConversation}
          className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 font-mono text-[11px] font-bold text-text-secondary transition-all hover:border-purple-500/30 hover:bg-purple-500/10 hover:text-purple-300 sm:px-4 sm:text-xs"
        >
          <span className="sm:hidden">New</span>
          <span className="hidden sm:inline">+ New Chat</span>
        </button>
        <button
          type="button"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className={`rounded-lg border p-2 font-mono text-xs font-bold transition-all ${
            sidebarOpen
              ? "border-purple-500/30 bg-purple-500/10 text-purple-300"
              : "border-white/[0.06] bg-white/[0.03] text-text-muted hover:border-purple-500/30 hover:text-purple-300"
          }`}
          title="Chat history"
        >
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <title>History</title>
            <path
              fillRule="evenodd"
              d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zm0 10.5a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </PageHeader>

      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-[radial-gradient(circle,rgba(160,32,240,0.06)_0%,transparent_70%)]" />
      </div>

      {/* Chat card — flex-1 on mobile fills remaining height; desktop keeps card layout */}
      <div className="relative flex flex-1 flex-col overflow-hidden md:block md:flex-none md:max-w-6xl md:mx-auto md:px-8 md:py-6">
        <div className="relative flex flex-1 flex-col overflow-hidden md:block md:flex-none md:rounded-2xl md:border md:border-white/[0.06] md:bg-white/[0.02] md:shadow-[0_16px_64px_-16px_rgba(0,0,0,0.5)] md:backdrop-blur-xl">
          {/* Main chat area */}
          <div
            className={`flex flex-1 flex-col overflow-hidden md:grid md:min-h-0 md:min-w-0 md:grid-rows-[minmax(0,1fr)_auto] ${
              sidebarOpen ? "md:pr-72" : ""
            }`}
          >
            {/* Messages / suggestions — scrollable on mobile */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden md:min-h-0">
              {!hasMessages ? (
                <SuggestedQuestions onSelect={handleSend} disabled={isAsking} />
              ) : (
                <div className="min-w-0 px-3 py-4 md:px-4 md:py-6">
                  {messages.map((msg) => (
                    <ChatMessage
                      key={msg.id}
                      messageRole={msg.role}
                      content={msg.content}
                      charts={msg.charts}
                      queries={msg.queries}
                      steps={msg.steps}
                      followUps={msg.followUps}
                      onFollowUp={handleSend}
                      isLoading={
                        msg.id === streamingAssistantId &&
                        !msg.content &&
                        !(msg.charts && msg.charts.length > 0)
                      }
                      isStreaming={msg.id === streamingAssistantId && isAsking}
                      statusText={
                        msg.id === streamingAssistantId ? streamStatus : null
                      }
                      userName={user.username}
                      userAvatarUrl={user.avatar_url}
                    />
                  ))}
                  {error && (
                    <div className="rounded-xl border border-red-500/20 bg-red-500/[0.08] px-4 py-3 text-sm text-red-400">
                      {error}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Input — pinned at bottom on mobile */}
            <div className="shrink-0 border-t border-white/[0.06] bg-bg-secondary px-3 py-3 md:px-6 md:py-4">
              <ChatInput
                onSend={handleSend}
                onAbort={handleAbort}
                isLoading={isAsking}
                remaining={remaining}
                dailyLimit={TOTAL_LIMIT}
                shellless
              />
            </div>
          </div>

          {/* Inline collapsible sidebar */}
          <ConversationSidebar
            conversations={conversations}
            activeId={activeConversationId}
            pendingId={pendingConversationId}
            deletingId={deletingId}
            onSelect={loadConversation}
            onNew={handleNewConversation}
            onDelete={handleDeleteConversation}
            onRename={handleRenameConversation}
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />
        </div>
      </div>
    </div>
  );
}
