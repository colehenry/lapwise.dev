"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import ChatInput from "@/components/chat/ChatInput";
import ChatTranscript from "@/components/chat/ChatTranscript";
import ConversationSidebar from "@/components/chat/ConversationSidebar";
import PageHeader from "@/components/layout/PageHeader";
import { useAuth } from "@/components/providers/AuthProvider";
import ClutchIcon from "@/components/ui/ClutchIcon";
import { useAskChat } from "@/hooks/useAskChat";
import { pageContextFromSearchParams } from "@/lib/ai/page-context";

const TOTAL_LIMIT = 3;

export default function AskContent() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const pageContext = useMemo(
    () => pageContextFromSearchParams(searchParams),
    [searchParams],
  );
  const askReturnUrl = `/ask${searchParams.size > 0 ? `?${searchParams.toString()}` : ""}`;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const requestedConversationRef = useRef<string | null>(null);
  const {
    activeConversationId,
    conversations,
    messages,
    isAsking,
    streamingAssistantId,
    streamStatus,
    remaining,
    error,
    pendingConversationId,
    deletingId,
    startNewConversation,
    loadConversation,
    abortResponse,
    renameConversationTitle,
    removeConversation,
    sendMessage,
  } = useAskChat(isAuthenticated && user ? user.id : null, pageContext);

  // Load conversation from ?c= query param (e.g. from widget expand)
  useEffect(() => {
    if (!isAuthenticated) {
      requestedConversationRef.current = null;
      return;
    }

    const convParam = searchParams.get("c");
    if (convParam && requestedConversationRef.current !== convParam) {
      requestedConversationRef.current = convParam;
      loadConversation(convParam);
    }
  }, [searchParams, isAuthenticated, loadConversation]);

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
              href={`/login?redirect=${encodeURIComponent(askReturnUrl)}`}
              className="bg-purple-500 text-text-primary px-6 py-2.5 rounded-2xl font-mono text-xs font-bold uppercase tracking-widest hover:bg-purple-600 transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const chatDisabled = isAsking || pendingConversationId !== null;

  return (
    <div className="fixed inset-x-0 top-14 bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] flex flex-col overflow-hidden bg-bg-secondary md:static md:inset-auto md:h-[calc(100dvh-3.5rem)] md:min-h-0">
      <div className="shrink-0">
        <PageHeader title="Clutch" compactMobile>
          {remaining !== null && (
            <span className="hidden rounded-lg border border-[var(--glass-border)] bg-[var(--glass-surface-soft)] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted sm:block">
              {remaining}/{TOTAL_LIMIT}
            </span>
          )}
          {remaining === null && user.role === "admin" && (
            <span className="hidden rounded-lg border border-[var(--glass-border)] bg-[var(--glass-surface-soft)] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted sm:block">
              Unlimited
            </span>
          )}
          <button
            type="button"
            onClick={startNewConversation}
            className="rounded-lg border border-[var(--glass-border)] bg-[var(--glass-surface-soft)] px-3 py-2 font-mono text-[11px] font-bold text-text-secondary transition-colors hover:border-purple-500/30 hover:bg-purple-500/10 hover:text-purple-300 sm:px-4 sm:text-xs"
          >
            <span className="sm:hidden">New</span>
            <span className="hidden sm:inline">+ New Chat</span>
          </button>
          <button
            type="button"
            onClick={() => setSidebarOpen((open) => !open)}
            className={`rounded-lg border p-2 font-mono text-xs font-bold transition-colors ${
              sidebarOpen
                ? "border-purple-500/30 bg-purple-500/10 text-purple-300"
                : "border-[var(--glass-border)] bg-[var(--glass-surface-soft)] text-text-muted hover:border-purple-500/30 hover:text-purple-300"
            }`}
            aria-label="Conversation history"
            aria-controls="conversation-history"
            aria-expanded={sidebarOpen}
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zm0 10.5a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </PageHeader>
      </div>

      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-[radial-gradient(circle,rgba(160,32,240,0.06)_0%,transparent_70%)]" />
      </div>

      <div className="relative mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col overflow-hidden md:px-8 md:py-6">
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden md:rounded-2xl md:border md:border-[var(--glass-border)] md:bg-[var(--glass-surface)] md:shadow-[0_16px_64px_-16px_rgba(0,0,0,0.5)] md:backdrop-blur-xl">
          <div
            className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden ${
              sidebarOpen ? "md:pr-72" : ""
            }`}
          >
            <ChatTranscript
              key={activeConversationId ?? "new-conversation"}
              messages={messages}
              error={error}
              streamingAssistantId={streamingAssistantId}
              streamStatus={streamStatus}
              isAsking={isAsking}
              disabled={chatDisabled}
              userName={user.username}
              userAvatarUrl={user.avatar_url}
              onSend={sendMessage}
            />

            <div className="shrink-0 border-t border-[var(--glass-border)] bg-bg-secondary px-3 py-3 md:px-6 md:py-4">
              <ChatInput
                onSend={sendMessage}
                onAbort={abortResponse}
                isLoading={isAsking}
                disabled={pendingConversationId !== null}
                shellless
                initialValue={searchParams.get("q") ?? ""}
              />
            </div>
          </div>

          <ConversationSidebar
            conversations={conversations}
            activeId={activeConversationId}
            pendingId={pendingConversationId}
            deletingId={deletingId}
            onSelect={loadConversation}
            onNew={startNewConversation}
            onDelete={removeConversation}
            onRename={renameConversationTitle}
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />
        </div>
      </div>
    </div>
  );
}
