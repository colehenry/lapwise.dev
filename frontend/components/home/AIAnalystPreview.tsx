"use client";

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

const QUESTION =
  "How did Lando and Max overtake Oscar in the 2025 championship?";

const INTRO_TEXT =
  "**Piastri started P10 in Melbourne** — earning just 2 points while Norris won. He immediately fired back with victories at **Bahrain**, **Saudi Arabia**, and **Miami** to take the championship lead. A **Norris win at Monaco** (R8) briefly closed the gap to just **3 points**, before Piastri's Spain win and a Norris DNF in **Canada** pushed his lead back out to **22 points**.";

const TABLE_ROWS = [
  { pos: "1", driver: "Lando Norris", team: "McLaren", pts: "423" },
  { pos: "2", driver: "Max Verstappen", team: "Red Bull Racing", pts: "421" },
  { pos: "3", driver: "Oscar Piastri", team: "McLaren", pts: "410" },
  { pos: "4", driver: "George Russell", team: "Mercedes", pts: "319" },
  { pos: "5", driver: "Charles Leclerc", team: "Ferrari", pts: "242" },
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

type Phase =
  | "idle"
  | "thinking"
  | "intro"
  | "table"
  | "chart"
  | "outro"
  | "done";

function renderBold(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: static text segments from a fixed split
          <strong key={i} className="text-text-primary font-semibold">
            {part.slice(2, -2)}
          </strong>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: static text segments from a fixed split
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

function AnalystIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <title>AI Analyst</title>
      <path
        fillRule="evenodd"
        d="M9 4.5a.75.75 0 01.721.544l.813 2.846a3.75 3.75 0 002.576 2.576l2.846.813a.75.75 0 010 1.442l-2.846.813a3.75 3.75 0 00-2.576 2.576l-.813 2.846a.75.75 0 01-1.442 0l-.813-2.846a3.75 3.75 0 00-2.576-2.576l-2.846-.813a.75.75 0 010-1.442l2.846-.813A3.75 3.75 0 007.466 7.89l.813-2.846A.75.75 0 019 4.5zM18 1.5a.75.75 0 01.728.568l.258 1.036c.236.94.97 1.674 1.91 1.91l1.036.258a.75.75 0 010 1.456l-1.036.258c-.94.236-1.674.97-1.91 1.91l-.258 1.036a.75.75 0 01-1.456 0l-.258-1.036a2.625 2.625 0 00-1.91-1.91l-1.036-.258a.75.75 0 010-1.456l1.036-.258a2.625 2.625 0 001.91-1.91l.258-1.036A.75.75 0 0118 1.5zM16.5 15a.75.75 0 01.712.513l.394 1.183c.15.447.5.799.948.948l1.183.395a.75.75 0 010 1.422l-1.183.395c-.447.15-.799.5-.948.948l-.395 1.183a.75.75 0 01-1.422 0l-.395-1.183a1.5 1.5 0 00-.948-.948l-1.183-.395a.75.75 0 010-1.422l1.183-.395c.447-.15.799-.5.948-.948l.395-1.183A.75.75 0 0116.5 15z"
        clipRule="evenodd"
      />
    </svg>
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
                }, 18);
              }, 600);
            }, 500);
          }
        }, 18);
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

  return (
    <section className="border-b border-border-primary/40 bg-bg-primary px-6 py-10">
      <div className="mx-auto max-w-4xl">
        {/* Section label */}
        <div className="mb-5 flex items-center gap-3">
          <div className="h-2 w-2 animate-pulse rounded-full bg-purple-500" />
          <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-text-muted">
            AI Analyst
          </span>
        </div>

        {/* Card */}
        <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] shadow-[0_16px_64px_-16px_rgba(0,0,0,0.6)]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-purple-500/20 bg-purple-500/10 text-purple-300">
                <AnalystIcon />
              </div>
              <span className="text-sm font-bold text-text-primary">
                AI Analyst
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
              <div className="max-w-[85%] rounded-2xl border border-white/[0.06] bg-white/[0.04] px-4 py-2.5 text-sm text-text-primary">
                {QUESTION}
              </div>
            </div>

            {/* AI response */}
            {phase !== "idle" && (
              <div className="flex gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-purple-500/20 bg-purple-500/10 text-purple-300">
                  <AnalystIcon />
                </div>

                <div className="min-w-0 flex-1 rounded-2xl border border-white/[0.04] bg-white/[0.02] px-4 py-3">
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
                          {renderBold(introText)}
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
                                    {row.driver}
                                  </td>
                                  <td className="px-3 py-2 text-text-muted">
                                    {row.team}
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
                          {renderBold(outroText)}
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
