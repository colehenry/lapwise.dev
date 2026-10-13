import type { ReactNode, RefObject } from "react";

/**
 * The console's own frame: the shared page gutter horizontally, the panel gap
 * vertically, and the grid that gives every column the same pair of row lines.
 */
export default function ConsoleFrame({
  children,
  viewportRef,
}: {
  children: ReactNode;
  viewportRef?: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="page-frame py-3">
      <div ref={viewportRef} className="home-console">
        {children}
      </div>
    </div>
  );
}
