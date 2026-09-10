"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CLUTCH_PROGRESS_IDLE_ROTATION_MS,
  CLUTCH_PROGRESS_MIN_VISIBLE_MS,
  type ClutchProgressStatus,
  formatClutchProgressMetrics,
  idleProgressStage,
  pickClutchProgressMessage,
} from "@/lib/clutch-progress";

interface DisplayedProgress extends ClutchProgressStatus {
  message: string;
}

export default function ClutchProgress({
  status,
}: {
  status: ClutchProgressStatus;
}) {
  const usedMessagesRef = useRef(new Set<string>());
  const lastChangeRef = useRef(Date.now());
  const displayedRef = useRef<DisplayedProgress | null>(null);
  const [displayed, setDisplayed] = useState<DisplayedProgress>(() => {
    const message = pickClutchProgressMessage(
      status.stage,
      usedMessagesRef.current,
    );
    usedMessagesRef.current.add(message);
    const initial = { ...status, message };
    displayedRef.current = initial;
    return initial;
  });

  const show = useCallback((next: ClutchProgressStatus) => {
    const message = pickClutchProgressMessage(
      next.stage,
      usedMessagesRef.current,
    );
    usedMessagesRef.current.add(message);
    const progress = { ...next, message };
    displayedRef.current = progress;
    lastChangeRef.current = Date.now();
    setDisplayed(progress);
  }, []);

  useEffect(() => {
    const current = displayedRef.current;
    if (current?.stage === status.stage) {
      const progress = { ...current, metrics: status.metrics };
      displayedRef.current = progress;
      setDisplayed(progress);
      return;
    }

    const elapsed = Date.now() - lastChangeRef.current;
    const timeoutId = window.setTimeout(
      () => show(status),
      Math.max(0, CLUTCH_PROGRESS_MIN_VISIBLE_MS - elapsed),
    );
    return () => window.clearTimeout(timeoutId);
  }, [show, status]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      show({
        stage: idleProgressStage(displayed.stage),
        metrics: displayed.metrics,
      });
    }, CLUTCH_PROGRESS_IDLE_ROTATION_MS);
    return () => window.clearTimeout(timeoutId);
  }, [displayed, show]);

  const detail = formatClutchProgressMetrics(displayed.metrics);
  return (
    <output
      className="flex items-center gap-2.5 text-text-muted"
      aria-live="polite"
    >
      <div className="flex shrink-0 items-center gap-1" aria-hidden="true">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-300 [animation-delay:180ms]" />
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400 [animation-delay:360ms]" />
      </div>
      <div className="min-w-0">
        <div className="text-xs font-medium text-text-secondary">
          {displayed.message}
        </div>
        {detail && (
          <div className="mt-0.5 text-[11px] tabular-nums text-text-muted">
            {detail}
          </div>
        )}
      </div>
    </output>
  );
}
