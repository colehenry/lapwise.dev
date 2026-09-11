"use client";

import {
  type ReactNode,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

/** Distance kept from the viewport edge before the bubble flips. */
const EDGE = 12;
/** Space between the head and the bubble's tail. */
const GAP = 4;
/** How far the bubble overlaps the head so the tail points at it. */
const OVERLAP = 8;

type Placement = {
  left: number;
  top: number;
  flipX: boolean;
  flipY: boolean;
};

/**
 * Where the bubble goes: top-right of the head, flipped to the left when it
 * would cross the right edge and below when it would cross the top. Never
 * pushes the panel it belongs to.
 */
function place(anchor: HTMLElement, bubble: HTMLElement): Placement {
  const rect = anchor.getBoundingClientRect();
  const width = bubble.offsetWidth;
  const height = bubble.offsetHeight;

  let left = rect.right - OVERLAP;
  const flipX = left + width > window.innerWidth - EDGE;
  if (flipX) left = rect.left + OVERLAP - width;

  let top = rect.top - GAP - height;
  const flipY = top < EDGE;
  if (flipY) top = rect.bottom + GAP;

  return { left, top, flipX, flipY };
}

export default function ClutchBubble({
  id,
  anchorRef,
  open,
  role,
  labelledBy,
  onDismiss,
  onPointerEnter,
  onPointerLeave,
  children,
}: {
  id: string;
  anchorRef: RefObject<HTMLElement | null>;
  open: boolean;
  role: "tooltip" | "dialog";
  /** The element naming a dialog; a tooltip is named by its content. */
  labelledBy?: string;
  onDismiss: () => void;
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
  children: ReactNode;
}) {
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);

  /* Measured after paint, then again whenever the page moves under it. The
     bubble is fixed, so a scroll would otherwise leave it behind the head. */
  useLayoutEffect(() => {
    if (!open) {
      setPlacement(null);
      return;
    }
    const update = () => {
      const anchor = anchorRef.current;
      const bubble = bubbleRef.current;
      if (anchor && bubble) setPlacement(place(anchor, bubble));
    };
    update();
    const grown =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    if (bubbleRef.current) grown?.observe(bubbleRef.current);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      grown?.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, anchorRef]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDismiss();
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (bubbleRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onDismiss();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open, onDismiss, anchorRef]);

  if (!open) return null;

  /* A dialog is named by its caption; a tooltip by its content. */
  const aria =
    role === "dialog" ? { role, "aria-labelledby": labelledBy } : { role };

  const tailSide = placement?.flipX ? "right-[7px]" : "left-[7px]";
  const tailEdge = placement?.flipY
    ? "-top-[5px] rotate-[135deg]"
    : "-bottom-[5px] -rotate-45";

  return createPortal(
    <div
      id={id}
      ref={bubbleRef}
      {...aria}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      style={{
        left: placement?.left ?? 0,
        top: placement?.top ?? 0,
        visibility: placement ? "visible" : "hidden",
      }}
      className="fixed z-[1300] rounded-sm border border-line-strong bg-surface-panel text-[12.5px] leading-[1.4] text-ink-base shadow-floating-soft motion-safe:animate-[clutchRise_120ms_ease-out]"
    >
      <span
        aria-hidden="true"
        className={`absolute h-2 w-2 border-b border-l border-line-strong bg-surface-panel ${tailSide} ${tailEdge}`}
      />
      {children}
    </div>,
    document.body,
  );
}
