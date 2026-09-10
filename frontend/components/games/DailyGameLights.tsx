export default function DailyGameLights({
  spent,
  total,
}: {
  spent: number;
  total: number;
}) {
  const columns = Math.ceil(total / 2);
  return (
    <div
      className="grid gap-[3px] rounded-[5px] bg-black px-[7px] py-[5px]"
      style={{ gridTemplateColumns: `repeat(${columns}, 8px)` }}
      role="img"
      aria-label={`${spent} of ${total} guesses used`}
      title={`${Math.max(total - spent, 0)} guesses remaining`}
    >
      {Array.from({ length: total }, (_, index) => (
        <i
          key={`daily-game-light-${index + 1}`}
          className={`block h-2 w-2 rounded-full border motion-safe:transition-colors motion-reduce:transition-none ${
            index < spent
              ? "border-danger-bright bg-danger shadow-[0_0_7px_rgba(225,6,0,0.65)]"
              : "border-[var(--game-light-ring)] bg-[var(--game-light-off)]"
          }`}
        />
      ))}
    </div>
  );
}
