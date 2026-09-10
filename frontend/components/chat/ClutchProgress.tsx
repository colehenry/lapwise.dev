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
    <output className="flex items-start gap-2.5" aria-live="polite">
      {/* Red because these are the start lights, not because anything is
          wrong. --danger is F1's own red. */}
      <span
        aria-hidden="true"
        className="start-lights mt-[5px] flex shrink-0 items-center gap-1"
      >
        <span className="h-2 w-2 rounded-full bg-danger" />
        <span className="h-2 w-2 rounded-full bg-danger" />
        <span className="h-2 w-2 rounded-full bg-danger" />
      </span>
      <div className="min-w-0">
        <div className="text-[13px] leading-[1.5] text-ink-soft">
          {displayed.message}
        </div>
        {detail && (
          <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint tabular-nums">
            {detail}
          </div>
        )}
      </div>
    </output>
  );
}
