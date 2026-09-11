export default function DailyGameAdminTabs({
  game,
  onChange,
}: {
  game: "grid" | "guess";
  onChange: (game: "grid" | "guess") => void;
}) {
  return (
    <div className="mb-5 flex gap-2 border-b border-line-soft">
      {(
        [
          ["grid", "Daily Grid"],
          ["guess", "Guess Game"],
        ] as const
      ).map(([value, label]) => (
        <button
          key={value}
          type="button"
          aria-pressed={game === value}
          onClick={() => onChange(value)}
          className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${
            game === value
              ? "border-accent-bright text-ink-strong"
              : "border-transparent text-ink-soft hover:text-ink-base"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
