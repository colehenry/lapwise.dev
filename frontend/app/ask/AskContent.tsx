"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import ChatInput from "@/components/chat/ChatInput";
import ChatTranscript from "@/components/chat/ChatTranscript";
import ConversationSidebar from "@/components/chat/ConversationSidebar";
import { PanelLabel } from "@/components/home/ConsolePanel";
import { useAuth } from "@/components/providers/AuthProvider";
import { ClutchNavIcon } from "@/components/ui/BrandLogo";
import { useAskChat } from "@/hooks/useAskChat";
import { pageContextFromSearchParams } from "@/lib/ai/page-context";

const TOTAL_LIMIT = 3;

export default function AskContent() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const prefilledQuestion = searchParams.get("q") ?? undefined;
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
      <div className="page-frame min-h-[calc(100dvh-3.25rem)] py-16">
        <p className="m-0 font-mono text-[12px] text-ink-faint">Loading…</p>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="page-frame min-h-[calc(100dvh-3.25rem)] py-16">
        <div className="mx-auto w-full max-w-3xl">
          <h1 className="m-0 max-w-[20ch] text-[26px] font-bold leading-[1.1] tracking-[-0.03em] text-ink-strong">
            Sign in to ask <span className="text-accent-bright">Clutch</span>.
          </h1>
          <p className="m-0 mt-3 max-w-[62ch] text-[13.5px] leading-[1.6] text-ink-soft">
            Answers come off the same race data the rest of the site is built
            on.
          </p>
          <Link
            href={`/login?redirect=${encodeURIComponent(askReturnUrl)}`}
            className="mt-6 inline-flex rounded-sm border border-accent-bright bg-accent px-5 py-2.5 text-[14px] font-semibold text-ink-strong transition-colors hover:bg-accent-bright focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-bright"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  const chatDisabled = isAsking || pendingConversationId !== null;
  /* The empty state already names Clutch in its heading; the bar only takes
     the name over once that heading is gone. */
  const hasTranscript = messages.length > 0;
  const quota =
    remaining !== null
      ? `Queries ${remaining}/${TOTAL_LIMIT}`
      : user.role === "admin"
        ? "Unlimited"
        : null;

  return (
    <div className="fixed inset-x-0 top-[3.25rem] bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] flex flex-col overflow-hidden bg-surface-page md:static md:inset-auto md:h-[calc(100dvh-3.25rem)] md:min-h-0">
      <header className="page-frame grid h-[42px] flex-none grid-cols-[1fr_auto_1fr] items-center gap-2.5 border-b border-line-soft bg-surface-band">
        <h1
          className={`col-start-2 m-0 flex items-center justify-center gap-1.5 text-[14px] font-bold tracking-[-0.01em] text-ink-strong transition-opacity duration-300 motion-reduce:transition-none ${
            hasTranscript ? "opacity-100" : "opacity-0"
          }`}
        >
          Clutch
          <ClutchNavIcon className="h-5 w-5" />
        </h1>
        <div className="col-start-3 flex items-center justify-end gap-2">
          {quota && (
            <PanelLabel className="hidden sm:block">{quota}</PanelLabel>
          )}
          <button
            type="button"
            onClick={startNewConversation}
            className="rounded-sm border border-line-soft px-2.5 py-1 text-[12px] text-ink-soft transition-colors hover:border-accent hover:text-ink-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-bright"
          >
            New
          </button>
          <button
            type="button"
            onClick={() => setSidebarOpen((open) => !open)}
            className={`rounded-sm border p-1.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-bright ${
              sidebarOpen
                ? "border-accent text-accent-bright"
                : "border-line-soft text-ink-faint hover:border-accent hover:text-ink-base"
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
        </div>
      </header>

      {/* The history panel overlays this column rather than narrowing it, so
          opening it never reflows the answer being read. */}
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <ChatTranscript
          key={activeConversationId ?? "new-conversation"}
          messages={messages}
          error={error}
          streamingAssistantId={streamingAssistantId}
          streamStatus={streamStatus}
          isAsking={isAsking}
          disabled={chatDisabled}
          onSend={sendMessage}
        />

        <div className="page-frame flex-none border-t border-line-soft py-3 md:py-4">
          <div className="mx-auto w-full max-w-3xl">
            <ChatInput
              onSend={sendMessage}
              onAbort={abortResponse}
              isLoading={isAsking}
              disabled={pendingConversationId !== null}
              initialValue={prefilledQuestion}
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
  );
}
