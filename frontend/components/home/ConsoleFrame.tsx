import type { ReactNode, RefObject } from "react";

/**
 * The console's own frame: the shared page gutter horizontally, the panel gap
 * vertically, and the grid that gives every column the same pair of row lines.
 */
export default function ConsoleFrame({
  children,
  viewportRef,
  quiet = false,
}: {
  children: ReactNode;
  viewportRef?: RefObject<HTMLDivElement | null>;
  /** No telemetry: the instruments that need it are not in the grid at all. */
  quiet?: boolean;
}) {
  return (
    <div className="page-frame py-3">
      <div
        ref={viewportRef}
        className={`home-console${quiet ? " home-console--quiet" : ""}`}
      >
        {children}
      </div>
    </div>
  );
}
