"use client";

import { type KeyboardEvent, type PointerEvent, useRef } from "react";
import { clampDockWidth, rememberDockWidth } from "@/lib/clutch/dockMemory";

const KEY_STEP = 24;

/**
 * The dock's left edge. Drag it to give a chart more room; the width is kept
 * for next time. Arrow keys do the same from the keyboard.
 */
export default function DockResizeHandle({
  width,
  onResize,
}: {
  width: number;
  onResize: (width: number) => void;
}) {
  const drag = useRef<{ startX: number; startWidth: number } | null>(null);

  const settle = (next: number) => {
    const clamped = clampDockWidth(next, window.innerWidth);
    onResize(clamped);
    return clamped;
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    drag.current = { startX: event.clientX, startWidth: width };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    settle(drag.current.startWidth + (drag.current.startX - event.clientX));
  };
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const final = settle(
      drag.current.startWidth + (drag.current.startX - event.clientX),
    );
    drag.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    rememberDockWidth(final);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const delta =
      event.key === "ArrowLeft"
        ? KEY_STEP
        : event.key === "ArrowRight"
          ? -KEY_STEP
          : 0;
    if (!delta) return;
    event.preventDefault();
    rememberDockWidth(settle(width + delta));
  };

  return (
    // biome-ignore lint/a11y/useSemanticElements: a separator is the ARIA role for a resize handle; no native element carries it
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize Clutch"
      aria-valuenow={width}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
      className="absolute inset-y-0 left-0 hidden w-1.5 cursor-col-resize touch-none hover:bg-line-strong focus-visible:bg-line-strong focus-visible:outline-none md:block"
    />
  );
}
