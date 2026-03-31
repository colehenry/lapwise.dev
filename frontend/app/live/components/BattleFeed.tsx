"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef } from "react";
import { isValidHeadshotUrl } from "@/lib/api";
import type {
  BattleEvent,
  ReplayCorner,
  ReplayData,
  ReplayDriverInfo,
} from "@/lib/types";

interface BattleFeedProps {
  replayData: ReplayData;
  currentTime: number;
  currentLap: number;
  onSelectDriver?: (code: string | null) => void;
  onBattleEvent?: (event: BattleEvent) => void;
}

const COMPOUND_LABELS: Record<number, string> = {
  0: "Soft",
  1: "Medium",
  2: "Hard",
  3: "Inter",
  4: "Wet",
};

/** Build a lookup from driver number to driver code */
function buildNumberToCode(
  drivers: Record<string, ReplayDriverInfo>,
): Map<number, string> {
  const map = new Map<number, string>();
  for (const [code, info] of Object.entries(drivers)) {
    if (info.number > 0) map.set(info.number, code);
  }
  return map;
}

/** Find the nearest corner to a given track position */
function findNearestCorner(
  x: number,
  y: number,
  corners: ReplayCorner[],
): ReplayCorner | null {
  if (!corners.length) return null;
  let best: ReplayCorner | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const c of corners) {
    const dx = c.x - x;
    const dy = c.y - y;
    const d = dx * dx + dy * dy;
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best;
}

/**
 * Pre-compute all battle events from replay frame data.
 */
function computeBattleEvents(replayData: ReplayData): BattleEvent[] {
  const { frames, race_control, drivers } = replayData;
  const events: BattleEvent[] = [];
  const numberToCode = buildNumberToCode(drivers);
  let eventId = 0;

  if (frames.length === 0) return events;

  // --- Overtake detection ---
  const lastPosition: Record<string, number> = {};
  for (const [code, data] of Object.entries(frames[0].d)) {
    lastPosition[code] = data[8];
  }

  const recentOvertakes = new Map<string, number>();

  for (let i = 1; i < frames.length; i++) {
    const frame = frames[i];
    const prevFrame = frames[i - 1];

    for (const [code, data] of Object.entries(frame.d)) {
      const pos = data[8];
      const prevPos = lastPosition[code];

      if (prevPos && pos > 0 && prevPos > 0 && pos < prevPos) {
        for (const [otherCode, otherData] of Object.entries(frame.d)) {
          if (otherCode === code) continue;
          const otherPrev = lastPosition[otherCode];
          const otherPos = otherData[8];

          if (
            otherPrev &&
            otherPos > 0 &&
            otherPrev > 0 &&
            otherPos > otherPrev &&
            otherPos === prevPos &&
            pos === otherPrev
          ) {
            const pairKey = `${code}-${otherCode}`;
            const lastLap = recentOvertakes.get(pairKey);
            if (lastLap !== undefined && frame.lap - lastLap < 3) continue;
            recentOvertakes.set(pairKey, frame.lap);

            const overtaker = drivers[code];
            const overtaken = drivers[otherCode];
            const overtakerName =
              overtaker?.full_name?.split(" ").pop() ?? code;
            const overtakenName =
              overtaken?.full_name?.split(" ").pop() ?? otherCode;

            const corners = replayData.track.corners;
            const nearestCorner = corners?.length
              ? findNearestCorner(data[0], data[1], corners)
              : null;
            const cornerSuffix = nearestCorner
              ? ` at Turn ${nearestCorner.number}${nearestCorner.letter}`
              : "";

            events.push({
              id: `ov-${eventId++}`,
              t: frame.t,
              lap: frame.lap,
              type: "overtake",
              message: `${overtakerName} overtakes ${overtakenName} for P${pos}${cornerSuffix}`,
              driver: code,
              driver2: otherCode,
            });
            break;
          }
        }
      }

      lastPosition[code] = pos;
    }

    // --- Pit stop detection ---
    for (const [code, data] of Object.entries(frame.d)) {
      const prevData = prevFrame.d[code];
      if (!prevData) continue;

      const compound = data[5];
      const prevCompound = prevData[5];
      const tyreLife = data[6];
      const prevTyreLife = prevData[6];

      if (
        compound !== prevCompound ||
        (prevTyreLife > 3 && tyreLife <= 1 && tyreLife < prevTyreLife)
      ) {
        const driverInfo = drivers[code];
        const driverName = driverInfo?.full_name?.split(" ").pop() ?? code;
        const fromTyre = COMPOUND_LABELS[prevCompound] ?? "?";
        const toTyre = COMPOUND_LABELS[compound] ?? "?";

        events.push({
          id: `pit-${eventId++}`,
          t: frame.t,
          lap: frame.lap,
          type: "pit_stop",
          message:
            compound !== prevCompound
              ? `${driverName} pits — ${fromTyre} → ${toTyre}`
              : `${driverName} pits for new ${toTyre}`,
          driver: code,
        });
      }
    }

    // --- Safety car / VSC / Red flag ---
    if (frame.sc !== prevFrame.sc) {
      const scLabels: Record<number, string> = {
        0: "GREEN FLAG",
        1: "SAFETY CAR DEPLOYED",
        2: "VIRTUAL SAFETY CAR",
        3: "RED FLAG",
      };
      events.push({
        id: `sc-${eventId++}`,
        t: frame.t,
        lap: frame.lap,
        type:
          frame.sc === 0
            ? "green_flag"
            : frame.sc === 3
              ? "red_flag"
              : "safety_car",
        message: scLabels[frame.sc] ?? "TRACK STATUS CHANGE",
      });
    }

    // --- Weather changes ---
    if (frame.w) {
      let prevWeather = null;
      for (let j = i - 1; j >= 0; j--) {
        if (frames[j].w) {
          prevWeather = frames[j].w;
          break;
        }
      }

      if (prevWeather) {
        const parts: string[] = [];
        if (frame.w.rainfall !== prevWeather.rainfall) {
          parts.push(frame.w.rainfall ? "Rain detected" : "Rain stopped");
        }
        if (Math.abs(frame.w.track_temp - prevWeather.track_temp) >= 1) {
          parts.push(
            `Track ${prevWeather.track_temp}° → ${frame.w.track_temp}°C`,
          );
        }
        if (parts.length > 0) {
          events.push({
            id: `wx-${eventId++}`,
            t: frame.t,
            lap: frame.lap,
            type: "weather",
            message: parts.join(" — "),
          });
        }
      }
    }
  }

  // --- Race control messages ---
  for (const msg of race_control) {
    const driverCode = msg.driver_number
      ? (numberToCode.get(msg.driver_number) ?? undefined)
      : undefined;

    const isDrs =
      msg.category === "Drs" || msg.message.toUpperCase().includes("DRS");

    events.push({
      id: `rcm-${eventId++}`,
      t: msg.t,
      lap: 0,
      type: isDrs ? "drs" : "race_control",
      message: msg.message,
      driver: driverCode,
      category: msg.category,
    });
  }

  events.sort((a, b) => a.t - b.t);
  return events;
}

