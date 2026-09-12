"use client";

import Link from "next/link";
import {
  type FocusEvent,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useClutchDock } from "@/components/providers/ClutchDockProvider";
import { ClutchNavIcon } from "@/components/ui/BrandLogo";
import type { AnalysisPageContext } from "@/lib/ai/analysis-contracts";
import {
  closeCorner,
  openCorner,
  useCornerOpen,
} from "@/lib/clutch/cornerStore";
import { handoffPageContext } from "@/lib/clutch/handoff";
import {
  firstScript,
  type ResolvedFollowup,
  type ResolvedScript,
  type ResolvedSegment,
  resolveScript,
  type Surface,
} from "@/lib/clutch/script";
import { constructorHref, driverHref } from "@/lib/entityLinks";
import ClutchBubble from "./ClutchBubble";

/** The first answer and one follow-up; a third hop is a hand-off. */
const MAX_DEPTH = 2;
/** Long enough to cross the gap between the head and the bubble. */
const LEAVE_DELAY_MS = 120;

const HEAD_SIZE = { title: "h-8 w-8", dock: "h-12 w-12" } as const;

function hrefFor(segment: ResolvedSegment): string | null {
  if (!segment.code) return null;
  return segment.tint === "team"
    ? constructorHref(segment.code)
    : driverHref({ driver_code: segment.code });
}

function Answer({ script }: { script: ResolvedScript }) {
  return (
    <p className="m-0 whitespace-pre-line text-[13px] leading-[1.55] text-ink-base">
      {script.segments.map((segment, index) => {
        const href = hrefFor(segment);
        const style = segment.color
          ? { color: segment.color, fontWeight: 600 }
          : undefined;
        const key = `${script.id}-${index}`;
        return href ? (
          <Link
            key={key}
            href={href}
            className="underline decoration-transparent underline-offset-2 transition-colors hover:decoration-current"
            style={style}
          >
            {segment.text}
          </Link>
        ) : (
          <span key={key} style={style}>
            {segment.text}
          </span>
        );
      })}
    </p>
  );
}

/**
 * Clutch's head in the corner of a panel. Hover: the question the reader is
 * probably already thinking. Click: the answer, in the same bubble, with
 * follow-ups and a box to ask something else. Nothing on the page reflows.
 */
