"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import ChatInput from "@/components/chat/ChatInput";
import ChatTranscript from "@/components/chat/ChatTranscript";
import { useAuth } from "@/components/providers/AuthProvider";
import { useClutchDock } from "@/components/providers/ClutchDockProvider";
import { ClutchHead, ClutchNavIcon } from "@/components/ui/BrandLogo";
import { useAskChat } from "@/hooks/useAskChat";
import { buildClutchHref } from "@/lib/ai/clutch-links";
import {
  DOCK_MIN_WIDTH,
  forgetThread,
  rememberedDockWidth,
  rememberThread,
  threadFor,
  threadRoute,
} from "@/lib/clutch/dockMemory";
import {
  type ClutchHandoff,
  remainingFollowups,
  seededMessages,
} from "@/lib/clutch/handoff";
import { firstScript } from "@/lib/clutch/script";
import ClutchCorner from "./ClutchCorner";
import DockResizeHandle from "./DockResizeHandle";

const TOTAL_LIMIT = 3;
/** The placeholder answer shown while a hand-off question is still queued. */
const PENDING_ANSWER_ID = "clutch-dock-pending-answer";
/** Clutch at rest: the page corner, above the mobile nav. */
const CORNER_CLASS =
  "fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px)+1rem)] right-6 z-[1250] drop-shadow-md md:bottom-6";
/** The bare helmet as a button or link, sized like the dock corner. */
const HEAD_CLASS =
  "relative flex h-12 w-12 items-center justify-center transition-transform motion-reduce:transition-none hover:-translate-y-px hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-bright";

