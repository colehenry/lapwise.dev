"use client";

const SUGGESTIONS = [
  {
    label: "Most wins at Monza",
    question: "Who has the most wins at Monza?",
  },
  {
    label: "Qualifying head-to-head",
    question:
      "Compare Norris vs Piastri head-to-head in 2024 qualifying",
  },
  {
    label: "Tire degradation",
    question: "Analyze tire degradation at Silverstone 2024",
  },
  {
    label: "Rain races in 2023",
    question: "Which races had rain in 2023?",
  },
  {
    label: "Championship progression",
    question: "Show me Verstappen's championship progression",
  },
];

interface SuggestedQuestionsProps {
  onSelect: (question: string) => void;
}

export default function SuggestedQuestions({
  onSelect,
}: SuggestedQuestionsProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-4">
      <div className="max-w-lg w-full text-center">
        {/* Logo / Title */}
        <div className="mb-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-purple-500/15 border border-purple-500/30 mb-4">
            <span className="text-purple-400 font-bold text-xl">F1</span>
          </div>
        </div>
        <h2 className="text-text-primary text-xl font-bold mb-1">
          Lapwise AI Analyst
        </h2>
        <p className="text-text-muted text-sm mb-8">
          Ask any question about Formula 1 — from race results to tire strategy
          analysis.
        </p>

        {/* Suggestion chips */}
        <div className="flex flex-wrap justify-center gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => onSelect(s.question)}
              className="bg-bg-tertiary border border-border-primary hover:border-purple-500/40 hover:bg-bg-elevated text-text-secondary text-xs px-3.5 py-2 rounded-lg transition-colors"
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
