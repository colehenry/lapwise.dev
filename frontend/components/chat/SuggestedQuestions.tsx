"use client";

const SUGGESTIONS = [
  {
    category: "Circuits",
    label: "Most wins at Monza",
    question: "Who has the most wins at Monza?",
  },
  {
    category: "Qualifying",
    label: "Qualifying head-to-head",
    question: "Compare Norris vs Piastri head-to-head in 2024 qualifying",
  },
  {
    category: "Strategy",
    label: "Tire degradation",
    question: "Analyze tire degradation at Silverstone 2024",
  },
  {
    category: "Weather",
    label: "Rain races in 2023",
    question: "Which races had rain in 2023?",
  },
  {
    category: "Championship",
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
    <div className="flex h-full flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-3xl text-center">
        <div className="mb-2">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-3xl border border-purple-500/30 bg-purple-500/15 text-purple-300">
            <svg
              className="h-8 w-8"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M4 15.5 6.2 10A2 2 0 0 1 8 8.75h8a2 2 0 0 1 1.8 1.25L20 15.5" />
              <path d="M5 15.5h14v2a1.75 1.75 0 0 1-1.75 1.75h-1.5A1.75 1.75 0 0 1 14 17.5v-.25h-4V17.5a1.75 1.75 0 0 1-1.75 1.75h-1.5A1.75 1.75 0 0 1 5 17.5Z" />
              <circle cx="8" cy="15.25" r="1.1" />
              <circle cx="16" cy="15.25" r="1.1" />
              <path d="M8.5 8.75 10 6.5h4l1.5 2.25" />
            </svg>
          </div>
        </div>
        <h2 className="mb-2 text-2xl font-bold text-text-primary">
          Lapwise AI Analyst
        </h2>
        <p className="mx-auto mb-8 max-w-xl text-sm text-text-muted">
          Ask any question about Formula 1 - from sprint weekends and driver
          comparisons to weather, strategy, and championship trends.
        </p>

        <div className="grid gap-3 text-left md:grid-cols-2 xl:grid-cols-3">
          {SUGGESTIONS.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => onSelect(s.question)}
              className="rounded-3xl border border-border-primary bg-bg-elevated/70 p-4 transition-colors hover:border-purple-500/40 hover:bg-bg-elevated"
            >
              <div className="mb-2 text-[10px] font-mono uppercase tracking-widest text-purple-300">
                {s.category}
              </div>
              <div className="mb-2 text-sm font-medium text-text-primary">
                {s.label}
              </div>
              <div className="text-xs text-text-muted">{s.question}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
