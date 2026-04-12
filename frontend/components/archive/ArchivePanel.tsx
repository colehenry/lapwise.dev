import type { ReactNode } from "react";
import { TrianglePattern } from "@/components/Patterns";

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
      className={`bg-bg-tertiary border border-border-primary rounded-sm shadow-sm overflow-hidden ${className}`}
    >
      {(title || actions) && (
        <div className="relative min-h-10 bg-bg-primary border-b border-border-primary px-4 py-2 flex items-center justify-between gap-3 overflow-hidden">
          {title && (
            <>
              <TrianglePattern
                id={
                  headerId ??
                  `archive-panel-${title.replace(/\s+/g, "-").toLowerCase()}`
                }
              />
              <span className="relative z-10 text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono">
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
