import type { GridAttempt } from "@/hooks/useDailyGridProgress";

export default function StartingLights({
  attempts,
  total,
}: {
  attempts: GridAttempt[];
  total: number;
}) {
  const remaining = Math.max(total - attempts.length, 0);
  return (
    <div className="flex items-center gap-2">
      {remaining === 1 && (
        <span className="text-[10px] font-bold uppercase tracking-wide text-danger-bright">
          Final guess
        </span>
      )}
      <div
        className="grid grid-cols-4 gap-1.5 rounded-md border border-line-soft bg-surface-band p-2"
        role="img"
        aria-label={`${attempts.length} of ${total} guesses used`}
        title={`${remaining} guesses remaining`}
      >
        {Array.from({ length: total }, (_, index) => {
          const attempt = attempts[index];
          return (
            <span
              key={`starting-light-${index + 1}`}
              className="flex h-4 w-4 items-center justify-center rounded-sm bg-surface-page p-0.5 sm:h-[18px] sm:w-[18px]"
            >
              <span
                className={`h-full w-full rounded-full transition-colors duration-200 ${
                  attempt
                    ? attempt.correct
                      ? "bg-success shadow-[0_0_7px_var(--success)]"
                      : "bg-danger shadow-[0_0_7px_var(--danger)]"
                    : "bg-surface-raised"
                }`}
              />
            </span>
          );
        })}
      </div>
    </div>
  );
}
