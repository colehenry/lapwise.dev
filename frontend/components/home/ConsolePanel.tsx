import type { ReactNode } from "react";

/** Blueprint `.lbl` — the mono label on the right of a panel header. */
export function PanelLabel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`font-mono text-[9.5px] uppercase tracking-[0.12em] text-ink-faint tabular-nums whitespace-nowrap ${className}`}
    >
      {children}
    </span>
  );
}

/** Blueprint `.kick` — the accent kicker. */
export function PanelKicker({ children }: { children: ReactNode }) {
  return (
    <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-accent-bright">
      {children}
    </span>
  );
}

/**
 * A skeleton the exact size of the text it stands in for, so nothing moves
 * when the value lands.
 */
export function ValueSkeleton({
  width,
  height = 13,
  className = "",
}: {
  width: number | string;
  height?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block animate-pulse rounded-[2px] bg-surface-raised align-middle ${className}`}
      style={{
        width: typeof width === "number" ? `${width}px` : width,
        height: `${height}px`,
      }}
    />
  );
}

/** One line and a retry. A failed panel never takes the page down with it. */
export function PanelFailure({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex h-full flex-col items-start justify-center gap-2 px-3 py-4">
      <p className="text-[12.5px] text-ink-soft">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-sm border border-line-strong px-2.5 py-1 font-mono text-[9.5px] uppercase tracking-[0.12em] text-ink-base transition-colors hover:border-accent hover:text-ink-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-bright"
        >
          Retry
        </button>
      )}
    </div>
  );
}

type ConsolePanelProps = {
  title?: ReactNode;
  label?: ReactNode;
  children: ReactNode;
  /** Wrapper class, including the grid area at console widths. */
  className?: string;
  bodyClassName?: string;
  /** Drops the header hairline and padding, for the full-bleed map. */
  bare?: boolean;
};

/**
 * Blueprint `.panel` and `.phead`: a surface, a hairline, a 14px title on the
 * left and a mono label on the right.
 */
export default function ConsolePanel({
  title,
  label,
  children,
  className = "",
  bodyClassName = "",
  bare = false,
}: ConsolePanelProps) {
  return (
    <section
      className={`flex min-h-0 min-w-0 flex-col overflow-hidden rounded-sm border border-line-soft bg-surface-panel ${className}`}
    >
      {!bare && (title || label) && (
        <header className="flex flex-none items-center justify-between gap-2.5 border-b border-line-soft px-3 py-[9px]">
          {typeof title === "string" ? (
            <h2 className="m-0 truncate text-[14px] font-bold tracking-[-0.01em] text-ink-strong">
              {title}
            </h2>
          ) : (
            title
          )}
          {label}
        </header>
      )}
      <div className={`min-h-0 flex-1 overflow-hidden ${bodyClassName}`}>
        {children}
      </div>
    </section>
  );
}
