"use client";

import { useState } from "react";
import ClutchIcon from "@/components/ui/ClutchIcon";

interface KeyFact {
  headline: string;
  detail: string;
}

interface SessionSummary {
  session_type: string;
  event_name: string;
  summary_text: string;
  key_facts: KeyFact[];
  model_used: string;
  generated_at: string;
}

interface SessionSummaryCardProps {
  summary: SessionSummary;
}

const SESSION_LABELS: Record<string, string> = {
  race: "Race",
  qualifying: "Qualifying",
  sprint_race: "Sprint",
  sprint_qualifying: "Sprint Quali",
  fp1: "FP1",
  fp2: "FP2",
  fp3: "FP3",
};

export type { SessionSummary };

export default function SessionSummaryCard({
  summary,
}: SessionSummaryCardProps) {
  const [expanded, setExpanded] = useState(false);

  const sessionLabel =
    SESSION_LABELS[summary.session_type] || summary.session_type;

  return (
    <div className="bg-bg-elevated border border-border-primary rounded-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-2 border-b border-border-primary/60">
        <ClutchIcon className="h-4 w-4 text-purple-400" title="AI Summary" />
        <span className="text-[10px] tracking-widest text-purple-400 font-bold uppercase font-mono">
          AI {sessionLabel} Summary
        </span>
        <span className="ml-auto text-[10px] text-text-muted font-mono">
          {new Date(summary.generated_at).toLocaleDateString()}
        </span>
      </div>

      {/* Key Facts */}
      <div className="p-4 space-y-3">
        {summary.key_facts.map((fact, i) => (
          <div key={fact.headline} className="flex gap-3">
            <span className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-purple-500/15 text-purple-400 text-xs font-bold font-mono">
              {i + 1}
            </span>
            <div>
              <p className="text-text-primary text-sm font-semibold">
                {fact.headline}
              </p>
              <p className="text-text-secondary text-xs mt-0.5">
                {fact.detail}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Expandable full summary */}
      {summary.summary_text && (
        <div className="border-t border-border-primary/60">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="w-full px-4 py-2 flex items-center justify-center gap-1.5 text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono hover:text-purple-400 transition-colors"
          >
            {expanded ? "Hide" : "Read"} Full Analysis
            <span
              className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
            >
              ▾
            </span>
          </button>
          {expanded && (
            <div className="px-4 pb-4">
              <p className="text-text-secondary text-sm leading-relaxed whitespace-pre-line">
                {summary.summary_text}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
