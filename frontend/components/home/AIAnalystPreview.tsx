"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHART_COLORS, CustomDot } from "@/components/chart-primitives";
import ClutchIcon from "@/components/ui/ClutchIcon";
import { useEntityLinkColors } from "@/hooks/useEntityLinkColors";
import { apiHeaders, apiUrl } from "@/lib/api";
import { constructorHref, driverHref } from "@/lib/entityLinks";
import type { CircuitInfo } from "@/lib/types";

const QUESTION =
  "How did Lando and Max overtake Oscar in the 2025 championship?";

const INTRO_TEXT =
  "**Piastri started P10 in Melbourne** — earning just 2 points while Norris won. He immediately fired back with victories at **Bahrain**, **Saudi Arabia**, and **Miami** to take the championship lead. A **Norris win at Monaco** (R8) briefly closed the gap to just **3 points**, before Piastri's Spain win and a Norris DNF in **Canada** pushed his lead back out to **22 points**.";

const TABLE_ROWS = [
  {
    pos: "1",
    driver: "Lando Norris",
    driverCode: "NOR",
    team: "McLaren",
    pts: "423",
  },
  {
    pos: "2",
    driver: "Max Verstappen",
    driverCode: "VER",
    team: "Red Bull Racing",
    pts: "421",
  },
  {
    pos: "3",
    driver: "Oscar Piastri",
    driverCode: "PIA",
    team: "McLaren",
    pts: "410",
  },
  {
    pos: "4",
    driver: "George Russell",
    driverCode: "RUS",
    team: "Mercedes",
    pts: "319",
  },
  {
    pos: "5",
    driver: "Charles Leclerc",
    driverCode: "LEC",
    team: "Ferrari",
    pts: "242",
  },
];

const OUTRO_TEXT =
  "**Piastri's lead peaked at 34 points** after Zandvoort (R15), where Norris retired. The comeback started when Verstappen won **Italy and Baku** back-to-back while Piastri scored zero in Azerbaijan — the lead was suddenly just 25 points. Norris swept **Mexico City** (R20) to overtake Piastri by a single point, and sealed the title with a **2-point margin over Verstappen** — the closest finish in a decade.";

// Real 2025 points after each Grand Prix — source: /api/results/2025/points-progression
// NOR: #FF8000 (McLaren), VER: #3671C6 (Red Bull), PIA: #B25A00 (McLaren teammate, darkened 30%)
const CHART_DATA = [
  { round: "1", event_name: "Australian GP", NOR: 25, VER: 18, PIA: 2 },
  { round: "2", event_name: "Chinese GP", NOR: 44, VER: 36, PIA: 34 },
  { round: "3", event_name: "Japanese GP", NOR: 62, VER: 61, PIA: 49 },
  { round: "4", event_name: "Bahrain GP", NOR: 77, VER: 69, PIA: 74 },
  { round: "5", event_name: "Saudi Arabian GP", NOR: 89, VER: 87, PIA: 99 },
  { round: "6", event_name: "Miami GP", NOR: 115, VER: 99, PIA: 131 },
  { round: "7", event_name: "Emilia Romagna GP", NOR: 133, VER: 124, PIA: 146 },
  { round: "8", event_name: "Monaco GP", NOR: 158, VER: 136, PIA: 161 },
  { round: "9", event_name: "Spanish GP", NOR: 176, VER: 137, PIA: 186 },
  { round: "10", event_name: "Canadian GP", NOR: 176, VER: 155, PIA: 198 },
  { round: "11", event_name: "Austrian GP", NOR: 201, VER: 155, PIA: 216 },
  { round: "12", event_name: "British GP", NOR: 226, VER: 165, PIA: 234 },
  { round: "13", event_name: "Belgian GP", NOR: 250, VER: 185, PIA: 266 },
  { round: "14", event_name: "Hungarian GP", NOR: 275, VER: 187, PIA: 284 },
  { round: "15", event_name: "Dutch GP", NOR: 275, VER: 205, PIA: 309 },
  { round: "16", event_name: "Italian GP", NOR: 293, VER: 230, PIA: 324 },
  { round: "17", event_name: "Azerbaijan GP", NOR: 299, VER: 255, PIA: 324 },
  { round: "18", event_name: "Singapore GP", NOR: 314, VER: 273, PIA: 336 },
  { round: "19", event_name: "United States GP", NOR: 332, VER: 306, PIA: 346 },
  { round: "20", event_name: "Mexico City GP", NOR: 357, VER: 321, PIA: 356 },
  { round: "21", event_name: "São Paulo GP", NOR: 390, VER: 341, PIA: 366 },
  { round: "22", event_name: "Las Vegas GP", NOR: 390, VER: 366, PIA: 366 },
  { round: "23", event_name: "Qatar GP", NOR: 408, VER: 396, PIA: 392 },
  { round: "24", event_name: "Abu Dhabi GP", NOR: 423, VER: 421, PIA: 410 },
];

