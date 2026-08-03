"use client";

import Image from "next/image";
import { useMemo } from "react";
import { isValidHeadshotUrl } from "@/lib/api";
import {
  computeGaps,
  sortDriversByProgress,
} from "@/lib/replayPreviewGeometry";
import type { ReplayData, ReplayFrame } from "@/lib/types";

const TOP_N = 10; // Drivers shown in mini leaderboard

export function MiniLeaderboard({
  frame,
  drivers,
  polyline,
  arcLengths,
  circuitLengthM,
}: {
  frame: ReplayFrame;
  drivers: ReplayData["drivers"];
  polyline: [number, number][];
  arcLengths: number[];
  circuitLengthM: number;
}) {
  const sorted = useMemo(
    () => sortDriversByProgress(frame, polyline, arcLengths),
    [frame, polyline, arcLengths],
  );
  const gaps = useMemo(
    () => computeGaps(sorted, polyline, arcLengths, circuitLengthM),
    [sorted, polyline, arcLengths, circuitLengthM],
  );

  return (
    <div className="flex flex-col gap-0.5">
      {sorted.slice(0, TOP_N).map(({ code, data }, idx) => {
        const info = drivers[code];
        const position = data[7] > 0 ? idx + 1 : 0;
        if (position === 0) return null;

        return (
          <div
            key={code}
            className="flex items-center gap-2 px-2 py-1 rounded-md text-[11px]"
          >
            <span className="w-4 text-right font-mono font-bold text-text-muted tabular-nums">
              {position}
            </span>
            {info && isValidHeadshotUrl(info.headshot_url) ? (
              <Image
                src={info.headshot_url}
                alt={info.full_name}
                width={18}
                height={18}
                className="w-[18px] h-[18px] rounded-full object-cover shrink-0"
                unoptimized
              />
            ) : (
              <div className="w-[18px] h-[18px] rounded-full bg-bg-tertiary shrink-0" />
            )}
            <span
              className="font-mono font-bold tracking-wide"
              style={{
                color: info ? `#${info.color}` : "var(--delta-neutral)",
              }}
            >
              {code}
            </span>
            <span className="ml-auto font-mono text-[10px] text-text-muted tabular-nums">
              {gaps[idx] ?? ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}
