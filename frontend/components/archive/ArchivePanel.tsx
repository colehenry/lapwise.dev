import type { ReactNode } from "react";
import { TrianglePattern } from "@/components/layout/Patterns";

type ArchivePanelProps = {
  title?: string;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  headerId?: string;
  actions?: ReactNode;
};

export default function ArchivePanel({
  title,
  children,
  className = "",
  bodyClassName = "p-6",
  headerId,
  actions,
}: ArchivePanelProps) {
  return (
    <div
      className={`bg-surface-panel border border-line-soft rounded-sm shadow-sm overflow-hidden ${className}`}
    >
      {(title || actions) && (
        <div className="relative min-h-10 bg-surface-page border-b border-line-soft px-4 py-2 flex items-center justify-between gap-3 overflow-hidden">
          {title && (
            <>
              <TrianglePattern
                id={
                  headerId ??
                  `archive-panel-${title.replace(/\s+/g, "-").toLowerCase()}`
                }
              />
              <span className="relative z-10 text-[10px] tracking-widest text-ink-faint font-bold uppercase font-mono">
                {title}
              </span>
            </>
          )}
          {actions && <div className="relative z-10 ml-auto">{actions}</div>}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </div>
  );
}
