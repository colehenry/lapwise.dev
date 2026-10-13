import Skeleton from "@/components/ui/Skeleton";

/** Same responsive rows as the real cards, without starting their data requests. */
export default function HomeTailSkeleton() {
  return (
    <div
      className="page-frame grid gap-3 py-3"
      aria-busy="true"
      role="img"
      aria-label="Loading race calendar and archive"
    >
      <div className="home-races-row">
        <section className="home-next-card flex flex-col rounded-sm border border-line-soft bg-surface-panel p-5">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
            Next race
          </span>
          <Skeleton height="100%" className="mt-3 flex-1" />
        </section>
        <section>
          <h2 className="home-recent-header m-0 text-[14px] font-bold text-ink-strong">
            Recent races
          </h2>
          <div className="home-recent-grid">
            {[1, 2, 3, 4].map((slot) => (
              <div
                key={slot}
                className="home-race-card rounded-sm border border-line-soft bg-surface-panel p-3.5"
              >
                <Skeleton height="100%" />
              </div>
            ))}
          </div>
        </section>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {["Race Weekend Hub", "Replay", "Archive"].map((label) => (
          <div
            key={label}
            className="home-entry-tile rounded-sm border border-line-soft bg-surface-panel p-4"
          >
            <Skeleton height="100%" />
          </div>
        ))}
      </div>
    </div>
  );
}
