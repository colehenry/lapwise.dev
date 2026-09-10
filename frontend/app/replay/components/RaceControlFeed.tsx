"use client";

import { useEffect, useRef } from "react";
import type { ReplayRaceControlMessage } from "@/lib/types";

interface RaceControlFeedProps {
  messages: ReplayRaceControlMessage[];
  currentTime: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  Flag: "text-yellow-400",
  Drs: "text-green-400",
  SafetyCar: "text-yellow-300",
  CarEvent: "text-danger-bright",
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function RaceControlFeed({
  messages,
  currentTime,
}: RaceControlFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Filter messages up to current time
  const visibleMessages = messages.filter((m) => m.t <= currentTime);

  // Auto-scroll to latest when new messages appear
  const prevCountRef = useRef(0);
  useEffect(() => {
    if (visibleMessages.length !== prevCountRef.current) {
      prevCountRef.current = visibleMessages.length;
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }
  }, [visibleMessages.length]);

  return (
    <div className="bg-surface-panel border border-line-soft rounded-sm">
      <div className="px-3 py-2 border-b border-line-soft">
        <h3 className="text-[10px] font-mono tracking-widest text-ink-faint uppercase font-bold">
          Race Control
        </h3>
      </div>
      <div
        ref={scrollRef}
        className="max-h-[200px] overflow-y-auto p-2 space-y-1"
      >
        {visibleMessages.length === 0 ? (
          <p className="text-xs text-ink-faint p-2 text-center">
            No messages yet
          </p>
        ) : (
          visibleMessages.slice(-20).map((msg, i) => {
            const colorClass =
              CATEGORY_COLORS[msg.category ?? ""] ?? "text-ink-base";
            const isRecent = currentTime - msg.t < 10;

            return (
              <div
                key={`${msg.t}-${i}`}
                className={`text-[11px] leading-tight transition-opacity ${
                  isRecent ? "opacity-100" : "opacity-60"
                }`}
              >
                <span className="font-mono text-ink-faint mr-1.5">
                  {formatTime(msg.t)}
                </span>
                <span className={colorClass}>{msg.message}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
