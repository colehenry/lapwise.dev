import Link from "next/link";
import type { ReactNode } from "react";
import Skeleton from "@/components/ui/Skeleton";

/** Shared geometry for the deferred module, missing analysis, and real transcript. */
export function HomeClutchFrame({ children }: { children: ReactNode }) {
  return (
    <section className="home-clutch-band border-y border-line-soft bg-surface-band px-3 pb-12 pt-10">
      <div className="home-clutch-inner mx-auto max-w-[1060px] px-2">
        {children}
      </div>
    </section>
  );
}

export function HomeClutchPlaceholder({
  loading = true,
}: {
  loading?: boolean;
}) {
  return (
    <HomeClutchFrame>
      <div className="home-clutch-heading flex flex-wrap items-center justify-between gap-4">
        <h2 className="m-0 text-[30px] font-bold leading-[1.08] tracking-[-0.035em] text-ink-strong">
          <span className="text-accent-bright">Ask Clutch</span> anything about
          Formula 1.
        </h2>
        <Link
          href="/ask"
          className="rounded-sm border border-accent-bright bg-accent px-5 py-2.5 text-[14px] font-semibold text-ink-strong"
        >
          Try it out
        </Link>
      </div>
      <div className="home-clutch-question mt-7" aria-busy={loading}>
        {loading ? (
          <Skeleton width="75%" height="28px" className="ml-auto" />
        ) : (
          <p className="text-ink-soft">
            Race analysis will appear here when the results are available.
          </p>
        )}
      </div>
      <div className="home-clutch-answer mt-3">
        {loading && <Skeleton height="100%" />}
      </div>
      <div className="home-clutch-chart mt-7 hidden sm:block">
        {loading && <Skeleton height="100%" />}
      </div>
      <div className="home-clutch-followups mt-6 flex gap-2">
        {loading && <Skeleton height="35px" />}
      </div>
      <Link
        href="/ask"
        className="home-clutch-form mt-7 flex items-center rounded-sm border border-line-strong bg-surface-panel px-4 text-ink-soft"
      >
        Ask about any race, driver or season…
      </Link>
    </HomeClutchFrame>
  );
}
