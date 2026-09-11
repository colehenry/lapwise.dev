import type {
  DailyGameLeaderboard,
  DailyGameStats,
} from "@/lib/queries/guessGame";

export default function DailyGameStatsPanel({
  leaderboard,
  loading,
  maxScore,
  stats,
}: {
  leaderboard?: DailyGameLeaderboard;
  loading: boolean;
  maxScore: number;
  stats?: DailyGameStats;
}) {
  if (loading) {
    return <p className="p-4 text-sm text-ink-soft">Loading results…</p>;
  }
  const results = stats ?? {
    played: 0,
    won: 0,
    win_percentage: 0,
    current_streak: 0,
    max_streak: 0,
    distribution: {},
    aggregate_distribution: null,
  };
  return (
    <div className="max-h-[70vh] overflow-y-auto p-4 text-xs text-ink-base">
      <div className="grid grid-cols-4 gap-2 text-center">
        {[
          [results.played, "Played"],
          [`${results.win_percentage}%`, "Won"],
          [results.current_streak, "Streak"],
          [results.max_streak, "Best"],
        ].map(([value, label]) => (
          <div key={label}>
            <strong className="block font-mono text-base text-ink-strong">
              {value}
            </strong>
            <span className="text-ink-soft">{label}</span>
          </div>
        ))}
      </div>
      {results.played === 0 && (
        <p className="mt-4 text-ink-soft">
          Complete a game to start your statistics.
        </p>
      )}
      <h3 className="mt-5 font-bold text-ink-strong">Guess distribution</h3>
      <div className="mt-2 grid gap-1.5">
        {Array.from({ length: maxScore }, (_, index) => index + 1).map(
          (score) => {
            const value = results.distribution[score] ?? 0;
            const peak = Math.max(1, ...Object.values(results.distribution));
            return (
              <div
                key={score}
                className="grid grid-cols-[18px_1fr] items-center gap-2"
              >
                <span className="font-mono text-ink-soft">{score}</span>
                <span
                  className="min-w-6 rounded-sm bg-accent px-1.5 py-0.5 text-right font-mono text-ink-strong"
                  style={{ width: `${Math.max(12, (value / peak) * 100)}%` }}
                >
                  {value}
                </span>
              </div>
            );
          },
        )}
      </div>
      {results.aggregate_distribution && (
        <div className="mt-4">
          <h3 className="font-bold text-ink-strong">Community distribution</h3>
          <div className="mt-2 grid grid-cols-5 gap-1.5 font-mono text-[10px] text-ink-soft">
            {Array.from({ length: maxScore }, (_, index) => index + 1).map(
              (score) => (
                <span key={score} className="rounded-sm bg-surface-raised p-1">
                  {score}: {results.aggregate_distribution?.[score] ?? 0}
                </span>
              ),
            )}
          </div>
        </div>
      )}
      <h3 className="mt-5 font-bold text-ink-strong">Leaderboard</h3>
      {leaderboard?.entries.length ? (
        <ol className="mt-2 grid gap-1">
          {leaderboard.entries.slice(0, 10).map((entry) => (
            <li
              key={`${entry.rank}-${entry.display_name}`}
              className="grid grid-cols-[24px_1fr_auto] gap-2 border-t border-line-soft py-1.5 first:border-0"
            >
              <span className="font-mono text-ink-faint">{entry.rank}</span>
              <span className="truncate">{entry.display_name}</span>
              <span className="font-mono text-ink-soft">{entry.score}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-2 text-ink-soft">No ranked finishes yet.</p>
      )}
    </div>
  );
}
