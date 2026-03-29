"use client";

import type { ReplayDriverInfo, ReplayFrame } from "@/lib/types";

interface LeaderboardProps {
  drivers: Record<string, ReplayDriverInfo>;
  frame: ReplayFrame | undefined;
  selectedDriver: string | null;
  onSelectDriver: (code: string | null) => void;
}

const COMPOUND_COLORS: Record<number, string> = {
  0: "#FF3333",
  1: "#FFD700",
  2: "#FFFFFF",
  3: "#33CC33",
  4: "#3399FF",
};

const COMPOUND_LABELS: Record<number, string> = {
  0: "S",
  1: "M",
  2: "H",
  3: "I",
  4: "W",
};

export default function Leaderboard({
  drivers,
  frame,
  selectedDriver,
  onSelectDriver,
}: LeaderboardProps) {
  if (!frame) return null;

  // Sort drivers by position
  const sorted = Object.entries(frame.d)
    .map(([code, data]) => ({ code, data }))
    .sort((a, b) => {
      const posA = a.data[8]; // position index
      const posB = b.data[8];
      if (posA === 0 && posB === 0) return 0;
      if (posA === 0) return 1;
      if (posB === 0) return -1;
      return posA - posB;
    });

  // Compute gaps (simple: using time diff based on position)
  const _leaderTime = sorted[0]?.data[0] ?? 0; // x coord as proxy - not real gap

  return (
    <div className="bg-bg-tertiary border border-border-primary rounded-sm">
      <div className="px-3 py-2 border-b border-border-primary">
        <h3 className="text-[10px] font-mono tracking-widest text-text-muted uppercase font-bold">
          Positions
        </h3>
      </div>
      <div className="max-h-[450px] overflow-y-auto">
        {sorted.map(({ code, data }) => {
          const info = drivers[code];
          const position = data[8];
          const compound = data[5];
          const tyreLife = data[6];
          const isSelected = code === selectedDriver;

          return (
            <button
              key={code}
              type="button"
              onClick={() => onSelectDriver(isSelected ? null : code)}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-bg-elevated ${
                isSelected ? "bg-bg-elevated" : ""
              }`}
            >
              {/* Position */}
              <span className="text-xs font-mono text-text-muted w-5 text-right shrink-0">
                {position || "–"}
              </span>

              {/* Team color bar */}
              <div
                className="w-1 h-5 rounded-full shrink-0"
                style={{
                  backgroundColor: info ? `#${info.color}` : "#999",
                }}
              />

              {/* Driver code */}
              <span
                className={`text-xs font-mono font-semibold flex-1 ${
                  isSelected ? "text-text-primary" : "text-text-secondary"
                }`}
              >
                {code}
              </span>

              {/* Tyre */}
              <div className="flex items-center gap-1 shrink-0">
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: COMPOUND_COLORS[compound] ?? "#999",
                  }}
                />
                <span className="text-[10px] font-mono text-text-muted">
                  {COMPOUND_LABELS[compound] ?? "?"}
                  {tyreLife > 0 ? tyreLife : ""}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
