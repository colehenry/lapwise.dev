import Link from "next/link";

const RULES = [
  [
    "Debut",
    "Green is the same debut year, yellow is within three years, and the arrow points toward the answer.",
  ],
  [
    "Last raced",
    "Green is the same final season, yellow is within three years, and the arrow points toward the answer.",
  ],
  [
    "Country",
    "Green is the same country and yellow is another country on the same continent.",
  ],
  [
    "Constructor",
    "A driver's signature constructor is where they earned the most wins, then podiums, then starts; green matches it, while yellow means their constructor histories overlap elsewhere, possibly in different seasons and not as teammates.",
  ],
  [
    "Career peak",
    "Champion, winner, podium, points, and starter form the levels; green is the same level and yellow is an adjacent one.",
  ],
] as const;

export default function GuessGameRules({
  currentNumber,
  history,
  onReplay,
}: {
  currentNumber: number;
  history: Array<{ number: number; published_on: string }>;
  onReplay: () => void;
}) {
  return (
    <div className="px-[18px] pb-[18px] pt-[15px]">
      <ul className="m-0 grid gap-3 pl-[13px] text-[13px] leading-[1.4] text-ink-soft">
        {RULES.map(([label, text]) => (
          <li key={label}>
            <strong className="text-ink-strong">{label}:</strong> {text}
          </li>
        ))}
      </ul>
      <div className="mt-5 border-t border-line-soft pt-4">
        <button
          type="button"
          onClick={onReplay}
          className="w-full rounded-sm border border-accent-bright bg-accent px-3 py-2 text-sm font-semibold text-ink-strong transition-colors hover:bg-accent-bright focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-bright"
        >
          Replay this game
        </button>
        <p className="mb-2 mt-4 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-ink-faint">
          Recent games
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {history.map((game) => (
            <Link
              key={game.number}
              href={`/guess?guess=${game.number}`}
              aria-current={game.number === currentNumber ? "page" : undefined}
              className={`rounded-sm border px-2 py-2 text-center text-xs font-semibold transition-colors ${
                game.number === currentNumber
                  ? "border-accent-bright bg-accent/10 text-ink-strong"
                  : "border-line-soft text-ink-base hover:border-line-strong hover:bg-surface-raised"
              }`}
            >
              #{String(game.number).padStart(3, "0")}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