export default function ClutchCorner<C>({
  surface,
  context,
  title,
  pageContext,
  place = "title",
}: {
  surface: Surface<C>;
  context: C;
  /** What the head sits on — the accessible name and the dock's caption. */
  title: string;
  /** The page's ids, sent with a question the corner cannot answer itself. */
  pageContext: AnalysisPageContext;
  /** In a panel's title bar, or the page's head in the dock corner. */
  place?: "title" | "dock";
}) {
  const id = useId();
  const dock = useClutchDock();
  const bubbleId = `clutch-bubble-${id}`;
  const headRef = useRef<HTMLButtonElement>(null);
  const open = useCornerOpen(id);
  const [answered, setAnswered] = useState(false);
  const [hops, setHops] = useState<ResolvedScript[]>([]);
  const [draft, setDraft] = useState("");
  const lastPointer = useRef<string>("mouse");
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const root = useMemo(() => firstScript(surface, context), [surface, context]);
  const current = hops[hops.length - 1] ?? root;

  const handOff = (question: string) => {
    if (!root) return;
    const trail = [root, ...hops];
    dock.handOff({
      question,
      trail,
      title,
      pageContext: handoffPageContext(
        pageContext,
        trail,
        title,
        surface.digest(context),
      ),
    });
    close();
  };

  const close = useCallback(() => closeCorner(id), [id]);

  /* Whichever way the bubble closed — this head, Esc, another corner opening —
     the next hover starts from the question again. */
  useEffect(() => {
    if (open) return;
    setAnswered(false);
    setHops([]);
    setDraft("");
  }, [open]);

  const cancelLeave = () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    leaveTimer.current = null;
  };
  useEffect(() => {
    return () => {
      if (leaveTimer.current) clearTimeout(leaveTimer.current);
    };
  }, []);

  const show = () => {
    cancelLeave();
    if (!open) openCorner(id);
  };
  /* The question closes when the pointer leaves head and bubble both; the
     answer stays until it is dismissed. */
  const leave = () => {
    if (answered) return;
    cancelLeave();
    leaveTimer.current = setTimeout(close, LEAVE_DELAY_MS);
  };
  const blur = (event: FocusEvent) => {
    const next = event.relatedTarget as Node | null;
    if (next && document.getElementById(bubbleId)?.contains(next)) return;
    leave();
  };
  const answer = () => {
    cancelLeave();
    openCorner(id);
    setAnswered(true);
  };

  if (!root || !current) return null;

  const onHeadClick = () => {
    if (lastPointer.current === "touch" && !open) {
      show();
      return;
    }
    if (open && answered) {
      close();
      return;
    }
    answer();
  };

  const follow = (followup: ResolvedFollowup) => {
    if (followup.kind === "ask" || hops.length + 1 >= MAX_DEPTH) {
      handOff(followup.question);
      return;
    }
    const target = surface.scripts.find((entry) => entry.id === followup.id);
    const resolved = target ? resolveScript(surface, target, context) : null;
    if (resolved) setHops((stack) => [...stack, resolved]);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const question = draft.trim();
    if (question) handOff(question);
  };

  return (
    <>
      <button
        ref={headRef}
        type="button"
        aria-label={`Ask Clutch about ${title}`}
        aria-expanded={open}
        aria-controls={open ? bubbleId : undefined}
        onPointerDown={(event: ReactPointerEvent) => {
          lastPointer.current = event.pointerType;
        }}
        onPointerEnter={(event: ReactPointerEvent) => {
          if (event.pointerType !== "touch") show();
        }}
        onPointerLeave={leave}
        onFocus={show}
        onBlur={blur}
        onClick={onHeadClick}
        className={`inline-flex shrink-0 items-center justify-center rounded-full transition-transform motion-reduce:transition-none hover:-translate-y-px hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-bright ${HEAD_SIZE[place]} ${open ? "-translate-y-px scale-105" : ""}`}
      >
        <ClutchNavIcon className="h-full w-full" />
      </button>

      <ClutchBubble
        id={bubbleId}
        anchorRef={headRef}
        open={open}
        revision={answered ? hops.length + 1 : 0}
        role={answered ? "dialog" : "tooltip"}
        labelledBy={answered ? `${bubbleId}-title` : undefined}
        onDismiss={close}
        onPointerEnter={show}
        onPointerLeave={leave}
      >
        {answered ? (
          <div className="w-[42ch] max-w-[calc(100vw-32px)] px-[11px] pb-[9px] pt-2">
            <div className="mb-[3px] flex items-start gap-1.5 pr-4 text-[11px] leading-[1.4] text-ink-soft">
              {hops.length > 0 && (
                <button
                  type="button"
                  aria-label="Back to the previous answer"
                  onClick={() => setHops((stack) => stack.slice(0, -1))}
                  className="font-mono text-accent-bright"
                >
                  ‹
                </button>
              )}
              <span id={`${bubbleId}-title`}>{current.question}</span>
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={close}
              className="absolute right-1.5 top-1 px-1 text-[13px] leading-none text-ink-faint hover:text-ink-base"
            >
              ×
            </button>

            <Answer script={current} />

            {current.followups.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-[5px]">
                {current.followups.map((followup) => (
                  <button
                    key={followup.question}
                    type="button"
                    onClick={() => follow(followup)}
                    className="rounded-sm border border-line-soft bg-surface-page px-2 py-[3px] text-[11.5px] leading-[1.3] text-ink-soft transition-colors hover:border-accent hover:text-ink-base"
                  >
                    {followup.question}
                  </button>
                ))}
              </div>
            )}

            <form
              onSubmit={submit}
              className="mt-2 flex items-center gap-2 rounded-sm border border-line-strong bg-surface-page py-1 pl-2 pr-[5px] transition-colors focus-within:border-accent"
            >
              <span aria-hidden="true" className="font-mono text-accent-bright">
                ❯
              </span>
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Ask Clutch…"
                aria-label="Ask Clutch your own question"
                className="min-w-0 flex-1 bg-transparent text-[12px] text-ink-strong outline-none placeholder:text-ink-faint"
              />
              <button
                type="submit"
                aria-label="Send this question to Clutch"
                className="flex h-5 w-5 flex-none items-center justify-center rounded-[3px] bg-accent text-[11px] text-ink-strong transition-colors hover:bg-accent-bright"
              >
                →
              </button>
            </form>
          </div>
        ) : (
          <button
            type="button"
            onClick={answer}
            className="block whitespace-nowrap px-[10px] py-[6px] text-left text-ink-base"
          >
            {current.question}
          </button>
        )}
      </ClutchBubble>
    </>
  );
}
