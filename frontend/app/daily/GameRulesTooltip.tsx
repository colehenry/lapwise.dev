export default function GameRulesTooltip() {
  return (
    <div className="group relative">
      <button
        type="button"
        aria-describedby="game-rules-tooltip"
        aria-label="How to play"
        className="flex h-8 w-8 cursor-help items-center justify-center rounded-full border border-border-secondary bg-bg-secondary text-sm font-bold text-text-secondary transition-colors hover:border-text-muted hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-400"
      >
        ?
      </button>
      <div
        id="game-rules-tooltip"
        role="tooltip"
        className="pointer-events-none absolute right-0 top-full z-[70] mt-2 w-64 translate-y-1 rounded-md border border-border-primary bg-bg-elevated p-3 text-xs leading-relaxed text-text-secondary opacity-0 shadow-xl transition-all group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100"
      >
        <p>Choose one driver who matches both headers.</p>
        <p className="mt-1.5">You have 12 total guesses.</p>
        <p className="mt-1.5">
          Each driver can fill only one square in a grid. Incorrect guesses may
          still be tried elsewhere.
        </p>
      </div>
    </div>
  );
}