function SignIn({ handoff }: { handoff: ClutchHandoff }) {
  const question = handoff.question ?? "";
  const returnTo = buildClutchHref(question, handoff.pageContext);
  return (
    <div className="px-4 pb-4 pt-2">
      <p className="m-0 text-[13px] leading-[1.55] text-ink-base">
        Sign in to ask <span className="text-accent-bright">Clutch</span>{" "}
        {question && <q className="text-ink-strong">{question}</q>}
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
/** A hand-off question waiting for the thread it belongs in to be ready. */
type Pending = { question: string; conversationId: string | null };

function Thread({ handoff }: { handoff: ClutchHandoff }) {
  const { user, isAuthenticated } = useAuth();
  const userId = isAuthenticated && user ? user.id : null;
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
    loadConversation,
    abortResponse,
    sendMessage,
  } = useAskChat(userId, handoff.pageContext);

  const [pending, setPending] = useState<Pending | null>(null);
  const [resumed, setResumed] = useState(false);
  const [chipsUsed, setChipsUsed] = useState(false);
  const [unread, setUnread] = useState(false);
  const [width, setWidth] = useState(DOCK_MIN_WIDTH);

  useEffect(() => setWidth(rememberedDockWidth()), []);

  /* A page keeps its thread: a hand-off from a page this reader has already
     talked about continues that conversation; anywhere else starts one, with
     the corner's exchange as its first turns. The provider makes a fresh
     object per hand-off, so the same question twice still restarts. */
  useEffect(() => {
    const remembered =
      userId !== null ? threadFor(userId, handoff.pageContext.route) : null;
    if (remembered) loadConversation(remembered.conversationId);
    else startNewConversation();
    setResumed(remembered !== null);
    setPending(
      handoff.question
        ? {
            question: handoff.question,
            conversationId: remembered?.conversationId ?? null,
          }
        : null,
    );
    setChipsUsed(false);
  }, [handoff, userId, loadConversation, startNewConversation]);

  useEffect(() => {
    if (!pending || !isAuthenticated || isAsking) return;
    /* A remembered conversation that no longer loads (deleted from /ask, say)
       is forgotten, and the question starts a fresh thread instead. */
    if (pending.conversationId && error && userId !== null) {
      forgetThread(userId, handoff.pageContext.route);
      startNewConversation();
      setResumed(false);
      setPending({ question: pending.question, conversationId: null });
      return;
    }
    const ready = pending.conversationId
      ? activeConversationId === pending.conversationId &&
        pendingConversationId === null
      : activeConversationId === null && messages.length === 0;
    if (!ready) return;
    setPending(null);
    void sendMessage(pending.question);
  }, [
    pending,
    isAuthenticated,
    activeConversationId,
    pendingConversationId,
    messages.length,
    isAsking,
    error,
    userId,
    handoff,
    startNewConversation,
    sendMessage,
  ]);

  useEffect(() => {
    if (userId === null || !activeConversationId) return;
    rememberThread(userId, handoff.pageContext.route, {
      conversationId: activeConversationId,
      title: handoff.title,
    });
  }, [userId, activeConversationId, handoff]);

  useEffect(() => {
    if (expanded) setUnread(false);
    else if (messages.length > 0) setUnread(true);
  }, [expanded, messages.length]);

  /* A resumed thread already holds its history; only a new one is seeded.
     While the hand-off question waits for its thread, it is on screen as a
     turn with Clutch already working, so the dock never opens looking idle. */
  const waiting = pending !== null;
  const transcript = useMemo(() => {
    const base = resumed ? messages : [...seededMessages(handoff), ...messages];
    if (!pending) return base;
    return [
      ...base,
      {
        id: `pending-q-${handoff.seq}`,
        role: "user" as const,
        content: pending.question,
      },
      { id: PENDING_ANSWER_ID, role: "assistant" as const, content: "" },
    ];
  }, [resumed, handoff, messages, pending]);
  const chips = chipsUsed ? [] : remainingFollowups(handoff);

  const send = async (question: string) => {
    setChipsUsed(true);
    await sendMessage(question);
  };

  const quota = remaining !== null ? `${remaining}/${TOTAL_LIMIT}` : null;

  if (!expanded) {
    return (
      <div className={CORNER_CLASS}>
        <button
          type="button"
          onClick={expand}
          aria-label="Open Clutch"
          className={HEAD_CLASS}
        >
          <ClutchHead className="h-full w-full" />
          {unread && (
            <span
              aria-hidden="true"
              className="absolute right-0 top-0 h-2 w-2 rounded-full bg-accent-bright"
            />
          )}
        </button>
      </div>
    );
  }

  return (
    <section
      aria-label="Clutch"
      style={{ "--dock-width": `${width}px` } as React.CSSProperties}
      className="fixed inset-x-2 bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px)+0.5rem)] z-[1250] flex h-[min(560px,80dvh)] flex-col overflow-hidden rounded-sm border border-line-strong bg-surface-panel shadow-floating motion-safe:animate-[clutchRise_120ms_ease-out] md:inset-x-auto md:bottom-6 md:right-6 md:w-[var(--dock-width)]"
    >
      <DockResizeHandle width={width} onResize={setWidth} />
      <header className="flex h-[38px] flex-none items-center gap-2 border-b border-line-soft px-2.5">
        <ClutchNavIcon className="h-5 w-5" />
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
            streamingAssistantId={
              waiting ? PENDING_ANSWER_ID : streamingAssistantId
            }
            streamStatus={waiting ? { stage: "starting" } : streamStatus}
            isAsking={waiting || isAsking}
            disabled={waiting || isAsking || pendingConversationId !== null}
            onSend={send}
            variant="dock"
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
              isLoading={waiting || isAsking}
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

/**
 * The dock belongs to the page. Arriving on a page this reader has talked
 * about brings its thread back, folded. Anywhere else the head is the page's
 * corner when the page registered one, and the way to /ask when it did not.
 * A thread is never shown under another page's head — it waits on its own
 * page and on /ask.
 */
export default function ClutchDock() {
  const { handoff, pageSurface, resume, dismiss } = useClutchDock();
  const { user, isAuthenticated } = useAuth();
  const userId = isAuthenticated && user ? user.id : null;
  const pathname = usePathname();

  useEffect(() => {
    /* A page's fresh, proactive question wins over a passively remembered
       thread. The thread is still resumed when that question hands off. */
    if (
      pageSurface &&
      handoff &&
      handoff.question == null &&
      handoff.trail.length === 0
    ) {
      dismiss();
      return;
    }
    if (handoff && threadRoute(handoff.pageContext.route) === pathname) return;
    if (pageSurface) {
      if (handoff) dismiss();
      return;
    }
    const remembered = userId !== null ? threadFor(userId, pathname) : null;
    if (remembered) resume(remembered, pathname);
    else if (handoff) dismiss();
  }, [pathname, handoff, pageSurface, userId, resume, dismiss]);

  if (handoff) return <Thread handoff={handoff} />;
  /* A surface with nothing to say about this page is no corner at all. */
  const answerable =
    pageSurface !== null &&
    firstScript(pageSurface.surface, pageSurface.context) !== null;
  return (
    <div className={CORNER_CLASS}>
      {pageSurface && answerable ? (
        <ClutchCorner
          surface={pageSurface.surface}
          context={pageSurface.context}
          title={pageSurface.title}
          pageContext={pageSurface.pageContext}
          place="dock"
        />
      ) : (
        <Link href="/ask" aria-label="Ask Clutch" className={HEAD_CLASS}>
          <ClutchHead className="h-full w-full" />
        </Link>
      )}
    </div>
  );
}
