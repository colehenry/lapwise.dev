export default function DailyGridRules({
  onRestart,
  rookieAvailable,
}: {
  onRestart: () => void;
  rookieAvailable: boolean;
}) {
  return (
    <div className="p-4 text-[13px] leading-relaxed text-ink-soft">
      <p>
        Choose one driver who matches both headers. Each driver can fill only
        one square, and a wrong guess can still be tried elsewhere.
      </p>
      {rookieAvailable && (
        <p className="mt-3">
          Rookie Mode offers eight drivers per square and shows evidence after
          every choice. Each mode keeps separate progress.
        </p>
      )}
      <button
        type="button"
        onClick={onRestart}
        className="mt-4 w-full rounded-sm border border-line-strong px-3 py-2 text-xs font-semibold text-ink-base hover:border-ink-faint hover:text-ink-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-bright"
      >
        Restart this grid
      </button>
    </div>
  );
}