const EVENT_STYLES: Record<
  string,
  { icon: string; accent: string; bg: string }
> = {
  overtake: {
    icon: "⇅",
    accent: "text-purple-400",
    bg: "border-l-purple-500",
  },
  pit_stop: {
    icon: "●",
    accent: "text-blue-400",
    bg: "border-l-blue-500",
  },
  safety_car: {
    icon: "⚠",
    accent: "text-yellow-400",
    bg: "border-l-yellow-500",
  },
  green_flag: {
    icon: "🟢",
    accent: "text-green-400",
    bg: "border-l-green-500",
  },
  red_flag: {
    icon: "🛑",
    accent: "text-red-400",
    bg: "border-l-red-500",
  },
  weather: {
    icon: "🌡",
    accent: "text-cyan-400",
    bg: "border-l-cyan-500",
  },
  drs: {
    icon: "▶",
    accent: "text-green-400",
    bg: "border-l-green-500",
  },
  race_control: {
    icon: "📢",
    accent: "text-text-secondary",
    bg: "border-l-border-primary",
  },
};

function DriverBadge({
  code,
  driver,
  small,
}: {
  code: string;
  driver?: ReplayDriverInfo;
  small?: boolean;
}) {
  if (!driver) return null;
  const size = small ? "w-4 h-4" : "w-5 h-5";
  return (
    <span className="inline-flex items-center gap-1">
      {isValidHeadshotUrl(driver.headshot_url) ? (
        <Image
          src={driver.headshot_url}
          alt={driver.full_name}
          width={small ? 16 : 20}
          height={small ? 16 : 20}
          className={`${size} rounded-full object-cover`}
          unoptimized
        />
      ) : (
        <span
          className={`${size} rounded-full inline-block`}
          style={{ backgroundColor: `#${driver.color}` }}
        />
      )}
      <span
        className="font-mono font-bold text-[10px]"
        style={{ color: `#${driver.color}` }}
      >
        {code}
      </span>
    </span>
  );
}

