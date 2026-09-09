"use client";

import { useEffect, useRef, useState } from "react";

/** Rules, mode explanation, and the restart control.
 *
 * A click-opened menu rather than a hover tooltip: it holds a button, and a
 * hover surface cannot be operated by touch or keyboard.
 */
export default function GameHelpMenu({
  onRestart,
  rookieAvailable,
}: {
  onRestart: () => void;
  rookieAvailable: boolean;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !containerRef.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="How to play"
        onClick={() => setOpen((current) => !current)}
        className={`flex h-7 w-7 items-center justify-center rounded-full border text-sm font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-400 ${
          open
            ? "border-text-muted bg-bg-elevated text-text-primary"
            : "border-border-secondary bg-bg-secondary text-text-secondary hover:border-text-muted hover:text-text-primary"
        }`}
      >
        ?
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="How to play"
          className="absolute left-0 top-full z-[70] mt-2 w-72 rounded-sm border border-border-primary bg-bg-elevated p-3 text-xs leading-relaxed text-text-secondary shadow-xl"
        >
          <p className="font-bold text-text-primary">How to play</p>
          <p className="mt-1.5">
            Choose one driver who matches both headers. You have 12 guesses for
            the whole grid.
          </p>
          <p className="mt-1.5">
            Each driver fills only one square. A wrong guess can still be tried
            in another square.
          </p>

          {rookieAvailable && (
            <>
              <p className="mt-3 font-bold text-text-primary">Rookie Mode</p>
              <p className="mt-1.5">
                Instead of searching, each square offers eight drivers to choose
                from. Some of them fit; the rest match one header but not the
                other.
              </p>
              <p className="mt-1.5">
                Every guess shows what each driver actually did, so a wrong
                answer still tells you something. Each mode keeps its own
                progress on a grid.
              </p>
            </>
          )}

          <button
            type="button"
            onClick={() => {
              onRestart();
              setOpen(false);
            }}
            className="mt-3 w-full rounded-sm border border-border-secondary px-2 py-1.5 text-[11px] font-semibold text-text-secondary transition-colors hover:border-text-muted hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-400"
          >
            Restart this grid
          </button>
        </div>
      )}
    </div>
  );
}
