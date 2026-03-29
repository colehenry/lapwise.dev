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
  CarEvent: "text-red-400",
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

  // Auto-scroll to latest
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  return (
    <div className="bg-bg-tertiary border border-border-primary rounded-sm">
      <div className="px-3 py-2 border-b border-border-primary">
        <h3 className="text-[10px] font-mono tracking-widest text-text-muted uppercase font-bold">
          Race Control
        </h3>
      </div>
      <div
        ref={scrollRef}
        className="max-h-[200px] overflow-y-auto p-2 space-y-1"
      >
        {visibleMessages.length === 0 ? (
          <p className="text-xs text-text-muted p-2 text-center">
            No messages yet
          </p>
        ) : (
          visibleMessages.slice(-20).map((msg, i) => {
            const colorClass =
              CATEGORY_COLORS[msg.category ?? ""] ?? "text-text-secondary";
            const isRecent = currentTime - msg.t < 10;

            return (
              <div
                key={`${msg.t}-${i}`}
                className={`text-[11px] leading-tight transition-opacity ${
                  isRecent ? "opacity-100" : "opacity-60"
                }`}
              >
                <span className="font-mono text-text-muted mr-1.5">
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