export default function BattleFeed({
  replayData,
  currentTime,
  onSelectDriver,
  onBattleEvent,
}: BattleFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const allEvents = useMemo(
    () => computeBattleEvents(replayData),
    [replayData],
  );

  // Filter to current time, then reverse so newest is first
  const visibleEvents = useMemo(
    () => allEvents.filter((e) => e.t <= currentTime),
    [allEvents, currentTime],
  );

  // Newest first for display
  const displayEvents = useMemo(
    () => [...visibleEvents].reverse().slice(0, 40),
    [visibleEvents],
  );

  // Notify parent of latest notable events
  const prevCountRef = useRef(0);
  useEffect(() => {
    if (visibleEvents.length > prevCountRef.current) {
      if (onBattleEvent) {
        const latest = visibleEvents[visibleEvents.length - 1];
        if (
          latest?.driver &&
          (latest.type === "overtake" || latest.type === "pit_stop")
        ) {
          onBattleEvent(latest);
        }
      }
    }
    prevCountRef.current = visibleEvents.length;
  }, [visibleEvents, onBattleEvent]);

  return (
    <div ref={scrollRef} className="overflow-y-auto flex-1">
      {displayEvents.length === 0 ? (
        <p className="text-xs text-text-muted p-4 text-center">
          Waiting for race events...
        </p>
      ) : (
        displayEvents.map((event) => {
          const style = EVENT_STYLES[event.type] ?? EVENT_STYLES.race_control;
          const isRecent = currentTime - event.t < 5;
          const isVeryRecent = currentTime - event.t < 2;

          return (
            <button
              type="button"
              key={event.id}
              className={`w-full text-left border-l-2 ${style.bg} px-3 py-1.5 transition-all duration-300 ${
                isVeryRecent
                  ? "bg-bg-elevated/50"
                  : isRecent
                    ? "opacity-90"
                    : "opacity-75"
              } ${event.driver ? "cursor-pointer hover:bg-bg-elevated/30" : "cursor-default"}`}
              onClick={() => {
                if (event.driver && onSelectDriver) {
                  onSelectDriver(event.driver);
                }
              }}
            >
              {/* Event header: icon + lap only */}
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[10px]">{style.icon}</span>
                {event.lap > 0 && (
                  <span className="text-[10px] font-mono text-text-muted">
                    L{event.lap}
                  </span>
                )}
              </div>

              {/* Event body */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {event.type === "overtake" && event.driver && event.driver2 ? (
                  <div className="flex items-center gap-1.5 text-[11px] leading-tight">
                    <DriverBadge
                      code={event.driver}
                      driver={replayData.drivers[event.driver]}
                      small
                    />
                    <span className="text-text-muted">→</span>
                    <DriverBadge
                      code={event.driver2}
                      driver={replayData.drivers[event.driver2]}
                      small
                    />
                    <span className={`${style.accent} text-[11px]`}>
                      P{event.message.match(/P(\d+)/)?.[1] ?? ""}
                    </span>
                  </div>
                ) : event.type === "pit_stop" && event.driver ? (
                  <div className="flex items-center gap-1.5 text-[11px] leading-tight">
                    <DriverBadge
                      code={event.driver}
                      driver={replayData.drivers[event.driver]}
                      small
                    />
                    <span className={`${style.accent} text-[11px]`}>
                      {event.message.replace(/^\w+\s/, "")}
                    </span>
                  </div>
                ) : event.type === "safety_car" || event.type === "red_flag" ? (
                  <span
                    className={`${style.accent} text-[11px] font-bold tracking-wide leading-tight`}
                  >
                    {event.message}
                  </span>
                ) : (
                  <div className="flex items-center gap-1.5 text-[11px] leading-tight">
                    {event.driver && (
                      <DriverBadge
                        code={event.driver}
                        driver={replayData.drivers[event.driver]}
                        small
                      />
                    )}
                    <span
                      className={`${style.accent} text-[11px] leading-tight`}
                    >
                      {event.message}
                    </span>
                  </div>
                )}
              </div>
            </button>
          );
        })
      )}
    </div>
  );
}
