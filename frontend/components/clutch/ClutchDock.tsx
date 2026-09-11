"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ChatInput from "@/components/chat/ChatInput";
import ChatTranscript from "@/components/chat/ChatTranscript";
import { useAuth } from "@/components/providers/AuthProvider";
import { useClutchDock } from "@/components/providers/ClutchDockProvider";
import { ClutchNavIcon } from "@/components/ui/BrandLogo";
import { useAskChat } from "@/hooks/useAskChat";
import { buildClutchHref } from "@/lib/ai/clutch-links";
import {
  type ClutchHandoff,
  remainingFollowups,
  seededMessages,
} from "@/lib/clutch/handoff";

const TOTAL_LIMIT = 3;

function SignIn({ handoff }: { handoff: ClutchHandoff }) {
  const returnTo = buildClutchHref(handoff.question, handoff.pageContext);
  return (
    <div className="px-4 pb-4 pt-2">
      <p className="m-0 text-[13px] leading-[1.55] text-ink-base">
        Sign in to ask <span className="text-accent-bright">Clutch</span>{" "}
        <q className="text-ink-strong">{handoff.question}</q>
      </p>
      <Link
        href={`/login?redirect=${encodeURIComponent(returnTo)}`}
        className="mt-3 inline-flex rounded-sm border border-accent-bright bg-accent px-4 py-2 text-[13px] font-semibold text-ink-strong transition-colors hover:bg-accent-bright focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-bright"
      >
        Sign in
      </Link>
    </div>
  );
}

/**
 * Clutch, bottom-right. Hidden until a corner hands off; then the thread the
 * corner started continues here for the rest of the session. It is the /ask
 * workspace in a panel: the same transcript, input and chat state.
 */
function Thread({ handoff }: { handoff: ClutchHandoff }) {
  const { user, isAuthenticated } = useAuth();
  const { expanded, expand, collapse } = useClutchDock();
  const {
    activeConversationId,
    messages,
    isAsking,
    streamingAssistantId,
    streamStatus,
    remaining,
    error,
    pendingConversationId,
    startNewConversation,
    abortResponse,
    sendMessage,
  } = useAskChat(isAuthenticated && user ? user.id : null, handoff.pageContext);

  const [pending, setPending] = useState<string | null>(null);
  const [chipsUsed, setChipsUsed] = useState(false);
  const [unread, setUnread] = useState(false);

  /* Each hand-off is a new thread: the corner's exchange first, then the
     question that could not be answered on the page. The provider makes a
     fresh object per hand-off, so the same question twice still restarts. */
  useEffect(() => {
    startNewConversation();
    setPending(handoff.question);
    setChipsUsed(false);
  }, [handoff, startNewConversation]);

  useEffect(() => {
    if (!pending || !isAuthenticated) return;
    if (activeConversationId !== null || messages.length > 0 || isAsking)
      return;
    setPending(null);
    void sendMessage(pending);
  }, [
    pending,
    isAuthenticated,
    activeConversationId,
    messages.length,
    isAsking,
    sendMessage,
  ]);

  useEffect(() => {
    if (expanded) setUnread(false);
    else if (messages.length > 0) setUnread(true);
  }, [expanded, messages.length]);

  const transcript = useMemo(
    () => [...seededMessages(handoff), ...messages],
    [handoff, messages],
  );
  const chips = chipsUsed ? [] : remainingFollowups(handoff);

  const send = async (question: string) => {
    setChipsUsed(true);
    await sendMessage(question);
  };

  const quota =
    remaining !== null
      ? `${remaining}/${TOTAL_LIMIT}`
      : user?.role === "admin"
        ? "∞"
        : null;

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={expand}
        aria-label="Open Clutch"
        className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px)+0.75rem)] right-4 z-[1250] flex h-9 w-9 items-center justify-center rounded-full border border-line-strong bg-surface-panel shadow-floating-soft transition-transform motion-reduce:transition-none hover:-translate-y-px hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-bright md:bottom-4"
      >
        <ClutchNavIcon className="h-7 w-7" />
        {unread && (
          <span
            aria-hidden="true"
            className="absolute right-0 top-0 h-2 w-2 rounded-full bg-accent-bright"
          />
        )}
      </button>
    );
  }

  return (
    <section
      aria-label="Clutch"
      className="fixed inset-x-2 bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px)+0.5rem)] z-[1250] flex h-[min(560px,80dvh)] flex-col overflow-hidden rounded-sm border border-line-strong bg-surface-panel shadow-floating motion-safe:animate-[clutchRise_120ms_ease-out] md:inset-x-auto md:bottom-4 md:right-4 md:w-[360px]"
    >
      <header className="flex h-[38px] flex-none items-center gap-2 border-b border-line-soft px-2.5">
        <ClutchNavIcon className="h-[18px] w-[18px]" />
        <span className="text-[12.5px] font-semibold text-ink-strong">
          Clutch
        </span>
        <span className="min-w-0 truncate font-mono text-[9.5px] uppercase tracking-[0.1em] text-ink-faint">
          {handoff.title}
        </span>
        <span className="flex-1" />
        {quota && (
          <span className="font-mono text-[10px] text-ink-faint">{quota}</span>
        )}
        <Link
          href={
            activeConversationId ? `/ask?c=${activeConversationId}` : "/ask"
          }
          aria-label="Open in Clutch"
          className="px-1 font-mono text-[12px] text-ink-faint transition-colors hover:text-ink-base"
        >
          ↗
        </Link>
        <button
          type="button"
          onClick={collapse}
          aria-label="Collapse Clutch"
          className="px-1 font-mono text-[12px] text-ink-faint transition-colors hover:text-ink-base"
        >
          —
        </button>
      </header>

      {isAuthenticated ? (
        <>
          <ChatTranscript
            key={activeConversationId ?? `handoff-${handoff.seq}`}
            messages={transcript}
            error={error}
            streamingAssistantId={streamingAssistantId}
            streamStatus={streamStatus}
            isAsking={isAsking}
            disabled={isAsking || pendingConversationId !== null}
            onSend={send}
          />
          {chips.length > 0 && (
            <div className="flex flex-none flex-wrap gap-[5px] px-3 pb-1.5 pt-1.5">
              {chips.map((question) => (
                <button
                  key={question}
                  type="button"
                  disabled={isAsking}
                  onClick={() => send(question)}
                  className="rounded-sm border border-line-soft bg-surface-page px-2 py-[3px] text-[11.5px] leading-[1.3] text-ink-soft transition-colors hover:border-accent hover:text-ink-base disabled:opacity-50"
                >
                  {question}
                </button>
              ))}
            </div>
          )}
          <div className="flex-none border-t border-line-soft px-2.5 py-2">
            <ChatInput
              onSend={send}
              onAbort={abortResponse}
              isLoading={isAsking}
              disabled={pendingConversationId !== null}
            />
          </div>
        </>
      ) : (
        <SignIn handoff={handoff} />
      )}
    </section>
  );
}

export default function ClutchDock() {
  const { handoff } = useClutchDock();
  if (!handoff) return null;
  return <Thread handoff={handoff} />;
}