const DRIVERS = [
  { key: "NOR", name: "Norris", color: "#FF8000" },
  { key: "VER", name: "Verstappen", color: "#3671C6" },
  { key: "PIA", name: "Piastri", color: "#B25A00" },
];

function getDriverColor(
  code: string | undefined,
  driverColors: Map<string, string>,
) {
  if (!code) return null;
  return (
    driverColors.get(code) ??
    DRIVERS.find((driver) => driver.key === code)?.color ??
    null
  );
}

function getTeamColor(
  team: string | undefined,
  teamColors: Map<string, string>,
) {
  if (!team) return null;
  return teamColors.get(team) ?? null;
}

type Phase =
  | "idle"
  | "thinking"
  | "intro"
  | "table"
  | "chart"
  | "outro"
  | "done";

type EntityToken = {
  text: string;
  href: string;
  color?: string | null;
};

const DRIVER_ALIASES = [
  { text: "Lando Norris", href: "/drivers/NOR", colorKey: "NOR" },
  { text: "Lando", href: "/drivers/NOR", colorKey: "NOR" },
  { text: "Norris", href: "/drivers/NOR", colorKey: "NOR" },
  { text: "Max Verstappen", href: "/drivers/VER", colorKey: "VER" },
  { text: "Max", href: "/drivers/VER", colorKey: "VER" },
  { text: "Verstappen", href: "/drivers/VER", colorKey: "VER" },
  { text: "Oscar Piastri", href: "/drivers/PIA", colorKey: "PIA" },
  { text: "Oscar", href: "/drivers/PIA", colorKey: "PIA" },
  { text: "Piastri", href: "/drivers/PIA", colorKey: "PIA" },
  { text: "George Russell", href: "/drivers/RUS", colorKey: "RUS" },
  { text: "Russell", href: "/drivers/RUS", colorKey: "RUS" },
  { text: "Charles Leclerc", href: "/drivers/LEC", colorKey: "LEC" },
  { text: "Leclerc", href: "/drivers/LEC", colorKey: "LEC" },
];

const TEAM_ALIASES = [
  { text: "McLaren", href: "/constructors/McLaren" },
  {
    text: "Red Bull Racing",
    href: "/constructors/Red%20Bull%20Racing",
  },
  { text: "Mercedes", href: "/constructors/Mercedes" },
  { text: "Ferrari", href: "/constructors/Ferrari" },
];

const CIRCUIT_ALIASES = [
  { text: "Melbourne", aliases: ["melbourne", "albert park"] },
  { text: "Bahrain", aliases: ["bahrain"] },
  { text: "Saudi Arabia", aliases: ["saudi arabia", "jeddah"] },
  { text: "Miami", aliases: ["miami"] },
  { text: "Monaco", aliases: ["monaco", "monte carlo"] },
  { text: "Spain", aliases: ["spain", "barcelona", "catalunya"] },
  { text: "Canada", aliases: ["canada", "montreal", "gilles villeneuve"] },
  { text: "Zandvoort", aliases: ["zandvoort"] },
  { text: "Italy", aliases: ["italy", "monza"] },
  { text: "Baku", aliases: ["baku", "azerbaijan"] },
  { text: "Azerbaijan", aliases: ["azerbaijan", "baku"] },
  { text: "Mexico City", aliases: ["mexico city", "mexico", "autodromo"] },
];

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function fetchCircuits(): Promise<CircuitInfo[]> {
  const res = await fetch(apiUrl("/api/circuits/"), {
    headers: apiHeaders(),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { circuits?: CircuitInfo[] };
  return data.circuits ?? [];
}

function findCircuitHref(
  circuits: CircuitInfo[],
  aliases: string[],
): string | null {
  const match = circuits.find((circuit) => {
    const haystack =
      `${circuit.name} ${circuit.location} ${circuit.country}`.toLowerCase();
    return aliases.some((alias) => haystack.includes(alias));
  });
  return match ? `/circuits/${match.id}` : null;
}

function renderEntityText(
  text: string,
  entities: EntityToken[],
  options?: { useColor?: boolean; linkClassName?: string },
) {
  if (!text || entities.length === 0) return text;

  const pattern = new RegExp(
    `(${entities.map((entity) => escapeRegExp(entity.text)).join("|")})`,
    "g",
  );
  const parts = text.split(pattern);
  const defaultClass =
    "font-semibold no-underline transition-opacity hover:opacity-80";
  const linkClassName = options?.linkClassName ?? defaultClass;
  const useColor = options?.useColor ?? true;

  return parts.map((part, i) => {
    const entity = entities.find((candidate) => candidate.text === part);
    if (!entity) {
      return (
        // biome-ignore lint/suspicious/noArrayIndexKey: deterministic split fragments
        <span key={i}>{part}</span>
      );
    }

    return (
      <Link
        // biome-ignore lint/suspicious/noArrayIndexKey: deterministic split fragments
        key={i}
        href={entity.href}
        className={linkClassName}
        style={useColor && entity.color ? { color: entity.color } : undefined}
      >
        {part}
      </Link>
    );
  });
}

function renderRichText(text: string, entities: EntityToken[]) {
  const parts = text.split(/(\*\*[^*]+\*\*)/);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: static text segments from a fixed split
          <strong key={i} className="text-text-primary font-semibold">
            {renderEntityText(part.slice(2, -2), entities)}
          </strong>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: static text segments from a fixed split
          <span key={i}>{renderEntityText(part, entities)}</span>
        ),
      )}
    </>
  );
}

interface TooltipEntry {
  dataKey: string;
  value: number;
  color: string;
  name: string;
  payload: { event_name?: string };
}

function PreviewTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const eventName = (
    payload[0]?.payload?.event_name ?? `Round ${label}`
  ).replace("Grand Prix", "GP");
  return (
    <div className="rounded-lg border border-border-primary bg-bg-tertiary p-3 shadow-xl">
      <p className="mb-2 font-bold text-text-primary text-xs">{eventName}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="mb-1 flex items-center gap-2">
          <div
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-xs font-bold text-text-primary">
            {entry.name}: {entry.value} pts
          </span>
        </div>
      ))}
    </div>
  );
}

function ChampionshipChart({ onReady }: { onReady?: () => void }) {
  const completedRef = useRef(0);

  function handleAnimationEnd() {
    completedRef.current += 1;
    if (completedRef.current >= DRIVERS.length) {
      onReady?.();
    }
  }

  return (
    <div className="animate-fadeIn rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
      <p className="mb-2 text-[9px] font-mono uppercase tracking-[0.1em] text-text-muted">
        Points Progression · R1–R24
      </p>
      <div className="relative" style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart
            data={CHART_DATA}
            margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
          >
            <defs>
              {DRIVERS.map((d) => (
                <filter
                  key={`glow-${d.key}`}
                  id={`preview-glow-${d.key}`}
                  x="-50%"
                  y="-50%"
                  width="200%"
                  height="200%"
                >
                  <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              ))}
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={CHART_COLORS.borderPrimary}
            />
            <XAxis
              dataKey="round"
              stroke={CHART_COLORS.textTertiary}
              tick={{ fill: CHART_COLORS.textTertiary, fontSize: 10 }}
              label={{
                value: "Round",
                position: "insideBottom",
                offset: -14,
                style: { fontWeight: "bold", fill: "white", fontSize: 11 },
              }}
              interval={3}
            />
            <YAxis
              stroke={CHART_COLORS.textTertiary}
              tick={{ fill: CHART_COLORS.textTertiary, fontSize: 10 }}
              label={{
                value: "Total Points",
                angle: -90,
                position: "center",
                dx: -30,
                style: { fontWeight: "bold", fill: "white", fontSize: 11 },
              }}
              domain={[0, 450]}
              width={60}
            />
            <Tooltip content={<PreviewTooltip />} />
            {DRIVERS.map((d) => (
              <Line
                key={d.key}
                type="linear"
                dataKey={d.key}
                name={d.name}
                stroke={d.color}
                strokeWidth={2}
                dot={<CustomDot />}
                activeDot={{ r: 6, fill: d.color, stroke: d.color }}
                filter={`url(#preview-glow-${d.key})`}
                isAnimationActive={true}
                connectNulls={false}
                onAnimationEnd={handleAnimationEnd}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>

        {/* Legend — top-left overlay, same as PointsByRoundGraph */}
        <div className="pointer-events-none absolute left-20 top-2 rounded-sm border border-border-primary bg-bg-primary/90 p-2 backdrop-blur-sm">
          <div className="flex flex-col gap-1">
            {DRIVERS.map((d) => (
              <div key={d.key} className="flex items-center gap-2">
                <div
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: d.color }}
                />
                <span className="font-mono text-[10px] font-bold text-text-primary">
                  {d.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AIAnalystPreview() {
  const router = useRouter();
  const { driverColors, teamColors } = useEntityLinkColors();
  const { data: circuits = [] } = useQuery({
    queryKey: ["preview-circuits"],
    queryFn: fetchCircuits,
    staleTime: 1000 * 60 * 60,
  });
  const [phase, setPhase] = useState<Phase>("idle");
  const [introText, setIntroText] = useState("");
  const [outroText, setOutroText] = useState("");
  const [tableVisible, setTableVisible] = useState(false);
  const [chartVisible, setChartVisible] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timeoutRef.current = setTimeout(() => {
      setPhase("thinking");

      timeoutRef.current = setTimeout(() => {
        setPhase("intro");
        let i = 0;
        intervalRef.current = setInterval(() => {
          i++;
          setIntroText(INTRO_TEXT.slice(0, i));
          if (i >= INTRO_TEXT.length) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            // Reveal table
            timeoutRef.current = setTimeout(() => {
              setTableVisible(true);
              setPhase("table");
              // Stream outro
              timeoutRef.current = setTimeout(() => {
                setPhase("outro");
                let j = 0;
                intervalRef.current = setInterval(() => {
                  j++;
                  setOutroText(OUTRO_TEXT.slice(0, j));
                  if (j >= OUTRO_TEXT.length) {
                    if (intervalRef.current) clearInterval(intervalRef.current);
                    // Chart appears after outro finishes
                    setChartVisible(true);
                    setPhase("chart");
                  }
                }, 14);
              }, 600);
            }, 500);
          }
        }, 14);
      }, 800);
    }, 400);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    router.push("/ask");
  }

  const entities: EntityToken[] = [
    ...DRIVER_ALIASES.map((entity) => ({
      text: entity.text,
      href: entity.href,
      color: getDriverColor(entity.colorKey, driverColors),
    })),
    ...TEAM_ALIASES.map((entity) => ({
      text: entity.text,
      href: entity.href,
      color: null,
    })),
    ...CIRCUIT_ALIASES.map((entity) => ({
      text: entity.text,
      href: findCircuitHref(circuits, entity.aliases) ?? "/circuits",
      color: null,
    })),
  ].sort((a, b) => b.text.length - a.text.length);

  return (
    <section className="overflow-hidden border-b border-border-primary/40 bg-bg-primary px-6 py-10">
      <div className="mx-auto max-w-4xl">
        {/* Section label */}
        <div className="mb-5 flex items-center gap-3">
          <div className="h-2 w-2 animate-pulse rounded-full bg-purple-500" />
          <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-text-muted">
            Ask Clutch
          </span>
        </div>

        {/* Card */}
        <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] shadow-[0_16px_64px_-16px_rgba(0,0,0,0.6)]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-purple-500/20 bg-purple-500/10 text-purple-300">
                <ClutchIcon className="h-4 w-4" />
              </div>
              <span className="text-sm font-bold text-text-primary">
                Clutch
              </span>
            </div>
            <Link
              href="/ask"
              className="flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.1em] text-text-muted transition-all hover:border-purple-500/30 hover:bg-purple-500/10 hover:text-purple-300"
            >
              Try it
              <svg
                className="h-3 w-3"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <title>Open</title>
                <path
                  fillRule="evenodd"
                  d="M5.22 14.78a.75.75 0 001.06 0l7.22-7.22v5.69a.75.75 0 001.5 0v-7.5a.75.75 0 00-.75-.75h-7.5a.75.75 0 000 1.5h5.69l-7.22 7.22a.75.75 0 000 1.06z"
                  clipRule="evenodd"
                />
              </svg>
            </Link>
          </div>

          {/* Messages */}
          <div className="space-y-4 px-5 py-5">
            {/* User message */}
            <div className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl border border-[var(--message-user-border)] bg-[var(--message-user-bg)] px-4 py-2.5 text-sm text-text-primary">
                {renderEntityText(QUESTION, entities, {
                  useColor: false,
                  linkClassName:
                    "no-underline transition-opacity hover:opacity-80 text-text-primary font-normal",
                })}
              </div>
            </div>

            {/* AI response */}
            {phase !== "idle" && (
              <div className="flex gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-purple-500/20 bg-purple-500/10 text-purple-300">
                  <ClutchIcon className="h-4 w-4" />
                </div>

                <div className="min-w-0 flex-1 rounded-2xl border border-[var(--message-assistant-border)] bg-[var(--message-assistant-bg)] px-4 py-3">
                  {phase === "thinking" ? (
                    <div className="flex items-center gap-2 text-xs text-text-muted">
                      <svg
                        className="h-3.5 w-3.5 animate-spin"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <title>Analyzing</title>
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      Querying championship standings...
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {introText && (
                        <p className="text-sm leading-relaxed text-text-secondary">
                          {renderRichText(introText, entities)}
                          {phase === "intro" && (
                            <span className="ml-0.5 inline-block h-[1em] w-0.5 animate-pulse bg-purple-400 align-middle" />
                          )}
                        </p>
                      )}

                      {tableVisible && (
                        <div className="animate-fadeIn overflow-x-auto rounded-xl border border-white/[0.06]">
                          <table className="min-w-full text-xs">
                            <thead>
                              <tr className="border-b border-white/[0.06] bg-white/[0.03]">
                                {["Pos", "Driver", "Team", "Pts"].map((h) => (
                                  <th
                                    key={h}
                                    className="px-3 py-2 text-left font-mono text-[10px] uppercase tracking-[0.08em] text-text-muted"
                                  >
                                    {h}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {TABLE_ROWS.map((row) => (
                                <tr
                                  key={row.pos}
                                  className="border-b border-white/[0.04] transition-colors hover:bg-white/[0.02]"
                                >
                                  <td className="px-3 py-2 font-mono text-text-muted">
                                    {row.pos}
                                  </td>
                                  <td className="px-3 py-2 font-medium text-text-secondary">
                                    <Link
                                      href={
                                        driverHref({
                                          driver_code: row.driverCode,
                                          full_name: row.driver,
                                        }) ?? "/drivers"
                                      }
                                      className="font-semibold no-underline transition-opacity hover:opacity-80 text-text-primary"
                                    >
                                      {row.driver}
                                    </Link>
                                  </td>
                                  <td className="px-3 py-2 text-text-muted">
                                    <Link
                                      href={
                                        constructorHref(row.team) ??
                                        "/constructors"
                                      }
                                      className="font-semibold no-underline transition-opacity hover:opacity-80"
                                      style={{
                                        color:
                                          getTeamColor(row.team, teamColors) ??
                                          "var(--text-primary)",
                                      }}
                                    >
                                      {row.team}
                                    </Link>
                                  </td>
                                  <td className="px-3 py-2 font-mono font-bold text-text-secondary">
                                    {row.pts}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {outroText && (
                        <p className="text-sm leading-relaxed text-text-secondary">
                          {renderRichText(outroText, entities)}
                          {phase === "outro" && (
                            <span className="ml-0.5 inline-block h-[1em] w-0.5 animate-pulse bg-purple-400 align-middle" />
                          )}
                        </p>
                      )}

                      {chartVisible && <ChampionshipChart />}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-white/[0.06] px-4 py-3">
            <form
              onSubmit={handleSubmit}
              className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 transition-all focus-within:border-purple-500/30 focus-within:shadow-[0_0_20px_-5px_rgba(160,32,240,0.15)]"
            >
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask anything about F1..."
                className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
              />
              <button
                type="submit"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-500 text-white transition-all hover:bg-purple-600 active:scale-95"
              >
                <svg
                  className="h-3.5 w-3.5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <title>Ask</title>
                  <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
